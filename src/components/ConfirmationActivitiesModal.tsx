"use client";

import { useState } from "react";
import { Reservation } from "@/lib/types";
import { todayStr } from "@/lib/dates";
import { cleanActivityTitle } from "@/lib/resa";

function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Choix des activités à faire figurer sur un bon de confirmation avant de le
// générer — utile quand des activités déjà passées ont été réglées sur
// place et qu'on ne veut renvoyer un bon qu'autour d'une nouvelle activité
// ajoutée après coup (demande de Mélanie, 2026-10-18 : "c'est bizarre de
// renvoyer un bon de confirmation qui fait apparaître les anciennes
// activités déjà passées"). Les activités déjà passées sont décochées par
// défaut, les activités à venir cochées — ajustable à la main.
export default function ConfirmationActivitiesModal({
  reservations,
  onCancel,
  onConfirm,
}: {
  reservations: Reservation[];
  onCancel: () => void;
  onConfirm: (selectedIds: string[]) => void;
}) {
  const actives = reservations
    .filter((r) => r.statut_resa === "Confirmée")
    .filter((r) => r.date_debut)
    .slice()
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  const today = todayStr();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(actives.filter((r) => (r.date_debut || "") >= today).map((r) => r.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toutCocher = () => setSelected(new Set(actives.map((r) => r.id)));
  const toutDecocher = () => setSelected(new Set());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl">
        <div className="border-b border-[#eaeaea] px-5 py-4">
          <h2 className="text-base font-semibold text-[#171717]">Activités à inclure</h2>
          <p className="mt-1 text-xs text-[#666666]">
            Les activités déjà passées sont décochées par défaut — coche/décoche pour ajuster.
          </p>
        </div>

        <div className="flex gap-2 border-b border-[#eaeaea] px-5 py-2">
          <button
            onClick={toutCocher}
            className="rounded-md border border-[#eaeaea] px-2 py-1 text-xs text-[#666666] hover:border-[#171717] hover:text-[#171717]"
          >
            Tout cocher
          </button>
          <button
            onClick={toutDecocher}
            className="rounded-md border border-[#eaeaea] px-2 py-1 text-xs text-[#666666] hover:border-[#171717] hover:text-[#171717]"
          >
            Tout décocher
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {actives.length === 0 && (
            <p className="py-6 text-center text-sm text-[#999999]">Aucune activité confirmée sur ce séjour.</p>
          )}
          {actives.map((r) => {
            const passee = (r.date_debut || "") < today;
            return (
              <label
                key={r.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-2 hover:bg-[#fafafa]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#171717]">
                    {cleanActivityTitle(r.nom_activite) || "Activité sans nom"}
                  </div>
                  <div className={`text-xs ${passee ? "text-[#C9973E]" : "text-[#999999]"}`}>
                    {fmtDateShort(r.date_debut || "")}
                    {passee ? " — déjà passée" : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#eaeaea] px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
            className="rounded-md bg-[#171717] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#333333] disabled:opacity-40"
          >
            Générer le bon
          </button>
        </div>
      </div>
    </div>
  );
}
