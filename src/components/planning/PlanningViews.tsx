"use client";

import { useMemo, useState } from "react";
import {
  CatalogueItem,
  Client,
  HotelReference,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { cleanActivityTitle, participantsFor } from "@/lib/resa";
import { fmtAnnulationSuffix } from "@/lib/dates";
import { baseActivityName } from "@/lib/egyptBlock";
import {
  addMonths,
  buildMonthGrid,
  dateRangeIncludes,
  fmtDate,
  fmtDateLong,
  monthEndOf,
  monthLabel,
  monthStartOf,
  resaActiveOn,
  toStr,
  WEEKDAY_LABELS,
} from "@/lib/planningViewFormat";
import { ReservationSummaryCard, Row } from "@/components/planning/PlanningCards";

// Les deux vues alternatives de Réservations (calendrier mensuel, et
// regroupement par activité) — extraites de PlanningView.tsx pour
// l'alléger, sans changement de comportement.

export function CalendarMonthView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  hotelsRef = [],
  onOpenActivity,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  hotelsRef?: HotelReference[];
  onOpenActivity: (row: Row) => void;
  onOpenClient: (clientId: string) => void;
}) {
  const todayStr = toStr(new Date());
  const [monthCursor, setMonthCursor] = useState(() => monthStartOf(todayStr));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAnnulees, setShowAnnulees] = useState(false);

  const clientById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const gridDays = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    gridDays.forEach((day) => {
      const rows: Row[] = [];
      reservations.forEach((r) => {
        if (!resaActiveOn(r, day)) return;
        const client = clientById.get(r.client_id);
        if (!client) return;
        rows.push({ client, r });
      });
      rows.sort((a, b) => (a.r.moment || "").localeCompare(b.r.moment || ""));
      map.set(day, rows);
    });
    return map;
  }, [gridDays, reservations, clientById]);

  // Les activités annulées n'apparaissent plus sur la pastille du jour, mais
  // restent consultables au clic — repliées par défaut, pour retrouver une
  // annulation sans polluer la vue du jour au quotidien.
  const byDateAnnulees = useMemo(() => {
    const map = new Map<string, Row[]>();
    gridDays.forEach((day) => {
      const rows: Row[] = [];
      reservations.forEach((r) => {
        if (r.statut_resa !== "Annulée") return;
        if (!dateRangeIncludes(r, day)) return;
        const client = clientById.get(r.client_id);
        if (!client) return;
        rows.push({ client, r });
      });
      rows.sort((a, b) => (a.r.moment || "").localeCompare(b.r.moment || ""));
      map.set(day, rows);
    });
    return map;
  }, [gridDays, reservations, clientById]);

  const currentMonthIndex = new Date(monthCursor + "T00:00:00").getMonth();
  const selectedRows = selectedDay ? byDate.get(selectedDay) || [] : [];
  const selectedRowsAnnulees = selectedDay ? byDateAnnulees.get(selectedDay) || [] : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold capitalize text-[#171717]">
          {monthLabel(monthCursor)}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthCursor((m) => addMonths(m, -1))}
            className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setMonthCursor(monthStartOf(todayStr))}
            className="rounded-md border border-neutral-200 px-3 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="bg-[#fafafa] py-1.5 text-xs font-medium text-neutral-500">
            {w}
          </div>
        ))}
        {gridDays.map((day) => {
          const d = new Date(day + "T00:00:00");
          const inMonth = d.getMonth() === currentMonthIndex;
          const isToday = day === todayStr;
          const count = (byDate.get(day) || []).length;
          const countAnnulees = (byDateAnnulees.get(day) || []).length;
          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                setSelectedDay(day);
                setShowAnnulees(false);
              }}
              className={`flex min-h-[60px] flex-col items-center gap-1 bg-white py-2 hover:bg-[#fafafa] ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-[#5C2A1D] text-white" : "text-[#171717]"
                }`}
              >
                {d.getDate()}
              </span>
              {(count > 0 || countAnnulees > 0) && (
                <span className="flex items-center gap-1">
                  {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#C9973E]" />}
                  {countAnnulees > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-300" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-base font-semibold capitalize text-[#171717]">
                {fmtDateLong(selectedDay)}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-neutral-400 hover:text-[#171717]"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {selectedRows.length === 0 && (
                <div className="text-sm text-neutral-400">Aucune activité ce jour-là.</div>
              )}
              {selectedRows.map((row) => (
                <ReservationSummaryCard
                  key={row.r.id}
                  client={row.client}
                  r={row.r}
                  reservations={reservations}
                  resaOptions={resaOptions}
                  resaTarifs={resaTarifs}
                  paiementsEtapes={paiementsEtapes}
                  hotelsRef={hotelsRef}
                  onClick={() => onOpenActivity(row)}
                  onOpenClient={onOpenClient}
                />
              ))}

              {selectedRowsAnnulees.length > 0 && (
                <div className="border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAnnulees((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-medium text-neutral-500 hover:text-[#171717]"
                  >
                    <span>
                      {selectedRowsAnnulees.length} activité{selectedRowsAnnulees.length > 1 ? "s" : ""} annulée
                      {selectedRowsAnnulees.length > 1 ? "s" : ""} ce jour-là
                    </span>
                    <span className="text-neutral-400">{showAnnulees ? "▲" : "▼"}</span>
                  </button>
                  {showAnnulees && (
                    <div className="mt-2 space-y-2">
                      {selectedRowsAnnulees.map((row) => (
                        <div
                          key={row.r.id}
                          onClick={() => onOpenActivity(row)}
                          className="cursor-pointer rounded-md border border-red-100 bg-red-50/40 p-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate font-medium text-[#171717] line-through decoration-red-400">
                              {cleanActivityTitle(row.r.nom_activite) || "Activité"}
                            </p>
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                              Annulée
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenClient(row.client.id);
                            }}
                            className="mt-0.5 text-xs font-medium text-[#171717] hover:underline"
                          >
                            {row.client.nom || "Sans nom"}
                          </button>
                          {row.r.annulation_raison && (
                            <p className="mt-0.5 text-xs text-neutral-500">
                              {row.r.annulation_raison}{" "}
                              {fmtAnnulationSuffix(row.r.annulation_date, row.r.annulation_heure)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Regroupe toutes les activités à venir par catégorie (ex. tous les "Louxor
// en mini-bus", toutes les "Tortues"...) puis par date — pour repérer d'un
// coup d'œil les jours où grouper plusieurs clients sur la même sortie.
export function ByActivityView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  hotelsRef = [],
  catalogue,
  onOpenActivity,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  hotelsRef?: HotelReference[];
  catalogue: CatalogueItem[];
  onOpenActivity: (row: Row) => void;
  onOpenClient: (clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const todayStr = toStr(new Date());
  const [monthFilter, setMonthFilter] = useState<string>("a_venir");

  const monthOptions = useMemo(() => {
    const base = monthStartOf(todayStr);
    const opts: { value: string; label: string }[] = [];
    for (let i = -3; i <= 12; i++) {
      const m = addMonths(base, i);
      opts.push({ value: m, label: monthLabel(m) });
    }
    return opts;
  }, [todayStr]);

  const categoryLabel = (r: Reservation) => {
    if (r.catalogue_item_id) {
      const item = catalogue.find((c) => c.id === r.catalogue_item_id);
      if (item) return item.nom;
    }
    return baseActivityName(r.nom_activite) || "Sans nom";
  };

  const categories = useMemo(() => {
    const monthEnd = monthFilter !== "a_venir" ? monthEndOf(monthFilter) : "";
    const byCategory = new Map<string, { label: string; byDate: Map<string, Row[]> }>();
    reservations.forEach((r) => {
      if (!r.date_debut) return;
      // Sans ce filtre, une activité annulée gonflait quand même le compteur
      // "X à venir" et apparaissait comme une carte normale — alors que
      // toutes les autres vues de ce fichier (liste principale, calendrier)
      // excluent déjà les annulées.
      if (r.statut_resa === "Annulée") return;
      if (monthFilter === "a_venir") {
        if (r.date_debut < todayStr) return;
      } else if (r.date_debut < monthFilter || r.date_debut > monthEnd) {
        return;
      }
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;
      const label = categoryLabel(r);
      const key = r.catalogue_item_id || `custom:${label}`;
      if (!byCategory.has(key)) byCategory.set(key, { label, byDate: new Map() });
      const cat = byCategory.get(key)!;
      cat.byDate.set(r.date_debut, [...(cat.byDate.get(r.date_debut) || []), { client, r }]);
    });
    return Array.from(byCategory.values())
      .map((cat) => ({
        label: cat.label,
        total: Array.from(cat.byDate.values()).reduce((s, rows) => s + rows.length, 0),
        dates: Array.from(cat.byDate.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      }))
      .filter((cat) => cat.label.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, reservations, catalogue, query, todayStr, monthFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par activité (ex. Louxor, Tortues, dauphins…)"
          className="input flex-1"
        />
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="input w-auto capitalize"
        >
          <option value="a_venir">À venir</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value} className="capitalize">
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {categories.length === 0 && (
        <div className="text-sm text-neutral-400">
          {monthFilter === "a_venir" ? "Aucune activité à venir." : "Aucune activité ce mois-ci."}
        </div>
      )}

      {categories.map((cat) => {
        const isOpen = !!openCategories[cat.label];
        return (
          <div key={cat.label} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenCategories((prev) => ({ ...prev, [cat.label]: !prev[cat.label] }))}
              className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[#fafafa]"
            >
              <span className="font-heading text-sm font-semibold text-[#171717]">{cat.label}</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                  {cat.total} à venir
                </span>
                <span className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ⌄
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="space-y-4 border-t border-neutral-100 p-4">
                {cat.dates.map(([date, rows]) => {
                  const pax = rows.reduce((s, row) => {
                    const { nbAd, nbEnf } = participantsFor(row.r, row.client);
                    return s + nbAd + nbEnf;
                  }, 0);
                  return (
                    <div key={date}>
                      <h4 className="mb-2 text-xs font-semibold text-neutral-500">
                        {fmtDate(date)}
                        {date === todayStr ? " — aujourd'hui" : ""} · {rows.length} réservation
                        {rows.length > 1 ? "s" : ""}, {pax} pers.
                      </h4>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {rows.map((row) => (
                          <ReservationSummaryCard
                            key={row.r.id}
                            client={row.client}
                            r={row.r}
                            reservations={reservations}
                            resaOptions={resaOptions}
                            resaTarifs={resaTarifs}
                            paiementsEtapes={paiementsEtapes}
                            hotelsRef={hotelsRef}
                            onClick={() => onOpenActivity(row)}
                            onOpenClient={onOpenClient}
                            size="compact"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
