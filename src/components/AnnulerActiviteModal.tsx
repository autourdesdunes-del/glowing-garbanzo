"use client";

import { useState } from "react";
import { CatalogueItem, Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { reglementAnnulation, resaTotalMontant } from "@/lib/resa";
import { RAISONS_ANNULATION } from "@/lib/constants";
import { todayStr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

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
  onClose,
}: {
  r: Reservation;
  client: Client;
  options: ReservationOption[];
  tarifs: ReservationTarif[];
  catalogueItem: CatalogueItem | undefined;
  onUpdate: (patch: Partial<Reservation>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [raison, setRaison] = useState<string>(RAISONS_ANNULATION[0]);
  const [raisonAutre, setRaisonAutre] = useState("");
  const [exception, setException] = useState(false);
  const [remboursementChoix, setRemboursementChoix] = useState<"rembourse" | "avoir" | "">("");
  const [submitting, setSubmitting] = useState(false);

  const montant = resaTotalMontant(r, client, options, tarifs);
  const reglement = reglementAnnulation(r, catalogueItem, new Date());
  const remboursable = reglement.remboursable || exception;
  const raisonFinale = raison === "Autre" ? raisonAutre.trim() : raison;

  const confirmer = async () => {
    if (raison === "Autre" && !raisonAutre.trim()) {
      toast("Précisez la raison de l'annulation.");
      return;
    }
    if (remboursable && !remboursementChoix) {
      toast("Choisissez remboursement ou avoir avant de confirmer.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();

    if (remboursable && remboursementChoix === "rembourse") {
      const { error } = await supabase.from("remboursements").insert({
        client_id: client.id,
        montant,
        raison: "Annulation",
        activite_id: r.id,
        date_probleme: todayStr(),
      });
      if (error) toast("Échec de la création du remboursement.");
    } else if (remboursable && remboursementChoix === "avoir") {
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
      annulation_remb_avoir: remboursable ? remboursementChoix : "",
      annulation_exception_hossam: exception,
      annulation_prevenir_hossam: reglement.prevenirHossam,
    });
    setSubmitting(false);
    onClose();
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

        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            remboursable
              ? "border-[#0F5C56]/30 bg-[#0F5C56]/5 text-[#0F5C56]"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {remboursable ? "✅ Remboursable" : "❌ Non remboursable"} — {reglement.raison}
        </div>

        {!reglement.remboursable && (
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
              Montant concerné : {euros(montant)} €
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
    </div>
  );
}
