"use client";

import { useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { participantsFor } from "@/lib/resa";
import { todayStr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

// Le gouvernement égyptien peut annuler uniquement le vol en montgolfière
// d'une excursion combinée (ex. "Louxor 1 jour visites & 1 jour
// Montgolfière") sans toucher au reste (visites, transferts...) — ce pop-up
// ne touche donc jamais statut_resa, contrairement à AnnulerActiviteModal.
// Dédommagement forfaitaire connu : 50 € par participant prévu sur le vol.
const MONTANT_PAR_PARTICIPANT = 50;

export default function AnnulerMontgolfiereModal({
  r,
  client,
  onUpdate,
  onClose,
}: {
  r: Reservation;
  client: Client;
  onUpdate: (patch: Partial<Reservation>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { nbAd, nbEnf } = participantsFor(r, client);
  const nbParticipantsPrevus = nbAd + nbEnf;
  const [participants, setParticipants] = useState(nbParticipantsPrevus);
  const [montant, setMontant] = useState(nbParticipantsPrevus * MONTANT_PAR_PARTICIPANT);
  const [date, setDate] = useState(todayStr());
  const [submitting, setSubmitting] = useState(false);

  const confirmer = async () => {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("remboursements").insert({
      client_id: client.id,
      montant,
      raison: "Autre",
      raison_autre: "Montgolfière annulée (gouvernement)",
      mode: "PayPal",
      activite_id: r.id,
      date_probleme: date || todayStr(),
    });
    if (error) {
      toast("Échec de la création du remboursement.");
      setSubmitting(false);
      return;
    }
    onUpdate({ montgolfiere_annulee: true, montgolfiere_annulee_date: date || todayStr() });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            🎈 Montgolfière annulée — « {r.nom_activite || "cette activité"} »
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Le reste de l&apos;activité (visites, transferts...) n&apos;est pas annulé — seul le vol en montgolfière
          l&apos;est. L&apos;activité reste confirmée, un badge &quot;Montgolfière annulée&quot; s&apos;affichera à
          côté de son titre.
        </p>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Date de l&apos;annulation</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input text-sm"
          />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Participants prévus sur la montgolfière
          </label>
          <input
            type="number"
            value={participants}
            onChange={(e) => {
              const n = Number(e.target.value) || 0;
              setParticipants(n);
              setMontant(n * MONTANT_PAR_PARTICIPANT);
            }}
            className="input max-w-[120px]"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Pré-rempli avec {nbParticipantsPrevus} (adultes + enfants du dossier) — ajuste si tous n&apos;étaient pas
            inscrits sur le vol.
          </p>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Montant à rembourser (€) — {MONTANT_PAR_PARTICIPANT} € × {participants}
          </label>
          <input
            type="number"
            value={montant}
            onChange={(e) => setMontant(Number(e.target.value) || 0)}
            className="input max-w-[160px]"
          />
        </div>

        <button
          onClick={confirmer}
          disabled={submitting}
          className="mt-4 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : "Confirmer et créer le remboursement"}
        </button>
      </div>
    </div>
  );
}
