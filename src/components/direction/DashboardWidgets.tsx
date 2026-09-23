"use client";

// Petits composants de dataviz "carte moderne" (sparkline, donut, carte
// métrique avec tendance) pour la Vue d'ensemble du tableau de bord
// Direction — inspirés d'une maquette fournie par Mélanie (2026-09-23).
// SVG à la main plutôt qu'une librairie : besoins simples (une ligne, un
// anneau), pas la peine d'alourdir le bundle.

export function Sparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  if (values.length < 2) return <div className="h-10" />;
  const w = 100;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${w},${h} L0,${h} Z`;
  const color = positive ? "#0F5C56" : "#c0392b";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity="0.08" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricCardTrend({
  label,
  value,
  trendPct,
  trendLabel,
  values,
}: {
  label: string;
  value: string;
  // Variation vs la période précédente — omise si non calculable (ex. pas
  // de donnée le mois précédent).
  trendPct?: number | null;
  trendLabel?: string;
  values: number[];
}) {
  const positive = (trendPct ?? 0) >= 0;
  return (
    <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        {trendPct !== null && trendPct !== undefined && (
          <span className={`text-xs font-semibold ${positive ? "text-[#0F5C56]" : "text-red-600"}`}>
            {positive ? "↑" : "↓"} {Math.abs(trendPct)}%
          </span>
        )}
      </div>
      <p className="font-amounts mt-1 text-2xl font-semibold text-[#171717]">{value}</p>
      {trendLabel && <p className="mt-0.5 text-[11px] text-neutral-400">{trendLabel}</p>}
      <div className="mt-2">
        <Sparkline values={values} positive={positive} />
      </div>
    </div>
  );
}

// Anneau simple à N segments — proportions réelles, pas décoratif : sert à
// visualiser en un coup d'œil un partage (ex. marge/coûts, statuts).
export function Donut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 15.9155; // rayon tel que la circonférence = 100 (facilite les % en strokeDasharray)
  let cumulative = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" className="h-24 w-24 flex-shrink-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f0f0f0" strokeWidth="4" />
        {total > 0 &&
          segments.map((seg, i) => {
            const pct = (seg.value / total) * 100;
            const dasharray = `${pct} ${100 - pct}`;
            const dashoffset = -cumulative;
            cumulative += pct;
            return (
              <circle
                key={i}
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="4"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            );
          })}
      </svg>
      <div className="min-w-0 flex-1">
        {centerValue && (
          <p className="font-amounts text-xl font-semibold text-[#171717]">
            {centerValue}
            {centerLabel && <span className="ml-1 text-xs font-normal text-neutral-400">{centerLabel}</span>}
          </p>
        )}
        <div className="mt-1.5 space-y-1">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="truncate">{seg.label}</span>
              <span className="ml-auto font-medium text-[#171717]">
                {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
