"use client";

import { useEffect, useState } from "react";

type Range = "day" | "week" | "month";

type MessagesStats = {
  trend: { label: string; in: number; out: number }[];
  byHour: { hour: number; in: number; out: number }[];
};

type ReservationsStats = {
  trend: { label: string; count: number }[];
  byEmployee: { nom: string; count: number }[];
  matin: number;
  apresMidi: number;
};

type StatsResponse = {
  range: Range;
  messages: MessagesStats;
  reservations: ReservationsStats;
};

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
];

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.key ? "bg-[#171717] text-white" : "text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Deux séries (entrants/sortants, ou équivalent) en barres groupées — même
// esprit que MonthlyBarChart (charts/MonthlyBarChart.tsx) mais à deux
// couleurs, nécessaire ici pour comparer "in" vs "out" côte à côte plutôt
// que de les empiler (empiler aurait caché lequel domine).
function GroupedBarChart({
  data,
  seriesA,
  seriesB,
  colorA = "#8B4531",
  colorB = "#0F5C56",
}: {
  data: { label: string; a: number; b: number }[];
  seriesA: string;
  seriesB: string;
  colorA?: string;
  colorB?: string;
}) {
  if (data.length === 0) {
    return <div className="text-sm text-neutral-400">Pas encore de données sur cette période.</div>;
  }
  const max = Math.max(...data.map((d) => Math.max(d.a, d.b)), 1);
  const width = 720;
  const height = 180;
  const groupGap = 10;
  const barGap = 2;
  const groupWidthRaw = (width - groupGap * (data.length - 1)) / data.length;
  const groupWidth = Math.min(groupWidthRaw, 56);
  const totalRowWidth = groupWidth * data.length + groupGap * (data.length - 1);
  const offsetX = Math.max((width - totalRowWidth) / 2, 0);
  const barWidth = (groupWidth - barGap) / 2;

  return (
    <div className="overflow-x-auto rounded-md bg-white p-4">
      <div className="mb-2 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorA }} />
          {seriesA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorB }} />
          {seriesB}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 28}`} width="100%" role="img" aria-label={`${seriesA} vs ${seriesB}`}>
        {data.map((d, i) => {
          const x = offsetX + i * (groupWidth + groupGap);
          const hA = Math.max((d.a / max) * (height - 10), d.a > 0 ? 2 : 0);
          const hB = Math.max((d.b / max) * (height - 10), d.b > 0 ? 2 : 0);
          return (
            <g key={`${d.label}-${i}`}>
              <title>
                {d.label} — {seriesA} : {d.a} · {seriesB} : {d.b}
              </title>
              <rect x={x} y={height - hA} width={barWidth} height={hA} rx={2} fill={colorA} opacity={0.9} />
              <rect
                x={x + barWidth + barGap}
                y={height - hB}
                width={barWidth}
                height={hB}
                rx={2}
                fill={colorB}
                opacity={0.9}
              />
              <text x={x + groupWidth / 2} y={height + 16} textAnchor="middle" fontSize="9" fill="#78716c">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-[#eaeaea] bg-[#fafafa] p-4">
      <h3 className="font-heading text-sm font-semibold text-[#171717]">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function StatsAgenceView() {
  const [messagesRange, setMessagesRange] = useState<Range>("day");
  const [resaRange, setResaRange] = useState<Range>("day");
  const [dataByRange, setDataByRange] = useState<Partial<Record<Range, StatsResponse>>>({});
  const [loading, setLoading] = useState<Set<Range>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const rangesNeeded = [messagesRange, resaRange];

  useEffect(() => {
    rangesNeeded.forEach((range) => {
      if (dataByRange[range] || loading.has(range)) return;
      setLoading((prev) => new Set(prev).add(range));
      (async () => {
        try {
          const res = await fetch(`/api/direction/stats-agence?range=${range}`);
          if (!res.ok) throw new Error("Échec du chargement des statistiques.");
          const json = (await res.json()) as StatsResponse;
          setDataByRange((prev) => ({ ...prev, [range]: json }));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erreur inconnue.");
        } finally {
          setLoading((prev) => {
            const next = new Set(prev);
            next.delete(range);
            return next;
          });
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesRange, resaRange]);

  const messagesData = dataByRange[messagesRange];
  const resaData = dataByRange[resaRange];

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">Stat agences</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Messages WhatsApp/Instagram et réservations rentrées dans le CRM, toute l&apos;équipe confondue.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-[#171717]">Messages</h3>
          <RangeToggle value={messagesRange} onChange={setMessagesRange} />
        </div>
        {!messagesData ? (
          <div className="text-sm text-neutral-400">Chargement…</div>
        ) : (
          <div className="space-y-4">
            <SectionCard
              title={
                messagesRange === "day"
                  ? "Par jour (30 derniers jours)"
                  : messagesRange === "week"
                    ? "Par semaine (26 dernières semaines)"
                    : "Par mois (12 derniers mois)"
              }
            >
              <GroupedBarChart
                data={messagesData.messages.trend.map((t) => ({ label: t.label, a: t.in, b: t.out }))}
                seriesA="Entrants"
                seriesB="Sortants"
              />
            </SectionCard>
            <SectionCard
              title="Par heure de la journée"
              subtitle={`Cumul sur la période — heure d'Égypte, ${
                messagesRange === "day" ? "30 derniers jours" : messagesRange === "week" ? "26 dernières semaines" : "12 derniers mois"
              }.`}
            >
              <GroupedBarChart
                data={messagesData.messages.byHour.map((h) => ({
                  label: `${h.hour}h`,
                  a: h.in,
                  b: h.out,
                }))}
                seriesA="Entrants"
                seriesB="Sortants"
              />
            </SectionCard>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-[#171717]">Réservations rentrées</h3>
          <RangeToggle value={resaRange} onChange={setResaRange} />
        </div>
        {!resaData ? (
          <div className="text-sm text-neutral-400">Chargement…</div>
        ) : (
          <div className="space-y-4">
            <SectionCard
              title={
                resaRange === "day"
                  ? "Par jour (30 derniers jours)"
                  : resaRange === "week"
                    ? "Par semaine (26 dernières semaines)"
                    : "Par mois (12 derniers mois)"
              }
            >
              <GroupedBarChart
                data={resaData.reservations.trend.map((t) => ({ label: t.label, a: t.count, b: 0 }))}
                seriesA="Réservations"
                seriesB=""
              />
            </SectionCard>
            <div className="grid gap-4 sm:grid-cols-2">
              <SectionCard title="Qui en rentre le plus">
                {resaData.reservations.byEmployee.length === 0 ? (
                  <div className="text-sm text-neutral-400">Aucune activité attribuée sur cette période.</div>
                ) : (
                  <div className="space-y-1.5">
                    {resaData.reservations.byEmployee.map((e, i) => (
                      <div key={e.nom} className="flex items-center justify-between text-sm">
                        <span className="text-[#171717]">
                          {i + 1}. {e.nom}
                        </span>
                        <span className="font-medium text-[#171717]">{e.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Matin ou après-midi ?">
                {(() => {
                  const total = resaData.reservations.matin + resaData.reservations.apresMidi;
                  const pctMatin = total > 0 ? Math.round((resaData.reservations.matin / total) * 100) : 0;
                  const pctAprem = 100 - pctMatin;
                  return (
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#171717]">🌅 Matin (avant 12h)</span>
                          <span className="font-medium text-[#171717]">
                            {resaData.reservations.matin} ({pctMatin}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                          <div className="h-full bg-[#C9973E]" style={{ width: `${pctMatin}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#171717]">🌇 Après-midi (après 12h)</span>
                          <span className="font-medium text-[#171717]">
                            {resaData.reservations.apresMidi} ({pctAprem}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                          <div className="h-full bg-[#0F5C56]" style={{ width: `${pctAprem}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
