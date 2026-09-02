"use client";

import { useState } from "react";

// Demande de valider (ou ajuster) la date à laquelle aura lieu une option de
// croisière (Montgolfière, Abu Simbel, transfert) — cette date est souvent
// différente de celle de la croisière elle-même, calculée depuis le jour de
// l'itinéraire où l'option a lieu. Voir croisiereOptionDateProposee (resa.ts).
export default function CroisiereOptionDateModal({
  optionNom,
  dateProposee,
  onCancel,
  onConfirm,
}: {
  optionNom: string;
  dateProposee: string;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}) {
  const [date, setDate] = useState(dateProposee);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">
          À quelle date aura lieu « {optionNom} » ?
        </h2>
        <p className="mt-2 text-sm text-[#666666]">
          D&apos;après l&apos;itinéraire de la croisière, cette option a normalement lieu le
          jour ci-dessous — vérifie et ajuste si besoin. Une carte séparée sera créée à cette
          date, avec le prix de l&apos;option (il ne sera plus compté sur la croisière).
        </p>
        <input
          autoFocus
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input mt-3 w-full"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler l&apos;option
          </button>
          <button
            type="button"
            disabled={!date}
            onClick={() => onConfirm(date)}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Valider la date
          </button>
        </div>
      </div>
    </div>
  );
}
