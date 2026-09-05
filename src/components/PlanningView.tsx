"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueItem,
  Client,
  HotelReference,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import {
  addMonths,
  FILTERS,
  fmtDate,
  monthLabel,
  monthStartOf,
  rangesOverlap,
  resaActiveOn,
  toStr,
} from "@/lib/planningViewFormat";
import { ReservationSummaryCard, Row } from "@/components/planning/PlanningCards";
import { ByActivityView, CalendarMonthView } from "@/components/planning/PlanningViews";
import { ActivityDetailModal } from "@/components/planning/ActivityDetailModal";


type PlanningSub = "aujourdhui" | "demain" | "calendrier" | "par_activite";

function subToVue(sub: PlanningSub): "liste" | "calendrier" | "par_activite" {
  if (sub === "calendrier") return "calendrier";
  if (sub === "par_activite") return "par_activite";
  return "liste";
}

export default function PlanningView({
  sub,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  catalogue,
  onOpenClient,
  onOpenRdvPaiement,
  focusReservationId,
  onBackToBillet,
}: {
  sub: PlanningSub;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  catalogue: CatalogueItem[];
  onOpenClient: (clientId: string) => void;
  onOpenRdvPaiement: (clientId: string) => void;
  focusReservationId?: string | null;
  onBackToBillet?: () => void;
}) {
  const [vue, setVue] = useState<"liste" | "calendrier" | "par_activite">(subToVue(sub));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>(
    sub === "demain" ? "demain" : "aujourdhui"
  );
  const [activeActivity, setActiveActivity] = useState<Row | null>(null);
  const [moisChoisi, setMoisChoisi] = useState(() => monthStartOf(toStr(new Date())));
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("hotels_reference").select("*");
      setHotelsRef((data as HotelReference[]) || []);
    })();
  }, []);

  // Sync depuis le sous-menu de gauche : comparaison en render (pas de
  // useEffect) pour éviter react-hooks/set-state-in-effect, cf. pattern déjà
  // utilisé pour lastConsumedRdvId dans SuivisView.tsx.
  const [lastSub, setLastSub] = useState(sub);
  if (sub !== lastSub) {
    setLastSub(sub);
    setVue(subToVue(sub));
    if (sub === "aujourdhui" || sub === "demain") setFilter(sub);
  }

  // Ouvre directement l'activité visée depuis "Voir l'activité" (fiche
  // détail d'un billet dans Suivis) — même pattern de synchronisation.
  const [lastFocusId, setLastFocusId] = useState<string | null | undefined>(undefined);
  if (focusReservationId && focusReservationId !== lastFocusId) {
    setLastFocusId(focusReservationId);
    const r = reservations.find((rr) => rr.id === focusReservationId);
    const client = r && clients.find((c) => c.id === r.client_id);
    if (r && client) setActiveActivity({ client, r });
  }

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
    const moisChoisiDebut = new Date(moisChoisi + "T00:00:00");
    const moisChoisiFin = new Date(moisChoisiDebut.getFullYear(), moisChoisiDebut.getMonth() + 1, 0);

    const rows: Row[] = [];
    reservations.forEach((r) => {
      if (!r.date_debut) return;
      // "Prochainement"/"Ce mois-ci"/mois choisi utilisaient rangesOverlap
      // seul, sans exclure les annulées (contrairement à Hier/Aujourd'hui/
      // Demain via resaActiveOn) — une activité annulée réapparaissait donc
      // comme si de rien n'était dès qu'on changeait de filtre ou de mois.
      if (r.statut_resa === "Annulée") return;
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
      else if (filter === "mois_choisi")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(moisChoisiDebut), toStr(moisChoisiFin));
      if (!include) return;

      rows.push({ client, r });
    });

    rows.sort((a, b) => (a.r.date_debut || "").localeCompare(b.r.date_debut || ""));

    // "Hier"/"Aujourd'hui"/"Demain" ne montrent qu'un seul jour à la fois —
    // regrouper par date_debut de chaque activité y affichait la date de
    // DÉBUT d'une activité sur plusieurs jours (ex. "31 août" pour une
    // croisière en cours) au lieu du jour réellement consulté, ce qui
    // donnait l'impression d'être resté sur un autre jour. Un seul groupe,
    // sous le jour du filtre, pour ces trois vues.
    const filterDateSingle =
      filter === "hier" ? toStr(yesterday) : filter === "aujourdhui" ? todayStr : filter === "demain" ? toStr(tomorrow) : null;

    const byDate: Record<string, Row[]> = {};
    rows.forEach((row) => {
      const key = filterDateSingle || (row.r.date_debut as string);
      byDate[key] = [...(byDate[key] || []), row];
    });
    return { byDate, todayStr };
  }, [clients, reservations, filter, moisChoisi]);

  const dateKeys = Object.keys(grouped.byDate).sort();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      {vue === "calendrier" ? (
        <CalendarMonthView
          clients={clients}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          hotelsRef={hotelsRef}
          onOpenActivity={setActiveActivity}
          onOpenClient={onOpenClient}
        />
      ) : vue === "par_activite" ? (
        <ByActivityView
          clients={clients}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          hotelsRef={hotelsRef}
          catalogue={catalogue}
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

          {filter === "mois_choisi" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMoisChoisi((m) => addMonths(m, -1))}
                className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
              >
                ‹
              </button>
              <span className="font-heading text-sm font-semibold capitalize text-[#171717]">
                {monthLabel(moisChoisi)}
              </span>
              <button
                type="button"
                onClick={() => setMoisChoisi((m) => addMonths(m, 1))}
                className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
              >
                ›
              </button>
            </div>
          )}

          {dateKeys.length === 0 && (
            <div className="text-sm text-neutral-400">Aucune activité sur cette période.</div>
          )}

          {dateKeys.map((date) => (
            <div key={date}>
              <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
                {fmtDate(date)}
                {date === grouped.todayStr ? " — aujourd'hui" : ""}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.byDate[date].map((row) => (
                  <ReservationSummaryCard
                    key={row.r.id}
                    client={row.client}
                    r={row.r}
                    reservations={reservations}
                    resaOptions={resaOptions}
                    resaTarifs={resaTarifs}
                    paiementsEtapes={paiementsEtapes}
                    hotelsRef={hotelsRef}
                    onClick={() => setActiveActivity(row)}
                    onOpenClient={onOpenClient}
                    size="medium"
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
          paiementsEtapes={paiementsEtapes}
          onOpenClient={onOpenClient}
          onOpenActivity={(rr) => setActiveActivity({ client: activeActivity.client, r: rr })}
          onOpenRdvPaiement={onOpenRdvPaiement}
          hotelsRef={hotelsRef}
          onClose={() => setActiveActivity(null)}
          onBack={activeActivity.r.id === focusReservationId ? onBackToBillet : undefined}
        />
      )}
    </div>
  );
}
