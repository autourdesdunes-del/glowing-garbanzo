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

  const segments = data.reduce<
    { label: string; value: number; color: string; dash: number; offset: number; fraction: number }[]
  >((acc, d) => {
    const fraction = total > 0 ? d.value / total : 0;
    const dash = fraction * circumference;
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    acc.push({ ...d, dash, offset, fraction });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6 rounded-[6px] border border-[#eaeaea] bg-white p-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#eaeaea"
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
          fill="#171717"
        >
          {total}
        </text>
        {centerLabel && (
          <text
            x={size / 2}
            y={size / 2 + 16}
            textAnchor="middle"
            fontSize="9"
            fill="#666666"
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
            <span className="text-[#666666]">{d.label}</span>
            <span className="font-amounts font-medium text-[#171717]">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
