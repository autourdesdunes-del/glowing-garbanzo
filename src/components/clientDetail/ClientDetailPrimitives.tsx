"use client";

import { useState } from "react";

// Petits composants/formateurs propres à ClientDetail.tsx — extraits pour
// alléger ce fichier, sans changement de comportement.

export function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export function Section({
  title,
  titleExtra,
  endBadge,
  open,
  onToggle,
  children,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  endBadge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div id={`section-${title}`} className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold text-[#171717]">{title}</span>
          {titleExtra}
        </span>
        <span className="flex items-center gap-2">
          {endBadge}
          <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>
            ⌄
          </span>
        </span>
      </button>
      {open && <div className="border-t border-[#666666]/10 px-4 py-4">{children}</div>}
    </div>
  );
}

const TAG_OPTIONS = ["VIP", "Récurrent", "Urgent", "Vigilance"];

// Petite étoile à côté des badges du bandeau (statut/hôtel/dates) : clic
// pour ouvrir un menu et cocher/décocher les étiquettes — remplace
// l'ancienne rangée de pastilles en pointillés, toujours visible même
// sans étiquette.
export function TagStarPicker({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (tag: string) => {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Étiquettes"
        className={`flex h-5 w-5 items-center justify-center rounded-full ${
          tags.length > 0 ? "text-[#C9973E]" : "text-neutral-300 hover:text-neutral-400"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          fill={tags.length > 0 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4"
        >
          <path
            d="M10 2.8 12.2 7.6l5.2.6-3.9 3.6 1 5.1-4.5-2.6-4.5 2.6 1-5.1-3.9-3.6 5.2-.6L10 2.8Z"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 w-36 rounded-md border border-[#eaeaea] bg-white p-1 shadow-lg">
            {TAG_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#fafafa]"
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${
                    tags.includes(opt) ? "border-[#C9973E] bg-[#C9973E]" : "border-neutral-300"
                  }`}
                >
                  {tags.includes(opt) && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
