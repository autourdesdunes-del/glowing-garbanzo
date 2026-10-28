"use client";

import { useEffect, useState } from "react";

type Range = "day" | "week" | "month";

type MessagesStats = {
  trend: { label: string; in: number; out: number }[];
  byHour: { hour: number; in: number; out: number }[];
  byWeekday: { name: string; in: number; out: number }[];
  responseTrend: { label: string; averageMinutes: number; count: number }[];
  averageMinutesGlobal: number | null;
};

type ReservationsStats = {
  trend: { label: string; count: number }[];
  byEmployee: { nom: string; count: number; joursTravailles: number; moyenneParJour: number | null }[];
  matin: number;
  apresMidi: number;
};

type ConversionStat = { canal: string; total: number; confirmes: number; tauxPct: number };

type StatsResponse = {
  range: Range;
  messages: MessagesStats;
  reservations: ReservationsStats;
  conversion: ConversionStat[];
};

// "2h30" plutôt que "150 min" — plus lisible pour un temps de réponse
// d'agence (souvent plusieurs heures, jamais des secondes).
function fmtDuree(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

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

// Dernière période complète vs celle d'avant (dernier jour vs la veille,
// dernière semaine vs la précédente, dernier mois vs le précédent) — même
// principe que "CA du mois vs mois précédent" sur le Tableau de bord
// Direction. "inverse" pour une métrique où baisser est une amélioration
// (temps de réponse) : la couleur s'inverse, pas le signe affiché.
function VsPrecedent({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-xs font-medium text-neutral-400">(pas de référence)</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const hausse = pct > 0;
  const bon = inverse ? !hausse : hausse;
  const couleur = pct === 0 ? "text-neutral-400" : bon ? "text-[#0F5C56]" : "text-red-600";
  return (
    <span className={`text-xs font-medium ${couleur}`}>
      {pct > 0 ? "+" : ""}
      {pct}% vs précédent
    </span>
  );
}

// Les barres seules ne donnent le chiffre exact qu'au survol (jamais au
// doigt sur mobile) — demande de Mélanie, 2026-10-28 : un total toujours
// visible au-dessus du graphique, plus un tableau dépliable avec chaque
// valeur exacte, label par label.
function ChartTotals({
  data,
  seriesA,
  seriesB,
  colorA,
  colorB,
  showComparison = false,
}: {
  data: { label: string; a: number; b: number }[];
  seriesA: string;
  seriesB: string;
  colorA: string;
  colorB: string;
  showComparison?: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const totalA = data.reduce((s, d) => s + d.a, 0);
  const totalB = data.reduce((s, d) => s + d.b, 0);
  const showB = seriesB !== "";
  // Jamais le tout dernier bucket (aujourd'hui / cette semaine / ce mois en
  // cours, toujours partiel puisque la période n'est pas finie) — sinon la
  // comparaison était systématiquement et faussement négative, le jour en
  // cours ayant mécaniquement moins d'événements qu'une veille complète.
  // On compare donc le dernier jour/semaine/mois COMPLET à celui d'avant.
  const last = data[data.length - 2];
  const prev = data[data.length - 3];
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="text-sm">
          <span className="font-amounts text-lg font-semibold" style={{ color: colorA }}>
            {totalA}
          </span>{" "}
          <span className="text-neutral-500">{seriesA.toLowerCase()}</span>
          {showComparison && last && prev && (
            <span className="ml-1.5">
              <VsPrecedent current={last.a} previous={prev.a} />
            </span>
          )}
        </span>
        {showB && (
          <span className="text-sm">
            <span className="font-amounts text-lg font-semibold" style={{ color: colorB }}>
              {totalB}
            </span>{" "}
            <span className="text-neutral-500">{seriesB.toLowerCase()}</span>
            {showComparison && last && prev && (
              <span className="ml-1.5">
                <VsPrecedent current={last.b} previous={prev.b} />
              </span>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={() => setDetailOpen((v) => !v)}
          className="ml-auto text-xs font-medium text-[#0F5C56] underline hover:no-underline"
        >
          {detailOpen ? "Masquer le détail" : "Voir le détail (chiffres)"}
        </button>
      </div>
      {detailOpen && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#fafafa] text-neutral-500">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Période</th>
                <th className="px-2 py-1 text-right font-medium">{seriesA}</th>
                {showB && <th className="px-2 py-1 text-right font-medium">{seriesB}</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={`${d.label}-${i}`} className="border-t border-neutral-100">
                  <td className="px-2 py-1 text-[#171717]">{d.label}</td>
                  <td className="px-2 py-1 text-right font-amounts text-[#171717]">{d.a}</td>
                  {showB && <td className="px-2 py-1 text-right font-amounts text-[#171717]">{d.b}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const conversionData = resaData?.conversion || [];

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
              <ChartTotals
                data={messagesData.messages.trend.map((t) => ({ label: t.label, a: t.in, b: t.out }))}
                seriesA="Entrants"
                seriesB="Sortants"
                colorA="#8B4531"
                colorB="#0F5C56"
                showComparison
              />
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
              <ChartTotals
                data={messagesData.messages.byHour.map((h) => ({ label: `${h.hour}h`, a: h.in, b: h.out }))}
                seriesA="Entrants"
                seriesB="Sortants"
                colorA="#8B4531"
                colorB="#0F5C56"
              />
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
            <SectionCard
              title="Par jour de la semaine"
              subtitle={`Cumul sur la période — ${
                messagesRange === "day" ? "30 derniers jours" : messagesRange === "week" ? "26 dernières semaines" : "12 derniers mois"
              }.`}
            >
              {(() => {
                const jours = messagesData.messages.byWeekday;
                const plus = [...jours].sort((a, b) => b.in - a.in)[0];
                const moins = [...jours].sort((a, b) => a.in - b.in)[0];
                return (
                  <>
                    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <span>
                        📈 <span className="font-medium text-[#171717]">{plus.name}</span>{" "}
                        <span className="text-neutral-500">
                          le plus chargé ({plus.in} entrant{plus.in > 1 ? "s" : ""})
                        </span>
                      </span>
                      <span>
                        📉 <span className="font-medium text-[#171717]">{moins.name}</span>{" "}
                        <span className="text-neutral-500">
                          le plus calme ({moins.in} entrant{moins.in > 1 ? "s" : ""})
                        </span>
                      </span>
                    </div>
                    <GroupedBarChart
                      data={jours.map((j) => ({ label: j.name.slice(0, 3), a: j.in, b: j.out }))}
                      seriesA="Entrants"
                      seriesB="Sortants"
                    />
                  </>
                );
              })()}
            </SectionCard>
            <SectionCard
              title="Temps de réponse moyen"
              subtitle="Délai entre un message client et la première réponse de l'équipe. Pas d'auteur dans ces données Kommo : impossible de le détailler par employée."
            >
              {messagesData.messages.averageMinutesGlobal == null ? (
                <div className="text-sm text-neutral-400">Pas assez de données pour calculer un temps de réponse.</div>
              ) : (
                <>
                  <div className="mb-3 text-sm">
                    <span className="font-amounts text-lg font-semibold text-[#171717]">
                      {fmtDuree(messagesData.messages.averageMinutesGlobal)}
                    </span>{" "}
                    <span className="text-neutral-500">en moyenne sur la période</span>
                  </div>
                  <div className="overflow-x-auto rounded-md bg-white p-4">
                    <div className="flex items-end gap-1.5" style={{ minHeight: 160 }}>
                      {messagesData.messages.responseTrend.map((b, i) => {
                        const max = Math.max(...messagesData.messages.responseTrend.map((x) => x.averageMinutes), 1);
                        const h = Math.max((b.averageMinutes / max) * 140, b.averageMinutes > 0 ? 2 : 0);
                        return (
                          <div key={`${b.label}-${i}`} className="flex flex-col items-center gap-1" style={{ width: 24 }}>
                            <div title={`${b.label} : ${fmtDuree(b.averageMinutes)} (${b.count} réponse${b.count > 1 ? "s" : ""})`} className="flex h-[140px] w-full items-end">
                              <div className="w-full rounded-t-sm bg-[#C9973E]" style={{ height: h }} />
                            </div>
                            <span className="text-[9px] text-neutral-400">{b.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
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
              <ChartTotals
                data={resaData.reservations.trend.map((t) => ({ label: t.label, a: t.count, b: 0 }))}
                seriesA="Réservations"
                seriesB=""
                colorA="#171717"
                colorB="#0F5C56"
                showComparison
              />
              <GroupedBarChart
                data={resaData.reservations.trend.map((t) => ({ label: t.label, a: t.count, b: 0 }))}
                seriesA="Réservations"
                seriesB=""
              />
            </SectionCard>
            <div className="grid gap-4 sm:grid-cols-2">
              <SectionCard
                title="Qui en rentre le plus"
                subtitle="Moyenne par jour travaillé entre parenthèses — sinon le classement ne fait que refléter qui a eu le plus de shifts."
              >
                {resaData.reservations.byEmployee.length === 0 ? (
                  <div className="text-sm text-neutral-400">Aucune activité attribuée sur cette période.</div>
                ) : (
                  <div className="space-y-1.5">
                    {resaData.reservations.byEmployee.map((e, i) => (
                      <div key={e.nom} className="flex items-center justify-between text-sm">
                        <span className="text-[#171717]">
                          {i + 1}. {e.nom}
                        </span>
                        <span className="font-medium text-[#171717]">
                          {e.count}
                          {e.moyenneParJour != null && (
                            <span className="ml-1 font-normal text-neutral-400">
                              ({e.moyenneParJour}/j · {e.joursTravailles}j)
                            </span>
                          )}
                        </span>
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

      <div>
        <h3 className="font-heading mb-2 text-base font-semibold text-[#171717]">Conversion par canal</h3>
        {!resaData ? (
          <div className="text-sm text-neutral-400">Chargement…</div>
        ) : (
          <SectionCard
            title="% de prospects devenus Client confirmé"
            subtitle={`Parmi les prospects arrivés sur la période (${
              resaRange === "day" ? "30 derniers jours" : resaRange === "week" ? "26 dernières semaines" : "12 derniers mois"
            }) — un prospect très récent n'a souvent pas encore eu le temps de se confirmer, à garder en tête sur "Jour".`}
          >
            {conversionData.length === 0 ? (
              <div className="text-sm text-neutral-400">Aucun prospect sur cette période.</div>
            ) : (
              <div className="space-y-2.5">
                {conversionData.map((c) => (
                  <div key={c.canal}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#171717]">{c.canal}</span>
                      <span className="font-medium text-[#171717]">
                        {c.tauxPct}% <span className="font-normal text-neutral-400">({c.confirmes}/{c.total})</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                      <div className="h-full bg-[#8B4531]" style={{ width: `${c.tauxPct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
