"use client";

import { Client } from "@/lib/types";

// Pop-up rapide pour un appel programmé (carte "Appel à HH:MM" du dashboard)
// — avant, cliquer dessus ouvrait directement le dossier complet du client,
// ce qui faisait perdre le dashboard pour juste lire un numéro de téléphone
// (Mélanie, 2026-10-15). Reste volontairement minimal : les infos pour
// passer l'appel, un bouton pour marquer fait, et un lien vers le dossier
// complet seulement si vraiment besoin de plus de contexte.
export default function AppelInfoModal({
  client,
  onClose,
  onOpenDossier,
  onMarquerFait,
}: {
  client: Client;
  onClose: () => void;
  onOpenDossier: () => void;
  onMarquerFait: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-base font-semibold text-[#171717]">Appel à venir</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="block text-xs font-medium text-neutral-500">Client</span>
            <span className="font-medium text-[#171717]">{client.nom}</span>
          </div>

          <div>
            <span className="block text-xs font-medium text-neutral-500">Téléphone</span>
            <span className="text-[#171717]">{client.telephone || "— non renseigné —"}</span>
          </div>

          <div>
            <span className="block text-xs font-medium text-neutral-500">Heure</span>
            <span className="text-[#171717]">
              {client.prochain_appel_heure || "?"}
              {client.prochain_appel_fuseau === "egypte" ? " (heure égyptienne)" : " (heure française)"}
            </span>
          </div>

          {client.prochain_appel_plateforme && (
            <div>
              <span className="block text-xs font-medium text-neutral-500">Plateforme</span>
              <span className="text-[#171717]">{client.prochain_appel_plateforme}</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onMarquerFait}
            className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Marquer l&apos;appel comme fait
          </button>
          <button
            type="button"
            onClick={onOpenDossier}
            className="w-full rounded-md border border-[#eaeaea] px-3 py-2 text-sm font-medium text-[#171717] hover:bg-neutral-50"
          >
            Ouvrir le dossier complet
          </button>
        </div>
      </div>
    </div>
  );
}
