"use client";

import { useState } from "react";
import { ZONES_HOTEL } from "@/lib/constants";

// Ouverte directement depuis la fiche client (ContactStep) quand l'hôtel
// saisi n'est pas encore répertorié — évite de renvoyer l'employée vers
// HELP pour une simple classification par zone. Choisir une zone
// enregistre l'hôtel dans hotels_reference (voir onAdd, câblé dans
// ClientDetail.tsx) et débloque aussitôt la détection de taxe de transfert
// pour ce client comme pour tous les suivants qui utiliseront cet hôtel.
export default function AjouterHotelZoneModal({
  hotelNom,
  onAdd,
  onClose,
}: {
  hotelNom: string;
  onAdd: (ville: string) => Promise<void>;
  onClose: () => void;
}) {
  const [autreVille, setAutreVille] = useState("");
  const [saving, setSaving] = useState(false);

  const choisir = async (ville: string) => {
    if (!ville.trim() || saving) return;
    setSaving(true);
    await onAdd(ville.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">Où se trouve cet hôtel ?</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-[#8B4531]">{hotelNom}</p>
        <p className="mt-1 text-xs text-neutral-500">
          Sera rajouté dans HELP &gt; Localisation des hôtels — plus besoin de reclasser cet hôtel la
          prochaine fois.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {ZONES_HOTEL.map((ville) => (
            <button
              key={ville}
              type="button"
              disabled={saving}
              onClick={() => choisir(ville)}
              className="rounded-md border border-[#eaeaea] px-3 py-2 text-sm font-medium text-[#171717] hover:border-[#171717] disabled:opacity-50"
            >
              {ville}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={autreVille}
            onChange={(e) => setAutreVille(e.target.value)}
            placeholder="Autre zone…"
            className="input flex-1"
          />
          <button
            type="button"
            disabled={saving || !autreVille.trim()}
            onClick={() => choisir(autreVille)}
            className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
