"use client";

// Categorical by status, but every bar carries a visible text label (name +
// count) so identity never relies on color alone — sidesteps needing a
// full CVD-validated categorical set for just 4 brand-toned hues.
export default function StatusBarChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2 rounded-md bg-white p-4">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 text-xs text-neutral-600">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
          </div>
          <span className="font-amounts w-6 flex-shrink-0 text-right text-xs text-neutral-500">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
