"use client";

import { useEffect, useState } from "react";
import { CatalogueItem, Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { clientAPayeQuelqueChose, reglementAnnulation, resaTotalMontant } from "@/lib/resa";
import { RAISONS_ANNULATION } from "@/lib/constants";
import { todayStr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import PaypalEmailPromptModal from "@/components/PaypalEmailPromptModal";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Annule d'un coup toutes les activités actives d'un client — même moteur
// de règles que AnnulerActiviteModal (voir resa.ts:reglementAnnulation),
// appliqué en rafale plutôt que de faire cliquer l'employée activité par
// activité. Un seul choix rembourser/avoir pour tout ce qui est
// remboursable, plutôt que de le redemander pour chaque ligne.
export default function AnnulerClientModal({
  client,
  reservations,
  resaOptions,
  resaTarifs,
  catalogue,
  onUpdateClient,
  onUpdateReservation,
  onClose,
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  catalogue: CatalogueItem[];
  onUpdateClient: (patch: Partial<Client>) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [raison, setRaison] = useState<string>(RAISONS_ANNULATION[0]);
  const [raisonAutre, setRaisonAutre] = useState("");
  const [remboursementChoix, setRemboursementChoix] = useState<"rembourse" | "avoir" | "">("");
  const [paypalEmail, setPaypalEmail] = useState(client.email || "");
  const [showPaypalPrompt, setShowPaypalPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const argentRecu = clientAPayeQuelqueChose(client);
  const actives = reservations.filter((r) => r.client_id === client.id && r.statut_resa !== "Annulée");
  const now = new Date();
  const lignes = actives.map((r) => {
    const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
    const montant = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    const reglement = reglementAnnulation(r, catalogueItem, now);
    // Rien à rembourser si l'agence n'a jamais reçu d'argent pour ce séjour
    // (solde/acompte unique par séjour, jamais par activité) ou si
    // l'activité est gratuite — même si la règle d'annulation le permettrait.
    const remboursable = reglement.remboursable && montant > 0 && argentRecu;
    return { r, montant, reglement, remboursable };
  });
  const totalRemboursable = lignes.filter((l) => l.remboursable).reduce((s, l) => s + l.montant, 0);
  const raisonFinale = raison === "Autre" ? raisonAutre.trim() : raison;

  // Le remboursement se fait par défaut via PayPal (demande explicite) —
  // dès qu'il y a quelque chose à rembourser, "Rembourser" est présélectionné,
  // mais l'adresse PayPal n'est demandée qu'à la confirmation de l'annulation,
  // jamais avant.
  useEffect(() => {
    if (totalRemboursable > 0 && !remboursementChoix) {
      setRemboursementChoix("rembourse");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRemboursable]);

  const doConfirm = async (emailPourRemb: string) => {
    setSubmitting(true);
    const supabase = createClient();
    const date = todayStr();

    for (const { r, montant, reglement, remboursable } of lignes) {
      if (remboursable && remboursementChoix === "rembourse") {
        await supabase.from("remboursements").insert({
          client_id: client.id,
          montant,
          raison: "Annulation",
          mode: "PayPal",
          paypal_email: emailPourRemb.trim(),
          activite_id: r.id,
          date_probleme: date,
        });
      } else if (remboursable && remboursementChoix === "avoir") {
        await supabase.from("avoirs").insert({
          client_id: client.id,
          montant,
          montant_restant: montant,
          raison: "Annulation",
          activite_id: r.id,
          date_probleme: date,
        });
      }
      onUpdateReservation(r.id, {
        statut_resa: "Annulée",
        annulation_raison: raisonFinale,
        annulation_date: date,
        annulation_remb_avoir: remboursable ? remboursementChoix : "",
        annulation_exception_hossam: false,
        annulation_prevenir_hossam: reglement.prevenirHossam,
      });
    }

    onUpdateClient({ statut: "Client annulé", annulation_raison: raisonFinale, annulation_date: date });
    setSubmitting(false);
    onClose();
  };

  const confirmer = () => {
    if (raison === "Autre" && !raisonAutre.trim()) {
      toast("Précisez la raison de l'annulation.");
      return;
    }
    if (totalRemboursable > 0 && !remboursementChoix) {
      toast("Choisissez remboursement ou avoir avant de confirmer.");
      return;
    }
    if (totalRemboursable > 0 && remboursementChoix === "rembourse" && !paypalEmail.trim()) {
      setShowPaypalPrompt(true);
      return;
    }
    doConfirm(paypalEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Annuler {client.nom || "ce client"}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        {actives.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Aucune activité active à annuler.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {lignes.map(({ r, montant, reglement, remboursable }) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#171717]">{r.nom_activite || "Activité"}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {reglement.remboursable && montant > 0 && !argentRecu
                      ? "Remboursable, mais rien n'a été payé — rien à rembourser"
                      : reglement.raison}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="font-amounts text-xs">{euros(montant)} €</span>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      remboursable ? "bg-[#0F5C56]/10 text-[#0F5C56]" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {remboursable ? "Remboursable" : "Non remb."}
                  </span>
                </div>
              </div>
            ))}
          </div>
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

        {totalRemboursable > 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Total à traiter : {euros(totalRemboursable)} €
            </label>
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
          </div>
        )}

        <button
          onClick={confirmer}
          disabled={submitting}
          className="mt-4 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : "Confirmer l'annulation du client"}
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
