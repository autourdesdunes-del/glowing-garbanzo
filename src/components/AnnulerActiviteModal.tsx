"use client";

import { useEffect, useState } from "react";
import { CatalogueItem, Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { clientAPayeQuelqueChose, isMontgolfiereActivity, reglementAnnulation, resaTotalMontant } from "@/lib/resa";
import { ANNULATION_TYPES, RAISONS_ANNULATION } from "@/lib/constants";
import { todayStr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import PaypalEmailPromptModal from "@/components/PaypalEmailPromptModal";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Pop-up d'annulation d'une activité — calcule automatiquement si c'est
// remboursable (jamais deviné depuis le nom de l'activité, toujours depuis
// billet_requis + la règle réglée sur l'activité du Catalogue, voir
// resa.ts:reglementAnnulation), crée directement le Remboursement ou
// l'Avoir choisi (au lieu de le faire ressaisir à la main dans Suivis), et
// marque le paiement à prévenir Hossam si besoin — consommé par
// AnnulationHossamAlert.
export default function AnnulerActiviteModal({
  r,
  client,
  options,
  tarifs,
  catalogueItem,
  onUpdate,
  onUpdateClient,
  onClose,
}: {
  r: Reservation;
  client: Client;
  options: ReservationOption[];
  tarifs: ReservationTarif[];
  catalogueItem: CatalogueItem | undefined;
  onUpdate: (patch: Partial<Reservation>) => void;
  onUpdateClient?: (patch: Partial<Client>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const estMontgolfiere = isMontgolfiereActivity(r.nom_activite);
  // Une Montgolfière annulée l'est presque toujours par les autorités pour
  // météo — présélectionné pour éviter de le ressaisir à chaque fois,
  // reste modifiable si ce n'est pas le cas.
  const [annulationType, setAnnulationType] = useState<(typeof ANNULATION_TYPES)[number]["value"]>(
    estMontgolfiere ? "gouvernement" : "client"
  );
  const [raison, setRaison] = useState<string>(estMontgolfiere ? "Météo" : RAISONS_ANNULATION[0]);
  const [raisonAutre, setRaisonAutre] = useState("");
  const [exception, setException] = useState(false);
  const [remboursementChoix, setRemboursementChoix] = useState<"rembourse" | "avoir" | "">("");
  const [paypalEmail, setPaypalEmail] = useState(client.paypal_email || client.email || "");
  const [showPaypalPrompt, setShowPaypalPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const montantTotal = resaTotalMontant(r, client, options, tarifs);
  // Modifiable — permet un remboursement partiel (ex. frais déjà engagés
  // non récupérables) au lieu de toujours forcer le prix total de l'activité.
  const [montant, setMontant] = useState(montantTotal);
  const reglement = reglementAnnulation(r, catalogueItem, new Date());
  // Une annulation agence ou gouvernement n'est jamais la faute du client —
  // toujours remboursable, aucune exception à faire valider par Hossam.
  const remboursable = annulationType !== "client" || reglement.remboursable || exception;
  const raisonAffichee =
    annulationType === "client"
      ? reglement.raison
      : ANNULATION_TYPES.find((t) => t.value === annulationType)?.label || "";
  // Rien à rembourser si l'agence n'a jamais reçu d'argent pour ce séjour
  // (acompte pas encore encaissé, solde pas payé) ou si l'activité est
  // gratuite — même si la règle d'annulation dirait "remboursable".
  const remboursementPossible = remboursable && montant > 0 && clientAPayeQuelqueChose(client);
  const raisonFinale = raison === "Autre" ? raisonAutre.trim() : raison;

  // Le remboursement se fait par défaut via PayPal (demande explicite) —
  // dès que c'est remboursable, "Rembourser" est présélectionné, mais
  // l'adresse PayPal n'est demandée qu'au moment de confirmer l'annulation,
  // jamais avant.
  useEffect(() => {
    if (remboursementPossible && !remboursementChoix) {
      setRemboursementChoix("rembourse");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remboursementPossible]);

  const doConfirm = async (emailPourRemb: string) => {
    setSubmitting(true);
    const supabase = createClient();

    if (remboursementPossible && remboursementChoix === "rembourse") {
      const { error } = await supabase.from("remboursements").insert({
        client_id: client.id,
        montant,
        raison: "Annulation",
        mode: "PayPal",
        paypal_email: emailPourRemb.trim(),
        activite_id: r.id,
        date_probleme: todayStr(),
      });
      if (error) toast("Échec de la création du remboursement.");
      // Mémorise l'adresse pour les prochains remboursements de ce client
      // — plus besoin de la recoller/ressaisir la prochaine fois.
      if (emailPourRemb.trim() && emailPourRemb.trim() !== client.paypal_email) {
        onUpdateClient?.({ paypal_email: emailPourRemb.trim() });
      }
    } else if (remboursementPossible && remboursementChoix === "avoir") {
      const { error } = await supabase.from("avoirs").insert({
        client_id: client.id,
        montant,
        montant_restant: montant,
        raison: "Annulation",
        activite_id: r.id,
        date_probleme: todayStr(),
      });
      if (error) toast("Échec de la création de l'avoir.");
    }

    onUpdate({
      statut_resa: "Annulée",
      annulation_raison: raisonFinale,
      annulation_date: todayStr(),
      annulation_remb_avoir: remboursementPossible ? remboursementChoix : "",
      annulation_exception_hossam: exception,
      annulation_prevenir_hossam: reglement.prevenirHossam,
      annulation_type: annulationType,
    });
    setSubmitting(false);
    onClose();
  };

  const confirmer = () => {
    if (raison === "Autre" && !raisonAutre.trim()) {
      toast("Précisez la raison de l'annulation.");
      return;
    }
    if (remboursementPossible && !remboursementChoix) {
      toast("Choisissez remboursement ou avoir avant de confirmer.");
      return;
    }
    if (remboursementPossible && remboursementChoix === "rembourse" && !paypalEmail.trim()) {
      setShowPaypalPrompt(true);
      return;
    }
    doConfirm(paypalEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Annuler « {r.nom_activite || "cette activité"} »
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Type d&apos;annulation</label>
          <div className="flex gap-2">
            {ANNULATION_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAnnulationType(t.value)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  annulationType === t.value
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            remboursable
              ? "border-[#0F5C56]/30 bg-[#0F5C56]/5 text-[#0F5C56]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {remboursable ? "✅ Remboursable" : "❌ Non remboursable"} — {raisonAffichee}
        </div>

        {annulationType === "client" && !reglement.remboursable && (
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={exception} onChange={(e) => setException(e.target.checked)} />
            Exception validée par Hossam — rembourser quand même
          </label>
        )}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Raison de l&apos;annulation</label>
          <select value={raison} onChange={(e) => setRaison(e.target.value)} className="input text-sm">
            {RAISONS_ANNULATION.map((rai) => (
              <option key={rai}>{rai}</option>
            ))}
          </select>
          {raison === "Autre" && (
            <textarea
              value={raisonAutre}
              onChange={(e) => setRaisonAutre(e.target.value)}
              placeholder="Précisez la raison…"
              rows={2}
              className="input mt-1.5 text-sm"
            />
          )}
        </div>

        {remboursable && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Montant à rembourser (€)
              {montant !== montantTotal && (
                <span className="ml-1 font-normal text-neutral-400">
                  (prix de l&apos;activité : {euros(montantTotal)} €)
                </span>
              )}
            </label>
            <input
              type="number"
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value) || 0)}
              className="input mb-2 max-w-[160px]"
            />
            {remboursementPossible ? (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRemboursementChoix("rembourse")}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                      remboursementChoix === "rembourse"
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                    }`}
                  >
                    Rembourser
                  </button>
                  <button
                    onClick={() => setRemboursementChoix("avoir")}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                      remboursementChoix === "avoir"
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                    }`}
                  >
                    Avoir (cas particulier)
                  </button>
                </div>
                {remboursementChoix === "rembourse" && (
                  <p className="mt-1.5 text-xs text-neutral-500">
                    PayPal —{" "}
                    {paypalEmail ? (
                      <>
                        {paypalEmail}{" "}
                        <button
                          onClick={() => setShowPaypalPrompt(true)}
                          className="text-[#171717] underline hover:no-underline"
                        >
                          modifier
                        </button>
                      </>
                    ) : (
                      <span className="text-neutral-400">demandée à la confirmation</span>
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-neutral-400">
                Aucun paiement reçu pour ce séjour (acompte non encaissé, solde non payé) — rien à rembourser.
              </p>
            )}
          </div>
        )}

        <button
          onClick={confirmer}
          disabled={submitting}
          className="mt-4 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : "Confirmer l'annulation"}
        </button>
      </div>
      {showPaypalPrompt && (
        <PaypalEmailPromptModal
          initialValue={paypalEmail}
          onConfirm={(email) => {
            setPaypalEmail(email);
            setShowPaypalPrompt(false);
            doConfirm(email);
          }}
          onClose={() => setShowPaypalPrompt(false)}
        />
      )}
    </div>
  );
}
