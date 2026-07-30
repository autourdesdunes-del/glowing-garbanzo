"use client";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Single-series magnitude over time -> one hue (brand terracotta), never a
// categorical palette here since there's only one series.
export default function MonthlyBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (data.length === 0) {
    return <div className="text-sm text-neutral-400">Pas encore de données datées.</div>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 640;
  const height = 200;
  const barGap = 8;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div className="overflow-x-auto rounded-md bg-white p-4">
      <svg
        viewBox={`0 0 ${width} ${height + 28}`}
        width="100%"
        role="img"
        aria-label="Chiffre d'affaires par mois"
      >
        {data.map((d, i) => {
          const barHeight = Math.max((d.value / max) * height, d.value > 0 ? 3 : 0);
          const x = i * (barWidth + barGap);
          const y = height - barHeight;
          return (
            <g key={d.label}>
              <title>
                {d.label} : {euros(d.value)} €
              </title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill="#5C2A1D"
                opacity={0.85}
              />
              <text
                x={x + barWidth / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#78716c"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
