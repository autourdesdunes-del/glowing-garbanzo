"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { STATUT_COLORS } from "@/lib/constants";
import { todayStr } from "@/lib/dates";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date(todayStr() + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// Pour les clients confirmés, le statut seul (Confirmé/Perdu) ne distingue
// rien d'utile — tout le monde termine dans la même colonne. On regroupe
// plutôt par proximité du séjour : c'est ce qui détermine l'urgence
// opérationnelle (pick-up, solde, billets…), pas le statut administratif.
const TIMING_BUCKETS = [
  {
    key: "en_egypte",
    label: "En Égypte",
    match: (c: Client) =>
      !!c.date_debut &&
      !!c.date_fin &&
      todayStr() >= c.date_debut &&
      todayStr() <= c.date_fin,
  },
  {
    key: "j7",
    label: "J-7",
    match: (c: Client) => {
      if (!c.date_debut) return false;
      if (c.date_fin && todayStr() >= c.date_debut && todayStr() <= c.date_fin) return false;
      const d = daysUntil(c.date_debut);
      return d >= 0 && d <= 7;
    },
  },
  {
    key: "j30",
    label: "J-30",
    match: (c: Client) => !!c.date_debut && daysUntil(c.date_debut) > 7 && daysUntil(c.date_debut) <= 30,
  },
  {
    key: "j90",
    label: "J-90",
    match: (c: Client) => !!c.date_debut && daysUntil(c.date_debut) > 30 && daysUntil(c.date_debut) <= 90,
  },
  {
    key: "plus_tard",
    label: "Plus tard / date à définir",
    match: (c: Client) => !c.date_debut || daysUntil(c.date_debut) > 90,
  },
  {
    key: "termine",
    label: "Séjour terminé",
    match: (c: Client) => {
      if (!c.date_debut) return false;
      if (c.date_fin && todayStr() >= c.date_debut && todayStr() <= c.date_fin) return false;
      return daysUntil(c.date_debut) < 0;
    },
  },
] as const;

function ClientCard({
  client: c,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onOpenClient,
  showIncompleteBadge,
}: {
  client: Client;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpenClient: (id: string) => void;
  showIncompleteBadge: boolean;
}) {
  const missingInfos = showIncompleteBadge
    ? (c.infos_manquantes || []).filter((s) => s !== "Complet")
    : [];
  const incomplete = missingInfos.length > 0;
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpenClient(c.id)}
      className={`rounded-md border border-[#eaeaea] bg-white p-3 text-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-[#171717]">{c.nom || "Sans nom"}</div>
        {incomplete && (
          <span
            title={missingInfos.join(", ")}
            className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-500"
          />
        )}
      </div>
      {c.date_debut && (
        <div className="font-amounts mt-1 text-xs text-neutral-400">{fmtDate(c.date_debut)}</div>
      )}
      {incomplete && (
        <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
          <span>⚠</span>
          <span>{missingInfos.join(", ")}</span>
        </div>
      )}
      {(c.tags || []).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {(c.tags || []).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#fafafa] px-1.5 py-0.5 text-[10px] text-[#171717]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PipelineView({
  clients,
  statuts,
  groupBy = "statut",
  onUpdateStatut,
  onOpenClient,
}: {
  clients: Client[];
  statuts: readonly string[];
  groupBy?: "statut" | "timing";
  onUpdateStatut: (id: string, statut: string) => void;
  onOpenClient: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatut, setOverStatut] = useState<string | null>(null);

  if (groupBy === "timing") {
    return (
      <div className="flex h-full gap-4 overflow-x-auto p-6">
        {TIMING_BUCKETS.map((bucket) => {
          const items = clients.filter(bucket.match);
          return (
            <div
              key={bucket.key}
              className="flex w-64 flex-shrink-0 flex-col rounded-lg border border-[#666666]/15 bg-[#fafafa]/30 p-2"
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="text-xs font-semibold text-[#171717]">{bucket.label}</span>
                <span className="ml-auto text-xs text-neutral-400">{items.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {items.map((c) => (
                  <ClientCard
                    key={c.id}
                    client={c}
                    draggable={false}
                    dragging={false}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    onOpenClient={onOpenClient}
                    showIncompleteBadge
                  />
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

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {statuts.map((statut) => {
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
                ? "border-[#171717] bg-[#fafafa]/60"
                : "border-[#666666]/15 bg-[#fafafa]/30"
            }`}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUT_COLORS[statut] }}
              />
              <span className="text-xs font-semibold text-[#171717]">{statut}</span>
              <span className="ml-auto text-xs text-neutral-400">{items.length}</span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {items.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  draggable
                  dragging={dragId === c.id}
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  onOpenClient={onOpenClient}
                  showIncompleteBadge={false}
                />
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
