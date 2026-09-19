"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Remplace un <select> natif stylé en badge — sur Safari (iOS ET macOS), le
// texte affiché dans un <select> ou un <textarea> ignore parfois complètement
// la taille de police demandée en CSS (garde une taille système bien plus
// grosse), alors qu'un simple <span>/<div> de texte (comme le badge des
// cartes de résumé, en liste) affiche toujours la bonne taille — confirmé
// par captures d'écran réelles (Mélanie, 2026-09-19). En repartant d'un
// <button>, la taille du texte est enfin garantie identique à ces badges.
//
// Le menu déroulant est rendu via un portail (document.body) en position
// fixe calculée depuis le bouton, plutôt qu'en position absolute dans le
// flux normal : sans ça, un ancêtre avec overflow-y-auto (les popups/
// modales où ce badge est utilisé) DÉCOUPE le menu de façon invisible,
// rendant les options impossibles à toucher — c'est ce qui avait cassé le
// changement de statut lors d'un premier essai plus simple.
export function StatutBadgeSelect<K extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: K;
  options: { key: K; label: string; className: string }[];
  onChange: (v: K) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
          setOpen(true);
        }}
        // Même gabarit que le badge (non-interactif) des cartes de résumé
        // (ReservationSummaryCard) — c'est cette taille-là que Mélanie
        // considère correcte, à reproduire ici à l'identique.
        className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-xs font-medium leading-tight ${current.className} ${className ?? ""}`}
      >
        {current.label}
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
            className="max-h-60 w-max min-w-[160px] overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
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
          </div>,
          document.body
        )}
    </>
  );
}
