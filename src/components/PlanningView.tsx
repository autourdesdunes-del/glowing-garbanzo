"use client";

import { useMemo, useState } from "react";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import {
  acompteWaitingWarning,
  activitePaiementWarning,
  chevalChameauBadge,
  cleanActivityTitle,
  momentBadge,
  paiementBadge,
  participantsFor,
  resaBreakdown,
  resaTotalMontant,
} from "@/lib/resa";
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
  reservations,
  resaOptions,
  resaTarifs,
  onClick,
  onOpenClient,
}: {
  client: Client;
  r: Reservation;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onClick: () => void;
  onOpenClient: (clientId: string) => void;
}) {
  const options = resaOptions[r.id] || [];
  const total = resaTotalMontant(r, client, options, resaTarifs[r.id] || []);
  const { nbAd, nbEnf } = participantsFor(r, client);
  const badge = paiementBadge(client, r);
  // Le calcul du montant restant a besoin des réservations de CE client
  // uniquement — jamais du tableau global toutes activités confondues, sous
  // peine de sommer les montants de plusieurs clients (bug déjà rencontré).
  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
  const paiementWarning = activitePaiementWarning(client, r, clientReservations, resaOptions, resaTarifs);
  const infoComplet = !client.infos_manquantes.length || client.infos_manquantes.includes("Complet");
  const infoStatut = infoComplet ? null : client.infos_manquantes[0];

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-[#171717]">
          {cleanActivityTitle(r.nom_activite) || "Activité"}
          {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
        </p>
        {momentBadge(r) && (
          <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
            {momentBadge(r)}
          </span>
        )}
        {chevalChameauBadge(r, client) && (
          <span className="rounded-full bg-[#8B4531] px-2 py-0.5 text-xs font-semibold text-white">
            {chevalChameauBadge(r, client)}
          </span>
        )}
        {paiementWarning && (
          <span className="text-xs font-medium text-red-600">
            ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {fmtDate(r.date_debut as string)}
        {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
      </p>
      {r.pickup_reel && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#0F5C56]">
          🚐 Pick-up {r.pickup_reel}
        </p>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenClient(client.id);
        }}
        className="text-sm font-medium text-[#171717] hover:underline"
      >
        {client.nom || "Sans nom"}
      </button>
      <p className="mt-1 text-xs text-neutral-500">
        {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
        {nbEnf > 0 && client.ages_enfants ? ` (âges : ${client.ages_enfants})` : ""}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-base font-semibold text-[#171717]">{euros(total)} €</span>
      </div>
      {infoComplet ? (
        <p className="mt-2 text-[10px] text-neutral-400">dossier complet ✔️</p>
      ) : (
        <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
          {infoStatut}
        </span>
      )}
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
  reservations,
  resaOptions,
  resaTarifs,
  onOpenClient,
  onOpenActivity,
  onClose,
}: {
  client: Client;
  r: Reservation;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onOpenClient: (clientId: string) => void;
  onOpenActivity: (r: Reservation) => void;
  onClose: () => void;
}) {
  const [showSoldeDetail, setShowSoldeDetail] = useState(false);
  const options = resaOptions[r.id] || [];
  const tarifs = resaTarifs[r.id] || [];
  const total = resaTotalMontant(r, client, options, tarifs);
  const breakdown = resaBreakdown(r, client, options, tarifs);
  const { nbAd, nbEnf } = participantsFor(r, client);
  const badge = paiementBadge(client, r);
  const soldeIci = client.solde_activite_id === r.id;
  // Le calcul du restant à payer a besoin des réservations de CE client
  // uniquement — jamais du tableau global toutes activités confondues.
  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
  // Le solde peut être en attente de règlement sur une AUTRE activité déjà
  // identifiée (solde_activite_id pointe ailleurs) — dans ce cas on
  // renseigne où et quand, plutôt que de ne rien dire du tout.
  const soldeActiviteAilleurs =
    !soldeIci && !client.solde_paye && client.solde_activite_id
      ? clientReservations.find((rr) => rr.id === client.solde_activite_id) || null
      : null;
  // Solde en attente sans aucune activité de collecte identifiée — un trou
  // dans le suivi qui doit se voir, sous peine de finir sans jamais être
  // encaissé.
  const soldeSansActivite = !soldeIci && !client.solde_paye && !client.solde_activite_id;
  const [showSoldeSansActiviteAlert, setShowSoldeSansActiviteAlert] = useState(soldeSansActivite);
  const paiementWarning = activitePaiementWarning(client, r, clientReservations, resaOptions, resaTarifs);
  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);

  return (
    <>
      {showSoldeSansActiviteAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-300 bg-white p-5 shadow-xl">
            <p className="text-sm font-medium text-red-700">
              ⚠️ Solde du séjour en attente — pas encore rattaché à une activité de collecte, à
              surveiller. Souhaitez-vous définir un paiement pour cette activité/ce client ?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenClient(client.id);
                  onClose();
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Oui, définir un paiement
              </button>
              <button
                type="button"
                onClick={() => setShowSoldeSansActiviteAlert(false)}
                className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:underline"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-lg font-semibold text-[#171717]">
                {cleanActivityTitle(r.nom_activite) || "Activité sans nom"}
                {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
            </h3>
            {momentBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {momentBadge(r)}
              </span>
            )}
            {chevalChameauBadge(r, client) && (
              <span className="rounded-full bg-[#8B4531] px-2 py-0.5 text-xs font-semibold text-white">
                {chevalChameauBadge(r, client)}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        {(paiementWarning || acompteWarning) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {acompteWarning && (
              <span className="text-xs font-medium text-yellow-700">
                ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
              </span>
            )}
            {paiementWarning && (
              <span className="text-xs font-medium text-red-600">
                ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
              </span>
            )}
          </div>
        )}

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
          </DetailRow>
          {r.pickup_reel && (
            <DetailRow label="Pick-up">
              <span className="text-[#0F5C56]">🚐 {r.pickup_reel}</span>
            </DetailRow>
          )}
          <DetailRow label="PAX">
            {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
            {nbEnf > 0 && client.ages_enfants ? ` (âges : ${client.ages_enfants})` : ""}
          </DetailRow>
          <DetailRow label="Paiement">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </DetailRow>
          <DetailRow label="Total">{euros(total)} €</DetailRow>
        </div>

        {breakdown.length > 0 && (
          <div className="mt-1 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
            {breakdown.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span>{line.label}</span>
                <span>= {euros(line.amount)} €</span>
              </div>
            ))}
          </div>
        )}

        {(soldeIci || soldeActiviteAilleurs) && (
          <div className="mt-3 rounded-md bg-[#C9973E]/10 p-3 text-sm">
            <div className="flex w-full items-center justify-between gap-2 font-medium text-[#8B4531]">
              <button
                type="button"
                onClick={() => setShowSoldeDetail((v) => !v)}
                className="flex-1 text-left"
              >
                {soldeIci ? (
                  `💰 Solde du séjour collecté ici — ${client.solde_paye ? "Payé" : "À régler"}`
                ) : (
                  <>
                    💰 Solde du séjour collecté ultérieurement —{" "}
                    <span
                      role="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenActivity(soldeActiviteAilleurs!);
                      }}
                      className="underline hover:no-underline"
                    >
                      {cleanActivityTitle(soldeActiviteAilleurs!.nom_activite) || "Activité"}
                      {soldeActiviteAilleurs!.date_debut
                        ? ` (${fmtDate(soldeActiviteAilleurs!.date_debut)})`
                        : ""}
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSoldeDetail((v) => !v)}
                className="shrink-0 text-xs"
              >
                {showSoldeDetail ? "▲" : "▼"}
              </button>
            </div>
            {showSoldeDetail && (
              <div className="mt-2 space-y-1 border-t border-[#C9973E]/30 pt-2 text-xs text-[#8B4531]">
                {client.paiement_type === "acompte" && client.acompte_valide && (
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      Acompte — {client.acompte_mode}
                      {client.acompte_paye && client.acompte_date_encaissement
                        ? ` (encaissé le ${fmtDate(client.acompte_date_encaissement)})`
                        : client.acompte_paye
                        ? " (encaissé)"
                        : " (à encaisser)"}
                    </span>
                    <span>{euros(client.acompte_montant)} €</span>
                  </div>
                )}
                {clientReservations.map((rr) => (
                  <button
                    type="button"
                    key={rr.id}
                    onClick={() => onOpenActivity(rr)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span>
                      {cleanActivityTitle(rr.nom_activite) || "Activité"}
                      {rr.date_debut ? ` (${fmtDate(rr.date_debut)})` : ""}
                    </span>
                    <span>
                      {euros(resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []))} €
                    </span>
                  </button>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-[#C9973E]/30 pt-1 font-semibold">
                  <span>Total séjour</span>
                  <span>
                    {euros(
                      clientReservations.reduce(
                        (s, rr) =>
                          s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
                        0
                      )
                    )}{" "}
                    €
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {soldeSansActivite && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700">
            ⚠️ Solde du séjour en attente — pas encore rattaché à une activité de collecte, à surveiller.
          </div>
        )}

        {r.info_importante && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ {r.info_importante}
          </div>
        )}
        </div>
      </div>
    </>
  );
}

function CalendarMonthView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  onOpenActivity,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onOpenActivity: (row: Row) => void;
  onOpenClient: (clientId: string) => void;
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
                  reservations={reservations}
                  resaOptions={resaOptions}
                  resaTarifs={resaTarifs}
                  onClick={() => onOpenActivity(row)}
                  onOpenClient={onOpenClient}
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
  const [vue, setVue] = useState<"liste" | "calendrier">("calendrier");
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
          onOpenClient={onOpenClient}
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
                    reservations={reservations}
                    resaOptions={resaOptions}
                    resaTarifs={resaTarifs}
                    onClick={() => setActiveActivity(row)}
                    onOpenClient={onOpenClient}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {activeActivity && (
        <ActivityDetailModal
          key={activeActivity.r.id}
          client={activeActivity.client}
          r={activeActivity.r}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          onOpenClient={onOpenClient}
          onOpenActivity={(rr) => setActiveActivity({ client: activeActivity.client, r: rr })}
          onClose={() => setActiveActivity(null)}
        />
      )}
    </div>
  );
}
