"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { normText } from "@/lib/duplicates";

// Petite fenêtre de recherche pour rattacher une action (ex. nouvelle
// activité depuis le dashboard) à un client déjà existant, sans avoir à
// ouvrir sa fiche d'abord pour le retrouver.
export default function PickClientModal({
  clients,
  title,
  onSelect,
  onClose,
}: {
  clients: Client[];
  title: string;
  onSelect: (clientId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const clean = normText(query);
  const results = clean
    ? clients.filter((c) => normText(c.nom).includes(clean) || normText(c.telephone).includes(clean)).slice(0, 30)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-[6px] border border-[#eaeaea] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-[#171717]">{title}</h2>
          <button type="button" onClick={onClose} className="text-[#666666] hover:text-[#171717]">
            ✕
          </button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom ou téléphone du client…"
          className="input w-full"
        />
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex w-full items-center justify-between rounded-md border border-[#eaeaea] px-3 py-2 text-left text-sm hover:border-[#C9973E]"
            >
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-[#171717]">{c.nom || "Sans nom"}</span>
                {c.statut === "Client annulé" && (
                  // Peut aussi être une fiche fusionnée (fusionnerClients,
                  // AppShell.tsx), donc vidée de son historique au profit
                  // d'une autre fiche — ce badge évite de la confondre avec
                  // la bonne fiche sans empêcher un cas légitime (ex. un
                  // remboursement tardif sur un client réellement annulé).
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    Annulé
                  </span>
                )}
              </span>
              <span className="text-xs text-[#666666]">{c.telephone}</span>
            </button>
          ))}
          {clean && results.length === 0 && (
            <p className="px-1 text-sm text-[#666666]">Aucun client trouvé.</p>
          )}
        </div>
      </div>
    </div>
  );
}
