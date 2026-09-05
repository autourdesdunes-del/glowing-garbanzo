"use client";

import { useEffect, useState } from "react";
import { CatalogueItem, Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { clientAPayeQuelqueChose, isMontgolfiereActivity, reglementAnnulation, resaTotalMontant } from "@/lib/resa";
import { ANNULATION_TYPES, RAISONS_ANNULATION, MODES_PAIEMENT } from "@/lib/constants";
import { nowHHMM, todayStr } from "@/lib/dates";
import { fmtDateDMY } from "@/lib/contactStepFormat";
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
  reservations,
  options,
  tarifs,
  catalogueItem,
  onUpdate,
  onUpdateClient,
  onClose,
}: {
  r: Reservation;
  client: Client;
  reservations: Reservation[];
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
  const [dateAnnulation, setDateAnnulation] = useState(todayStr());
  const [heureAnnulation, setHeureAnnulation] = useState(nowHHMM());
  const [exception, setException] = useState(false);
  // Pré-rempli depuis le paiement du client au global (acompte encaissé ou
  // solde payé) mais reste modifiable à la main : une activité ajoutée
  // après un solde déjà clôturé (voir reprise_*) peut très bien n'avoir,
  // elle, jamais été payée, même si le client a payé le reste du séjour —
  // et inversement une activité réglée par avance reste "payée" même si le
  // solde global ne l'est pas encore. Décide seul si un remboursement/avoir
  // a du sens (remboursementPossible ci-dessous).
  const [dejaPayee, setDejaPayee] = useState(clientAPayeQuelqueChose(client));
  const [remboursementChoix, setRemboursementChoix] = useState<"rembourse" | "avoir" | "">("");
  const [paypalEmail, setPaypalEmail] = useState(client.paypal_email || client.email || "");
  const [showPaypalPrompt, setShowPaypalPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const montantTotal = resaTotalMontant(r, client, options, tarifs);
  // Modifiable — permet un remboursement partiel (ex. frais déjà engagés
  // non récupérables) au lieu de toujours forcer le prix total de l'activité.
  const [montant, setMontant] = useState(montantTotal);
  // Calculé sur la date d'annulation choisie (par défaut aujourd'hui), pas
  // toujours "maintenant" — permet de ressaisir une annulation passée (ex.
  // reprise de données Notion) sans que le délai de 24h/48h se retrouve
  // comparé à tort à la date du jour de la ressaisie.
  const reglement = reglementAnnulation(r, catalogueItem, new Date(dateAnnulation + "T" + (heureAnnulation || "00:00")));
  // Une annulation agence ou gouvernement n'est jamais la faute du client —
  // toujours remboursable, aucune exception à faire valider par Hossam.
  const remboursable = annulationType !== "client" || reglement.remboursable || exception;
  const raisonAffichee =
    annulationType === "client"
      ? reglement.raison
      : ANNULATION_TYPES.find((t) => t.value === annulationType)?.label || "";
  // Rien à rembourser si cette activité n'a jamais été payée (voir
  // dejaPayee, modifiable à la main juste en-dessous) ou si l'activité est
  // gratuite — même si la règle d'annulation dirait "remboursable".
  const remboursementPossible = remboursable && montant > 0 && dejaPayee;
  const raisonFinale = raison === "Autre" ? raisonAutre.trim() : raison;
  // Rien n'a été encaissé pour cette activité (dejaPayee = "Non, pas
  // encore") : un montant à rembourser non nul serait de l'argent que
  // l'agence n'a jamais reçu — bloque explicitement plutôt que de laisser
  // confirmer silencieusement une erreur de saisie.
  const montantSansPaiement = !dejaPayee && montant > 0;

  // Le solde (unique par séjour) ou un règlement de reprise (activité
  // ajoutée après coup, voir reprise_*) peuvent être rattachés pile à
  // l'activité qu'on est en train d'annuler — si ce règlement n'a pas
  // encore été encaissé, l'annuler sans rien faire laisserait le dossier
  // avec un paiement "prévu" sur une activité qui n'existe plus. Toujours
  // demandé explicitement plutôt que déplacé/effacé en silence.
  const soldeIci = client.solde_activite_id === r.id && !client.solde_paye;
  const repriseIci = !soldeIci && client.reprise_activite_id === r.id && Number(client.reprise_montant) > 0;
  const reglementIci: { type: "solde" | "reprise"; montant: number; mode: string } | null = soldeIci
    ? { type: "solde", montant: Number(client.solde_montant) || 0, mode: client.solde_mode }
    : repriseIci
      ? { type: "reprise", montant: Number(client.reprise_montant) || 0, mode: client.reprise_mode }
      : null;
  const [reglementChoix, setReglementChoix] = useState<"annuler" | "deplacer" | "autre_moyen" | "">("");
  const [reglementCibleId, setReglementCibleId] = useState("");
  const [reglementMontant, setReglementMontant] = useState(reglementIci?.montant || 0);
  const [reglementModeAutre, setReglementModeAutre] = useState("PayPal");
  const autresActivites = reservations.filter((rr) => rr.id !== r.id && rr.statut_resa !== "Annulée");
  // Bloque la confirmation tant que la question n'a pas été tranchée (et,
  // pour "déplacer", tant qu'une activité cible n'a pas été choisie).
  const reglementIncomplet =
    !!reglementIci && (!reglementChoix || (reglementChoix === "deplacer" && !reglementCibleId));

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
        date_probleme: dateAnnulation || todayStr(),
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
        date_probleme: dateAnnulation || todayStr(),
      });
      if (error) toast("Échec de la création de l'avoir.");
    }

    if (reglementIci && reglementChoix === "annuler") {
      const { error } = await supabase.from("paiements_etapes").insert({
        client_id: client.id,
        montant: 0,
        mode: "Annulation",
        date: dateAnnulation || todayStr(),
        activite_nom: r.nom_activite,
        note: `Annulation paiement du ${fmtDateDMY(r.date_debut)} à ${r.nom_activite || "cette activité"} — montant : ${euros(
          reglementIci.montant
        )} € — raison : client a annulé l'activité le ${fmtDateDMY(dateAnnulation)} — conséquence : paiement annulé`,
      });
      if (error) toast("Échec de l'enregistrement de l'annulation du paiement.");
      onUpdateClient?.(
        reglementIci.type === "solde"
          ? {
              paiement_integral_mode: "",
              solde_activite_id: null,
              solde_rdv_heure: "",
              solde_rdv_lieu: "",
              solde_rdv_valide: false,
              solde_rdv_finalise: false,
              solde_mode: "Espèces EUR",
              solde_montant: 0,
            }
          : { reprise_montant: 0, reprise_activite_id: null, reprise_mode: "" }
      );
    } else if (reglementIci && reglementChoix === "deplacer") {
      onUpdateClient?.(
        reglementIci.type === "solde"
          ? { solde_activite_id: reglementCibleId, solde_montant: reglementMontant }
          : { reprise_activite_id: reglementCibleId, reprise_montant: reglementMontant }
      );
    } else if (reglementIci && reglementChoix === "autre_moyen") {
      onUpdateClient?.(
        reglementIci.type === "solde"
          ? { solde_activite_id: null, solde_mode: reglementModeAutre, solde_montant: reglementMontant }
          : { reprise_activite_id: null, reprise_mode: reglementModeAutre, reprise_montant: reglementMontant }
      );
    }

    onUpdate({
      statut_resa: "Annulée",
      annulation_raison: raisonFinale,
      annulation_date: dateAnnulation || todayStr(),
      annulation_heure: heureAnnulation,
      annulation_remb_avoir: remboursementPossible ? remboursementChoix : "",
      annulation_exception_hossam: exception,
      annulation_prevenir_hossam: reglement.prevenirHossam,
      annulation_type: annulationType,
      annulation_delai_raison: reglement.raison,
      annulation_paye_avant: dejaPayee,
    });
    setSubmitting(false);
    onClose();
  };

  const confirmer = () => {
    if (raison === "Autre" && !raisonAutre.trim()) {
      toast("Précisez la raison de l'annulation.");
      return;
    }
    if (montantSansPaiement) {
      toast("Rien n'a été encaissé pour cette activité — repassez le montant à 0 € avant de confirmer.");
      return;
    }
    if (reglementIncomplet) {
      toast("Indiquez ce qu'il advient du règlement prévu sur cette activité avant de confirmer.");
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

        <div className="mt-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Date de l&apos;annulation</label>
            <input
              type="date"
              value={dateAnnulation}
              onChange={(e) => setDateAnnulation(e.target.value)}
              className="input text-sm"
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Heure</label>
            <input
              type="time"
              value={heureAnnulation}
              onChange={(e) => setHeureAnnulation(e.target.value)}
              className="input text-sm"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Cette activité avait-elle déjà été payée ?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDejaPayee(true);
                if (montant === 0) setMontant(montantTotal);
              }}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                dejaPayee
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
              }`}
            >
              Oui, déjà payée
            </button>
            <button
              type="button"
              onClick={() => {
                setDejaPayee(false);
                setMontant(0);
              }}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                !dejaPayee
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
              }`}
            >
              Non, pas encore
            </button>
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
              className={`input mb-2 max-w-[160px] ${montantSansPaiement ? "border-red-300 focus:border-red-400" : ""}`}
            />
            {montantSansPaiement && (
              <p className="mb-2 text-xs text-red-600">
                ⚠ Rien n&apos;a été encaissé pour cette activité (&quot;Non, pas encore&quot; ci-dessus) — impossible
                de rembourser un montant. Repassez le montant à 0 € ou corrigez la réponse ci-dessus si l&apos;activité
                a en fait déjà été payée.
              </p>
            )}
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
                Marquée &quot;pas encore payée&quot; ci-dessus — rien à rembourser.
              </p>
            )}
          </div>
        )}

        {reglementIci && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">
              ⚠ Le {reglementIci.type === "solde" ? "solde du séjour" : "règlement complémentaire"} de ce client (
              {euros(reglementIci.montant)} €{reglementIci.mode ? `, ${reglementIci.mode}` : ""}) était prévu sur
              cette activité. Que faire de ce règlement ?
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setReglementChoix("annuler")}
                className={`rounded-md border px-2 py-1.5 text-left text-xs font-medium ${
                  reglementChoix === "annuler"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Annuler ce paiement — rien n&apos;est prévu ailleurs, dossier à reprogrammer
              </button>
              <button
                type="button"
                onClick={() => setReglementChoix("deplacer")}
                className={`rounded-md border px-2 py-1.5 text-left text-xs font-medium ${
                  reglementChoix === "deplacer"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Le déplacer vers une autre activité
              </button>
              <button
                type="button"
                onClick={() => setReglementChoix("autre_moyen")}
                className={`rounded-md border px-2 py-1.5 text-left text-xs font-medium ${
                  reglementChoix === "autre_moyen"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Le faire régler autrement (PayPal / virement, sans passer par une activité)
              </button>
            </div>

            {reglementChoix === "deplacer" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-neutral-500">Activité de destination</label>
                <select
                  value={reglementCibleId}
                  onChange={(e) => setReglementCibleId(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">— Choisir —</option>
                  {autresActivites.map((rr) => (
                    <option key={rr.id} value={rr.id}>
                      {rr.nom_activite || "Activité"}
                      {rr.date_debut ? ` (${fmtDateDMY(rr.date_debut)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reglementChoix === "autre_moyen" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-neutral-500">Nouveau moyen de paiement</label>
                <select
                  value={reglementModeAutre}
                  onChange={(e) => setReglementModeAutre(e.target.value)}
                  className="input text-sm"
                >
                  {MODES_PAIEMENT.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {(reglementChoix === "deplacer" || reglementChoix === "autre_moyen") && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-neutral-500">Montant (€)</label>
                <input
                  type="number"
                  value={reglementMontant}
                  onChange={(e) => setReglementMontant(Number(e.target.value) || 0)}
                  className="input max-w-[160px]"
                />
              </div>
            )}
          </div>
        )}

        <button
          onClick={confirmer}
          disabled={submitting || montantSansPaiement || reglementIncomplet}
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
