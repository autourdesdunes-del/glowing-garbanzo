"use client";

import { useEffect, useRef, useState } from "react";

// Remplace un <select> natif stylé en badge — sur iOS Safari, le rendu du
// texte d'un <select> ignore parfois complètement la taille de police
// demandée en CSS (garde une taille système bien plus grosse), un
// comportement qu'aucun correctif CSS (appearance-none, text-size-adjust,
// hauteur fixe...) n'a résolu de façon fiable (Mélanie, 2026-09-19). En
// repartant d'un simple <button> + petit menu maison, la taille du texte
// est entièrement sous notre contrôle sur toutes les plateformes.
export function StatutBadgeSelect<K extends string>({
  value,
  options,
  onChange,
  size = "sm",
  className,
}: {
  value: K;
  options: { key: K; label: string; className: string }[];
  onChange: (v: K) => void;
  // "sm" = text-sm (14px), même taille que les labels des DetailRow
  // ("Paiement", "Total"…) à côté desquels ce badge s'affiche — demande
  // explicite de Mélanie, 2026-09-19 ("même taille que Paiement").
  // "xs" reste dispo pour les badges compacts en carte (liste).
  size?: "sm" | "xs";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const textSize = size === "xs" ? "text-[11px]" : "text-sm";

  return (
    <div ref={ref} className={`relative inline-block shrink-0 ${className ?? ""}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`max-w-full truncate rounded-full px-2 py-1 ${textSize} font-medium leading-none ${current.className}`}
      >
        {current.label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-60 w-max min-w-[160px] overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(o.key);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-[#fafafa] ${
                o.key === value ? "font-semibold text-[#171717]" : "text-[#666666]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
