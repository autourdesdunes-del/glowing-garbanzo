"use client";

import { useState } from "react";

// Demande le titre exact dès la sélection d'un item catalogue "générique"
// (ex. "Transfert aléatoire") — voir isTitreLibreActivity dans resa.ts.
export default function TitreLibreModal({
  exemple,
  onConfirm,
  onCancel,
}: {
  exemple: string;
  onConfirm: (titre: string) => void;
  onCancel: () => void;
}) {
  const [titre, setTitre] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">Quel est le titre ?</h2>
        <p className="mt-2 text-sm text-[#666666]">Ex. « {exemple} »</p>
        <input
          autoFocus
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder={exemple}
          className="input mt-3 w-full"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!titre.trim()}
            onClick={() => onConfirm(titre.trim())}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
