"use client";

import { useState } from "react";
import { PlanningShift, Profile } from "@/lib/types";
import {
  dominantStatut,
  localIso,
  MONTH_NAMES_FULL,
  sortDayShifts,
  statutBadgeClass,
  statutLabel,
  WEEKDAY_ABREV,
} from "@/lib/planningRHFormat";

// Petits composants de présentation propres à PlanningRHView.tsx — extraits
// pour alléger ce fichier, sans changement de comportement.

export function MiniMonth({
  year,
  month,
  shiftsByDate,
  onDayClick,
}: {
  year: number;
  month: number;
  shiftsByDate: Record<string, PlanningShift[]>;
  onDayClick?: (iso: string) => void;
}) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="mb-2 text-center text-sm font-semibold capitalize text-[#171717]">
        {MONTH_NAMES_FULL[month]} {year}
      </p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
        {WEEKDAY_ABREV.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayShifts = shiftsByDate[iso] || [];
          const dominant = dominantStatut(dayShifts);
          const cls = dominant
            ? `${statutBadgeClass(dominant)} hover:ring-2 hover:ring-offset-1 hover:ring-[#171717]/30`
            : "border border-neutral-200 text-neutral-400 hover:border-[#171717]/40 hover:bg-neutral-50 hover:text-[#171717]";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(iso)}
              title={onDayClick ? "Voir le détail de ce jour" : undefined}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] transition ${cls} ${
                onDayClick ? "cursor-pointer" : ""
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DetailModal({
  date,
  onClose,
  shifts,
  teamProfiles,
  nameFor,
}: {
  date: string;
  onClose: () => void;
  shifts: PlanningShift[];
  teamProfiles: Profile[];
  nameFor: (uid: string) => string;
}) {
  const [view, setView] = useState<"jour" | "semaine" | "mois">("jour");
  const base = new Date(date + "T00:00:00");

  let rangeDates: Date[] = [base];
  if (view === "semaine") {
    const startOffset = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(monday.getDate() - startOffset);
    rangeDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  } else if (view === "mois") {
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    rangeDates = Array.from({ length: daysInMonth }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-[6px] border border-[#eaeaea] bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold capitalize text-[#171717]">
            {base.toLocaleDateString("fr-FR", {
              weekday: view === "jour" ? "long" : undefined,
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-1.5">
          {(["jour", "semaine", "mois"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                view === v
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {rangeDates.map((d) => {
            const iso = localIso(d);
            const dayShifts = shifts.filter((s) => s.date === iso).sort(sortDayShifts);
            return (
              <div key={iso}>
                <p className="mb-1 text-xs font-medium capitalize text-neutral-500">
                  {d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                {dayShifts.length === 0 ? (
                  <p className="text-xs italic text-neutral-300">Rien de prévu.</p>
                ) : (
                  <div className="space-y-1">
                    {dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-md bg-neutral-50 px-2 py-1 text-xs"
                      >
                        <span className="font-medium text-neutral-700">{nameFor(s.user_id)}</span>
                        <span className={`rounded-full px-2 py-0.5 ${statutBadgeClass(s.statut)}`}>
                          {statutLabel(s.statut, s.shift_debut, s.shift_fin)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {teamProfiles.length === 0 && (
            <p className="text-xs text-neutral-400">Aucune personne dans l&apos;équipe pour l&apos;instant.</p>
          )}
        </div>
      </div>
    </div>
  );
}
