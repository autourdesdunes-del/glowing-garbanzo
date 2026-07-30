"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { STATUTS, STATUT_COLORS } from "@/lib/constants";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function PipelineView({
  clients,
  onUpdateStatut,
  onOpenClient,
}: {
  clients: Client[];
  onUpdateStatut: (id: string, statut: string) => void;
  onOpenClient: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatut, setOverStatut] = useState<string | null>(null);

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {STATUTS.map((statut) => {
        const items = clients.filter((c) => c.statut === statut);
        return (
          <div
            key={statut}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStatut(statut);
            }}
            onDragLeave={() => setOverStatut((s) => (s === statut ? null : s))}
            onDrop={() => {
              if (dragId) onUpdateStatut(dragId, statut);
              setDragId(null);
              setOverStatut(null);
            }}
            className={`flex w-64 flex-shrink-0 flex-col rounded-lg border p-2 ${
              overStatut === statut
                ? "border-[#5C2A1D] bg-[#F2E6D2]/60"
                : "border-[#8B4531]/15 bg-[#F2E6D2]/30"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUT_COLORS[statut] }}
              />
              <span className="text-xs font-semibold text-[#5C2A1D]">{statut}</span>
              <span className="ml-auto text-xs text-neutral-400">{items.length}</span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {items.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => onOpenClient(c.id)}
                  className={`cursor-grab rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing ${
                    dragId === c.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="font-medium text-[#5C2A1D]">{c.nom || "Sans nom"}</div>
                  {c.date_debut && (
                    <div className="font-amounts mt-1 text-xs text-neutral-400">
                      {fmtDate(c.date_debut)}
                    </div>
                  )}
                  {c.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#F2E6D2] px-1.5 py-0.5 text-[10px] text-[#5C2A1D]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <div className="p-2 text-center text-xs text-neutral-300">Vide</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
