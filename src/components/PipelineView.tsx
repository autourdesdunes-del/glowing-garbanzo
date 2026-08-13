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

function monthYearLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
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

  // Pour un prospect, ces champs "officiels" ne sont souvent pas encore
  // remplis — on retombe alors sur les estimations déduites par l'IA de la
  // conversation Kommo, plutôt que de n'afficher rien du tout.
  const moisSource = c.date_debut || c.kommo_sejour_debut_estime;
  const moisLabel = moisSource ? monthYearLabel(moisSource) : null;
  const paxAdultes = c.adultes || c.kommo_nb_adultes_estime || 0;
  const paxEnfants = c.enfants || c.kommo_nb_enfants_estime || 0;
  const paxLabel = paxAdultes || paxEnfants ? `${paxAdultes}${paxEnfants ? `+${paxEnfants}` : ""} pax` : null;
  const hotelLabel = c.hotel || c.kommo_hotel_estime || null;
  const hasMiniInfo = moisLabel || paxLabel || hotelLabel;

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
      {hasMiniInfo && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-neutral-400">
          {moisLabel && <span>📅 {moisLabel}</span>}
          {paxLabel && <span>👥 {paxLabel}</span>}
          {hotelLabel && <span className="truncate">🏨 {hotelLabel}</span>}
        </div>
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
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredClients = q
    ? clients.filter(
        (c) =>
          c.nom.toLowerCase().includes(q) ||
          c.hotel.toLowerCase().includes(q) ||
          (c.tags || []).some((tag) => tag.toLowerCase().includes(q))
      )
    : clients;

  const searchBar = (
    <div className="border-b border-[#666666]/15 bg-white px-6 py-2.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par nom, hôtel ou tag…"
        className="input w-full max-w-xs text-sm"
      />
    </div>
  );

  if (groupBy === "timing") {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {TIMING_BUCKETS.map((bucket) => {
          const items = filteredClients.filter(bucket.match);
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
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {searchBar}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
      {statuts.map((statut) => {
        const items = filteredClients.filter((c) => c.statut === statut);
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
    </div>
  );
}
