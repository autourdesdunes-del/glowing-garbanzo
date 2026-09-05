"use client";

import { useEffect, useState } from "react";
import { CatalogueItem } from "@/lib/types";
import { JOURS_SEMAINE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { chevalOuChameauMot } from "@/lib/resa";
import {
  euros,
  isMontgolfiereActivity,
  isoDate,
  isQuadActivity,
  isSpaActivity,
  JOUR_ABREV,
  MONTH_NAMES,
  WEEKDAY_JS_TO_FR,
} from "@/lib/catalogueFormat";
import { RowIcon } from "@/components/catalogue/CatalogueIcons";

// Petits composants de présentation communs au Catalogue — extraits de
// CatalogueView.tsx pour alléger ce fichier, sans changement de comportement.

export function PriceSummary({ a }: { a: CatalogueItem }) {
  if (a.tarif_mode === "groupe") {
    if (!a.prix_groupe_base) {
      return <span>{a.prix_groupe_note || "Forfait sur demande"}</span>;
    }
    return (
      <span>
        Forfait {euros(a.prix_groupe_base)}€ ({a.prix_groupe_base_pax} pers.)
      </span>
    );
  }
  const animal = chevalOuChameauMot(a.nom);
  return (
    <>
      <span>
        Adulte {euros(a.pu_adulte)}€{animal && ` (par ${animal})`}
      </span>
      {isSpaActivity(a) ? (
        <span>À partir de 10 ans</span>
      ) : (
        <span>
          Enfant {euros(a.pu_enfant)}€
          {animal ? ` — à partir de 5 ans si seul à ${animal}` : ""}
          {isMontgolfiereActivity(a) ? " — à partir de 7 ans uniquement" : ""}
        </span>
      )}
      {!!a.pu_enfant_3ans &&
        (isMontgolfiereActivity(a) ? (
          <span>4 à 7 ans (visites, sans montgolfière) {euros(a.pu_enfant_3ans)}€</span>
        ) : (
          <span>Enfant 2-3 ans {euros(a.pu_enfant_3ans)}€</span>
        ))}
      {!isQuadActivity(a) && !isSpaActivity(a) && !isMontgolfiereActivity(a) && (
        <span>Bébé {euros(a.pu_bebe)}€</span>
      )}
      {isMontgolfiereActivity(a) && (
        <span>Bébé {euros(a.pu_bebe)}€ — 0 à 3 ans, ne montent pas</span>
      )}
    </>
  );
}

export function CardPhoto({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const supabase = createClient();
    supabase.storage
      .from("activity-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);

  if (!url) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-[6px] bg-[#fafafa] text-sm text-[#666666]/50">
        Pas de photo
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-64 w-full rounded-[6px] object-cover" />;
}

export function InfoRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;
  return (
    <div className="flex items-start gap-3 border-b border-neutral-100 py-3 last:border-0">
      <RowIcon>{icon}</RowIcon>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[#666666]/60">{label}</p>
        {children ? children : <p className="text-sm text-neutral-700">{value}</p>}
      </div>
    </div>
  );
}

export function AvailabilityCalendar({
  jours,
  dates,
  editable,
  onToggleDate,
}: {
  jours: string[] | null | undefined;
  dates: string[] | null | undefined;
  editable: boolean;
  onToggleDate?: (iso: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const safeJours = jours || [];
  const safeDates = new Set(dates || []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstOfMonth.getDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100"
        >
          ‹
        </button>
        <p className="text-sm font-medium capitalize text-[#171717]">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
        {JOURS_SEMAINE.map((j) => (
          <div key={j}>{JOUR_ABREV[j]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const iso = isoDate(date);
          const weekday = WEEKDAY_JS_TO_FR[date.getDay()];
          const isPast = date < today;
          const isGreen = safeDates.has(iso);
          const isBlue = !isGreen && safeJours.includes(weekday);
          const isToday = iso === isoDate(today);
          const clickable = editable && !isPast && onToggleDate;
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onToggleDate(iso)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs ${
                isGreen
                  ? "bg-[#171717] text-white"
                  : isBlue
                    ? "bg-blue-100 text-blue-700"
                    : "text-neutral-400"
              } ${isToday ? "ring-1 ring-[#0070f3]" : ""} ${
                clickable ? "cursor-pointer hover:opacity-80" : isPast ? "opacity-30" : ""
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-100" /> Jour habituel
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#171717]" /> Confirmé
        </span>
      </div>
    </div>
  );
}

export function ChipMultiSelect({
  values,
  presets,
  onToggle,
  newValue,
  onNewValueChange,
  onAddCustom,
  placeholder,
}: {
  values: string[];
  presets: readonly string[];
  onToggle: (label: string) => void;
  newValue: string;
  onNewValueChange: (v: string) => void;
  onAddCustom: () => void;
  placeholder: string;
}) {
  const customValues = values.filter((v) => !(presets as readonly string[]).includes(v));
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {presets.map((label) => {
          const active = values.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => onToggle(label)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                active
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {active ? "✓ " : ""}
              {label}
            </button>
          );
        })}
      </div>
      {customValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {customValues.map((label) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-[#171717] bg-[#171717] px-3 py-1 text-xs font-medium text-white"
            >
              {label}
              <button onClick={() => onToggle(label)} className="hover:opacity-70">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={newValue}
          onChange={(e) => onNewValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddCustom();
            }
          }}
          placeholder={placeholder}
          className="input flex-1"
        />
        <button
          onClick={onAddCustom}
          className="whitespace-nowrap rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: "cards" | "rows";
  onChange: (m: "cards" | "rows") => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-neutral-200 p-0.5">
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={`rounded px-2.5 py-1 text-xs font-medium ${
          mode === "cards" ? "bg-[#171717] text-white" : "text-neutral-500 hover:bg-neutral-100"
        }`}
      >
        ▦ Cartes
      </button>
      <button
        type="button"
        onClick={() => onChange("rows")}
        className={`rounded px-2.5 py-1 text-xs font-medium ${
          mode === "rows" ? "bg-[#171717] text-white" : "text-neutral-500 hover:bg-neutral-100"
        }`}
      >
        ☰ Lignes
      </button>
    </div>
  );
}
