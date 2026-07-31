"use client";

// Categorical distribution, but every segment is paired with a direct text
// label + percentage in the legend, so identity never depends on color alone.
export default function DonutChart({
  data,
  centerLabel,
}: {
  data: { label: string; value: number; color: string }[];
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const seg = { ...d, dash, offset, fraction };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-6 rounded-md bg-white p-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f2e6d2"
          strokeWidth={stroke}
        />
        {segments.map((s) =>
          s.dash > 0 ? (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset + circumference / 4}
              strokeLinecap="butt"
            />
          ) : null
        )}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fontSize="22"
          fontWeight="600"
          fill="#5C2A1D"
        >
          {total}
        </text>
        {centerLabel && (
          <text
            x={size / 2}
            y={size / 2 + 16}
            textAnchor="middle"
            fontSize="9"
            fill="#a8a29e"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-neutral-600">{d.label}</span>
            <span className="font-amounts font-medium text-[#5C2A1D]">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
