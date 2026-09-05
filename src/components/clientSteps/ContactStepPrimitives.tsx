"use client";

import { useState } from "react";

// Petits composants de présentation propres à ContactStep (client-steps.tsx)
// — extraits pour alléger ce fichier, sans changement de comportement.

// Icônes minimalistes pour les PropertyRow de ContactStep/SejourStep —
// même style trait fin (viewBox 20, stroke 1.5) que le reste de l'appli.
const PROP_ICON_PATHS: Record<string, React.ReactNode> = {
  person: (
    <>
      <circle cx="10" cy="7" r="3" />
      <path d="M3.5 17c0-3 2.9-5.3 6.5-5.3s6.5 2.3 6.5 5.3" strokeLinecap="round" />
    </>
  ),
  flag: (
    <>
      <path d="M5 3v14" strokeLinecap="round" />
      <path d="M5 4h9l-2.2 3L14 10H5" strokeLinejoin="round" />
    </>
  ),
  phone: (
    <path d="M4.5 3.5h2.7l1 3.3-1.7 1.4a10 10 0 0 0 4.3 4.3l1.4-1.7 3.3 1v2.7c0 .8-.7 1.4-1.5 1.3C8.6 15.2 4.8 11.4 4 5.9c-.1-.8.5-1.4 1.3-1.4Z" strokeLinejoin="round" />
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M3 5.5l7 5.5 7-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  megaphone: (
    <path d="M3 8.5v3l2 .5 8 3v-10l-8 3-2 .5Z M13 8.5a2.5 2.5 0 0 1 0 3M16 6.5a5.5 5.5 0 0 1 0 7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" />
    </>
  ),
  hotel: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
    </>
  ),
  key: (
    <>
      <circle cx="7" cy="13" r="3" />
      <path d="M9.1 10.9 16 4" strokeLinecap="round" />
      <path d="M13 7l2 2M15.2 4.8l2 2" strokeLinecap="round" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3 2.5 16h15L10 3Z" strokeLinejoin="round" />
      <path d="M10 8.5v3.2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  idcard: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M2.5 8h15" strokeLinecap="round" />
    </>
  ),
};
export function PropIcon({ name }: { name: keyof typeof PROP_ICON_PATHS }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
      {PROP_ICON_PATHS[name]}
    </svg>
  );
}

// Les âges restent stockés dans le champ texte existant (ages_enfants,
// ages_bebes, ages_ados) pour ne rien casser ailleurs dans l'appli (Aperçu
// client, itinéraire, Suivis...) qui affichent directement cette chaîne —
// seule la saisie devient une liste de puces validées par tranche d'âge.
export function parseAges(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

export function AgeChips({
  ages,
  min,
  max,
  onChange,
}: {
  ages: number[];
  min: number;
  max: number;
  onChange: (ages: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ages.map((a, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white pl-2 pr-1 py-0.5 text-xs text-neutral-600"
        >
          <input
            type="number"
            min={min}
            max={max}
            value={a}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const v = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
              const next = [...ages];
              next[i] = v;
              onChange(next);
            }}
            className="w-7 border-none bg-transparent text-xs focus:outline-none"
          />
          <span className="text-neutral-400">ans</span>
          <button
            type="button"
            onClick={() => onChange(ages.filter((_, idx) => idx !== i))}
            className="text-neutral-300 hover:text-red-600"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange([...ages, min])}
        className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
      >
        + âge
      </button>
    </div>
  );
}

// Sélecteur simple avec une petite barre de recherche pour filtrer une
// liste d'options longue (ex. "Relation grâce à") — un <select> HTML natif
// n'offre aucun moyen de chercher dedans, il faut dérouler toute la liste
// à chaque fois.
export function SearchableSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="input-flat text-left">
        {value || "—"}
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Rechercher…"
        className="input-flat w-full"
      />
      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-[#eaeaea] bg-white shadow-sm">
        {filtered.length === 0 && <p className="px-3 py-2 text-xs text-neutral-400">Aucun résultat.</p>}
        {filtered.map((o) => (
          <button
            key={o}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(o);
              setSearch("");
              setOpen(false);
            }}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-[#fafafa] ${
              o === value ? "font-medium text-[#171717]" : "text-neutral-600"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
