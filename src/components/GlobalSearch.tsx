"use client";

import { useMemo, useState } from "react";
import { Client, Reservation } from "@/lib/types";

export default function GlobalSearch({
  clients,
  reservations,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  onOpenClient: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const q = query.trim().toLowerCase();

  const matchedClients = useMemo(() => {
    if (q.length < 2) return [];
    return clients
      .filter(
        (c) =>
          (c.nom || "").toLowerCase().includes(q) || (c.telephone || "").includes(q)
      )
      .slice(0, 5);
  }, [clients, q]);

  const matchedReservations = useMemo(() => {
    if (q.length < 2) return [];
    return reservations
      .filter((r) => (r.nom_activite || "").toLowerCase().includes(q))
      .slice(0, 5);
  }, [reservations, q]);

  const hasResults = matchedClients.length > 0 || matchedReservations.length > 0;

  const select = (clientId: string) => {
    onOpenClient(clientId);
    setQuery("");
    setFocused(false);
  };

  return (
    <div className="relative w-72">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Rechercher un client, une activité…"
        className="input"
      />
      {focused && q.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
          {!hasResults && (
            <div className="p-3 text-sm text-neutral-400">Aucun résultat.</div>
          )}
          {matchedClients.length > 0 && (
            <div>
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Clients
              </div>
              {matchedClients.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={() => select(c.id)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F2E6D2]"
                >
                  <span className="font-medium text-[#5C2A1D]">{c.nom || "Sans nom"}</span>
                  {c.telephone && (
                    <span className="ml-2 text-xs text-neutral-400">{c.telephone}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {matchedReservations.length > 0 && (
            <div>
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Activités
              </div>
              {matchedReservations.map((r) => {
                const c = clients.find((cl) => cl.id === r.client_id);
                return (
                  <button
                    key={r.id}
                    onMouseDown={() => select(r.client_id)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F2E6D2]"
                  >
                    <span className="font-medium text-[#5C2A1D]">
                      {r.nom_activite || "Activité sans nom"}
                    </span>
                    <span className="ml-2 text-xs text-neutral-400">
                      {c?.nom || "Sans nom"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
