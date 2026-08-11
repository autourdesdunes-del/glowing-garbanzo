"use client";

import { useMemo, useState } from "react";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { paiementBadge, participantsFor, resaTotalMontant } from "@/lib/resa";
import { localDateStr } from "@/lib/dates";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtDateLong(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function toStr(d: Date) {
  return localDateStr(d);
}
function resaActiveOn(r: Reservation, dateStr: string) {
  if (!r.date_debut) return false;
  const end = r.date_fin || r.date_debut;
  return dateStr >= r.date_debut && dateStr <= end;
}
function rangesOverlap(rStart: string | null, rEnd: string | null, fStart: string, fEnd: string) {
  if (!rStart) return false;
  const end = rEnd || rStart;
  return rStart <= fEnd && end >= fStart;
}

const FILTERS = [
  { key: "hier", label: "Hier" },
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "demain", label: "Demain" },
  { key: "prochainement", label: "Prochainement" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "tout", label: "Tout" },
] as const;

const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function monthStartOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
// Grille complète semaine par semaine (lundi → dimanche), en débordant sur
// le mois précédent/suivant pour ne jamais avoir de semaine incomplète.
function buildMonthGrid(monthStartStr: string): string[] {
  const d = new Date(monthStartStr + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + endOffset);
  const days: string[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(toStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

type Row = { client: Client; r: Reservation };

function ReservationSummaryCard({
  client,
  r,
  resaOptions,
  resaTarifs,
  onClick,
}: {
  client: Client;
  r: Reservation;
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onClick: () => void;
}) {
  const options = resaOptions[r.id] || [];
  const total = resaTotalMontant(r, client, options, resaTarifs[r.id] || []);
  const { nbAd, nbEnf } = participantsFor(r, client);
  const soldeIci = client.solde_activite_id === r.id;
  const statutPaiement = soldeIci ? (client.solde_paye ? "Payé" : "À régler") : null;
  const infoStatut =
    client.infos_manquantes.length && !client.infos_manquantes.includes("Complet")
      ? client.infos_manquantes[0]
      : "Complet";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-3"
    >
      <p className="font-medium text-[#171717]">
        {r.nom_activite || "Activité"}
        {soldeIci && !client.solde_paye && (
          <span className="ml-2 text-xs text-red-600">⚠️ solde à régler ici</span>
        )}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {fmtDate(r.date_debut as string)}
        {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""} · {r.moment}
        {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
      </p>
      <p className="text-sm font-medium text-[#171717]">{client.nom || "Sans nom"}</p>
      <p className="mt-1 text-xs text-neutral-500">
        {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
      </p>
      <div className="mt-2 flex items-center justify-between">
        {soldeIci ? (
          <span className="rounded-full bg-[#f5a623] px-2 py-0.5 text-xs text-white">
            💰 Solde — {statutPaiement}
          </span>
        ) : (
          <span />
        )}
        <span className="font-amounts text-sm">{euros(total)} €</span>
      </div>
      <span
        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
          infoStatut === "Complet" ? "bg-[#171717]/10 text-[#171717]" : "bg-red-50 text-red-600"
        }`}
      >
        {infoStatut}
      </span>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-[#171717]">{children}</span>
    </div>
  );
}

function ActivityDetailModal({
  client,
  r,
  resaOptions,
  resaTarifs,
  onOpenClient,
  onClose,
}: {
  client: Client;
  r: Reservation;
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onOpenClient: (clientId: string) => void;
  onClose: () => void;
}) {
  const options = resaOptions[r.id] || [];
  const total = resaTotalMontant(r, client, options, resaTarifs[r.id] || []);
  const { nbAd, nbEnf } = participantsFor(r, client);
  const badge = paiementBadge(client, r);
  const soldeIci = client.solde_activite_id === r.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold text-[#171717]">
            {r.nom_activite || "Activité sans nom"}
          </h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-3">
          <DetailRow label="Client">
            <button
              type="button"
              onClick={() => {
                onOpenClient(client.id);
                onClose();
              }}
              className="text-[#171717] underline hover:no-underline"
            >
              {client.nom || "Sans nom"}
            </button>
          </DetailRow>
          <DetailRow label="Date">
            {fmtDate(r.date_debut || "")}
            {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
            {r.moment ? ` · ${r.moment}` : ""}
          </DetailRow>
          <DetailRow label="Paiement">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </DetailRow>
          <DetailRow label="Total">{euros(total)} €</DetailRow>
          <DetailRow label="PAX">
            {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
          </DetailRow>
          {r.pickup_reel && <DetailRow label="Pick-up">{r.pickup_reel}</DetailRow>}
          {soldeIci && (
            <DetailRow label="Solde">
              💰 Solde du séjour collecté ici — {client.solde_paye ? "Payé" : "À régler"}
            </DetailRow>
          )}
          {options.length > 0 && (
            <DetailRow label="Options">{options.map((o) => o.nom).join(", ")}</DetailRow>
          )}
          {r.info_importante && (
            <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              ⚠ {r.info_importante}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarMonthView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  onOpenActivity,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onOpenActivity: (row: Row) => void;
}) {
  const todayStr = toStr(new Date());
  const [monthCursor, setMonthCursor] = useState(() => monthStartOf(todayStr));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  const currentMonthIndex = new Date(monthCursor + "T00:00:00").getMonth();
  const selectedRows = selectedDay ? byDate.get(selectedDay) || [] : [];

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
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
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
              {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#C9973E]" />}
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
                  resaOptions={resaOptions}
                  resaTarifs={resaTarifs}
                  onClick={() => onOpenActivity(row)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanningView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onOpenClient: (clientId: string) => void;
}) {
  const [vue, setVue] = useState<"liste" | "calendrier">("liste");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("aujourdhui");
  const [activeActivity, setActiveActivity] = useState<Row | null>(null);

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toStr(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const prochainStart = new Date(today);
    prochainStart.setDate(today.getDate() + 2);
    const prochainEnd = new Date(today);
    prochainEnd.setDate(today.getDate() + 8);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const rows: Row[] = [];
    reservations.forEach((r) => {
      if (!r.date_debut) return;
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;

      let include = true;
      if (filter === "hier") include = resaActiveOn(r, toStr(yesterday));
      else if (filter === "aujourdhui") include = resaActiveOn(r, todayStr);
      else if (filter === "demain") include = resaActiveOn(r, toStr(tomorrow));
      else if (filter === "prochainement")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(prochainStart), toStr(prochainEnd));
      else if (filter === "mois")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(monthStart), toStr(monthEnd));
      if (!include) return;

      rows.push({ client, r });
    });

    rows.sort((a, b) => (a.r.date_debut || "").localeCompare(b.r.date_debut || ""));

    const byDate: Record<string, Row[]> = {};
    rows.forEach((row) => {
      const key = row.r.date_debut as string;
      byDate[key] = [...(byDate[key] || []), row];
    });
    return { byDate, todayStr };
  }, [clients, reservations, filter]);

  const dateKeys = Object.keys(grouped.byDate).sort();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-neutral-200 bg-white p-1">
          <button
            onClick={() => setVue("liste")}
            className={`rounded-full px-3 py-1 text-sm ${
              vue === "liste" ? "bg-[#171717] text-white" : "text-neutral-600"
            }`}
          >
            Liste
          </button>
          <button
            onClick={() => setVue("calendrier")}
            className={`rounded-full px-3 py-1 text-sm ${
              vue === "calendrier" ? "bg-[#171717] text-white" : "text-neutral-600"
            }`}
          >
            Calendrier
          </button>
        </div>
      </div>

      {vue === "calendrier" ? (
        <CalendarMonthView
          clients={clients}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          onOpenActivity={setActiveActivity}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  filter === f.key
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateKeys.length === 0 && (
            <div className="text-sm text-neutral-400">Aucune activité sur cette période.</div>
          )}

          {dateKeys.map((date) => (
            <div key={date}>
              <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
                {fmtDate(date)}
                {date === grouped.todayStr ? " — aujourd'hui" : ""}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {grouped.byDate[date].map((row) => (
                  <ReservationSummaryCard
                    key={row.r.id}
                    client={row.client}
                    r={row.r}
                    resaOptions={resaOptions}
                    resaTarifs={resaTarifs}
                    onClick={() => onOpenClient(row.client.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {activeActivity && (
        <ActivityDetailModal
          client={activeActivity.client}
          r={activeActivity.r}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          onOpenClient={onOpenClient}
          onClose={() => setActiveActivity(null)}
        />
      )}
    </div>
  );
}
