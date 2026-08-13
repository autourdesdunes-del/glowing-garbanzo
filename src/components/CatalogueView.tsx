"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueFaq,
  CatalogueItem,
  CatalogueJour,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
} from "@/lib/types";
import {
  A_PREVOIR_PRESETS,
  CATALOGUE_CATEGORIES,
  CATALOGUE_TAGS_PRESETS,
    CHAMPS_REQUIS_PRESETS,
  DUREE_OPTIONS,
  DUREE_OPTIONS_TRANSFERT,
  GUIDE_OPTIONS,
  INCLUS_PRESETS,
  JOURS_SEMAINE,
  NON_INCLUS_PRESETS,
  REGLES_ANNULATION,
  TYPE_MODIFICATION_OPTIONS,
  VEHICULES_TRANSFERT,
  ZONES_TRANSFERT,
} from "@/lib/constants";
import { Field } from "@/components/client-steps";
import PhotoUpload from "@/components/PhotoUpload";
import CatalogueModificationRequestModal from "@/components/CatalogueModificationRequestModal";
import { localDateStr } from "@/lib/dates";
import { useToast } from "@/components/ToastProvider";
import { chevalOuChameauMot, isChevalOuChameau } from "@/lib/resa";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function isQuadActivity(a: CatalogueItem) {
  return (a.nom || "").toLowerCase().includes("quad");
}

function isSpaActivity(a: CatalogueItem) {
  const n = (a.nom || "").toLowerCase();
  return n.includes("spa") || n.includes("massage");
}

function PriceSummary({ a }: { a: CatalogueItem }) {
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
        <span>Enfant {euros(a.pu_enfant)}€</span>
      )}
      {!!a.pu_enfant_3ans && <span>Enfant 3 ans {euros(a.pu_enfant_3ans)}€</span>}
      {!isQuadActivity(a) && !isSpaActivity(a) && <span>Bébé {euros(a.pu_bebe)}€</span>}
    </>
  );
}

const JOUR_ABREV: Record<string, string> = {
  Lundi: "L",
  Mardi: "M",
  Mercredi: "M",
  Jeudi: "J",
  Vendredi: "V",
  Samedi: "S",
  Dimanche: "D",
};

function CardPhoto({ path, alt }: { path: string; alt: string }) {
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

function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fafafa] text-[#666666]">
      {children}
    </span>
  );
}

function IconAdulte() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
    </svg>
  );
}
function IconEnfant() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
      <circle cx="10" cy="7" r="2.4" />
      <path d="M5.5 16.5c0-2.6 2-4.3 4.5-4.3s4.5 1.7 4.5 4.3" strokeLinecap="round" />
    </svg>
  );
}
function IconBebe() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
      <circle cx="10" cy="8" r="4" />
      <path d="M7.5 8.2c.4.5 1 .8 2.5.8s2.1-.3 2.5-.8" strokeLinecap="round" />
      <path d="M10 4v-.8" strokeLinecap="round" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10.5 3.5H16v5.5L9 16 3.5 10.5 10.5 3.5Z" strokeLinejoin="round" />
      <circle cx="13" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 17.5S15.5 12.4 15.5 8.3A5.5 5.5 0 0 0 4.5 8.3c0 4.1 5.5 9.2 5.5 9.2Z" strokeLinejoin="round" />
      <circle cx="10" cy="8.2" r="1.8" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M4 10.5 8 14.5 16 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCross() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M5 5 15 15M15 5 5 15" strokeLinecap="round" />
    </svg>
  );
}
function IconBag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="4" y="7" width="12" height="9" rx="1.5" />
      <path d="M7 7V5.5A3 3 0 0 1 10 2.5v0a3 3 0 0 1 3 3V7" />
    </svg>
  );
}
function IconGuide() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="6" r="2.6" />
      <path d="M4.5 17c0-3 2.4-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
      <path d="M4 10.5 2.5 9M16 10.5 17.5 9" strokeLinecap="round" />
    </svg>
  );
}

function InfoRow({
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

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const WEEKDAY_JS_TO_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

function isoDate(d: Date) {
  return localDateStr(d);
}

function AvailabilityCalendar({
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

function ChipMultiSelect({
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

function ViewToggle({
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

export default function CatalogueView({
  items: itemsAll,
  onAdd,
  onUpdate,
  onReorder,
  onDelete,
  onDuplicate,
  tarifs,
  onAddTarif,
  onUpdateTarif,
  onDeleteTarif,
  transfertTarifs,
  onAddTransfertTarif,
  onUpdateTransfertTarif,
  onDeleteTransfertTarif,
  options,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  faq,
  onAddFaq,
  onUpdateFaq,
  onDeleteFaq,
  jours,
  onAddJour,
  onUpdateJour,
  onDeleteJour,
  onMoveJour,
  topVenteIds,
  topRentabiliteIds,
  canSeeMargins,
}: {
  items: CatalogueItem[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CatalogueItem>) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: CatalogueItem) => void;
  tarifs: Record<string, CatalogueTarif[]>;
  onAddTarif: (catalogueItemId: string) => void;
  onUpdateTarif: (catalogueItemId: string, tarifId: string, patch: Partial<CatalogueTarif>) => void;
  onDeleteTarif: (catalogueItemId: string, tarifId: string) => void;
  transfertTarifs: Record<string, CatalogueTransfertTarif[]>;
  onAddTransfertTarif: (catalogueItemId: string) => void;
  onUpdateTransfertTarif: (
    catalogueItemId: string,
    tarifId: string,
    patch: Partial<CatalogueTransfertTarif>
  ) => void;
  onDeleteTransfertTarif: (catalogueItemId: string, tarifId: string) => void;
  options: Record<string, CatalogueOption[]>;
  onAddOption: (catalogueItemId: string) => void;
  onUpdateOption: (catalogueItemId: string, optionId: string, patch: Partial<CatalogueOption>) => void;
  onDeleteOption: (catalogueItemId: string, optionId: string) => void;
  faq: Record<string, CatalogueFaq[]>;
  onAddFaq: (catalogueItemId: string) => void;
  onUpdateFaq: (catalogueItemId: string, faqId: string, patch: Partial<CatalogueFaq>) => void;
  onDeleteFaq: (catalogueItemId: string, faqId: string) => void;
  jours: Record<string, CatalogueJour[]>;
  onAddJour: (catalogueItemId: string) => void;
  onUpdateJour: (catalogueItemId: string, jourId: string, patch: Partial<CatalogueJour>) => void;
  onDeleteJour: (catalogueItemId: string, jourId: string) => void;
  onMoveJour: (catalogueItemId: string, jourId: string, direction: -1 | 1) => void;
  topVenteIds: Set<string>;
  topRentabiliteIds: Set<string>;
  canSeeMargins: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string>("Toutes");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [tagViewMode, setTagViewMode] = useState<"cards" | "rows">("cards");
  const [activityViewMode, setActivityViewMode] = useState<"cards" | "rows">("cards");
  const [newInclus, setNewInclus] = useState<Record<string, string>>({});
  const [newNonInclus, setNewNonInclus] = useState<Record<string, string>>({});
  const [newAPrevoir, setNewAPrevoir] = useState<Record<string, string>>({});
  const [newTag, setNewTag] = useState<Record<string, string>>({});
  const [newChampsRequis, setNewChampsRequis] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Le glisser-déposer normal se marie mal avec un clic simple sur le même
  // élément (un léger mouvement de souris pendant le clic déclenche un
  // drag au lieu d'ouvrir la fiche) — d'où ce mode dédié, explicite, plutôt
  // que rendre chaque carte/ligne draggable en permanence.
  const [reorderMode, setReorderMode] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  // Réordonner le catalogue est réservé à la Direction — l'ordre choisi
  // pilote aussi bien cet affichage que la liste de choix de l'assistant
  // "Ajouter une activité" côté équipe.
  const canReorder = canSeeMargins;
  // Le catalogue n'est modifiable que par la Direction — l'équipe le
  // consulte en lecture seule et ne voit que les activités validées (les
  // brouillons n'ont pas leur place dans un usage client/réservation).
  const items = canSeeMargins ? itemsAll : itemsAll.filter((a) => a.valide);

  const submitModificationRequest = async (payload: {
    catalogueItemIds: string[];
    typeModification: (typeof TYPE_MODIFICATION_OPTIONS)[number];
    autreDetail: string;
    explication: string;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const demandeurNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    const noms = payload.catalogueItemIds
      .map((id) => itemsAll.find((a) => a.id === id)?.nom)
      .filter((n): n is string => !!n);
    const { error } = await supabase.from("catalogue_modification_requests").insert({
      catalogue_item_ids: payload.catalogueItemIds,
      catalogue_item_noms: noms,
      type_modification: payload.typeModification,
      autre_detail: payload.autreDetail,
      explication: payload.explication,
      demandeur_id: user.id,
      demandeur_nom: demandeurNom,
    });
    if (error) {
      toast("Échec de l'envoi de la demande.");
      return;
    }
    toast("Demande envoyée à la Direction.");
    setRequestOpen(false);
  };

  const allTags = Array.from(
    new Set([...CATALOGUE_TAGS_PRESETS, ...items.flatMap((a) => a.tags || [])])
  );
  const tagCounts = allTags.map((tag) => ({
    tag,
    count: items.filter((a) => (a.tags || []).includes(tag)).length,
  }));
  const sansCategorieCount = items.filter((a) => !(a.tags && a.tags.length)).length;
  const filtered = items
    .filter((a) => categoryFilter === "Toutes" || a.categorie === categoryFilter)
    .filter((a) => {
      if (!selectedTag || selectedTag === "__ALL__") return true;
      if (selectedTag === "__SANS__") return !(a.tags && a.tags.length);
      return (a.tags || []).includes(selectedTag);
    });
  const normalize = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const searchResults = searchQuery.trim()
    ? items.filter((a) => normalize(a.nom).includes(normalize(searchQuery)))
    : [];

  const toggleJour = (a: CatalogueItem, j: string) => {
    const jours = a.jours_disponibles || [];
    const has = jours.includes(j);
    onUpdate(a.id, {
      jours_disponibles: has ? jours.filter((d) => d !== j) : [...jours, j],
    });
  };

  const toggleListField = (
    a: CatalogueItem,
    field: "inclus_liste" | "non_inclus_liste" | "a_prevoir_liste" | "tags" | "champs_requis_liste",
    label: string
  ) => {
    const liste = a[field] || [];
    const has = liste.includes(label);
    onUpdate(a.id, {
      [field]: has ? liste.filter((d) => d !== label) : [...liste, label],
    });
  };

  const addCustomListField = (
    a: CatalogueItem,
    field: "inclus_liste" | "non_inclus_liste" | "a_prevoir_liste" | "tags" | "champs_requis_liste",
    value: string,
    clear: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const liste = a[field] || [];
    if (!liste.includes(trimmed)) onUpdate(a.id, { [field]: [...liste, trimmed] });
    clear();
  };

  const renderBrouillon = (a: CatalogueItem) => (
    <div className="rounded-[6px] border border-[#f5a623]/40 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-[#f5a623]/20 px-3 py-1 text-xs text-[#666666]">
                  ✎ Brouillon
                </span>
                <button
                  onClick={() => onUpdate(a.id, { valide: true })}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm text-white hover:opacity-90"
                >
                  ✓ Valider cette activité
                </button>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  placeholder="Nom de l'activité"
                  value={a.nom}
                  onChange={(e) => onUpdate(a.id, { nom: e.target.value })}
                  className="input flex-1"
                />
                <button
                  onClick={() => onDuplicate(a)}
                  className="text-xs text-[#171717] hover:underline"
                >
                  Dupliquer
                </button>
                <button
                  onClick={() => onDelete(a.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              </div>

              <div className="mb-3">
                <Field label="Description (pour une employée qui ne connaît pas l'activité)">
                  <textarea
                    value={a.description}
                    onChange={(e) => onUpdate(a.id, { description: e.target.value })}
                    placeholder="Explique en quelques phrases ce que c'est, comment ça se passe, ce qui rend l'activité intéressante…"
                    className="input min-h-[90px] resize-y"
                  />
                </Field>
              </div>

              <div className="mb-3">
                <Field label="Programme complet">
                  <textarea
                    value={a.programme}
                    onChange={(e) => onUpdate(a.id, { programme: e.target.value })}
                    placeholder={"ex. 8h Départ hôtel\n10h Arrivée au site\n12h Déjeuner\n…"}
                    className="input min-h-[110px] resize-y"
                  />
                </Field>
              </div>

              <div className="mb-3">
                <p className="mb-1 text-sm font-medium text-neutral-700">
                  Programme jour par jour (circuits sur plusieurs jours)
                </p>
                <p className="mb-1.5 text-xs text-neutral-400">
                  Pour un circuit comme Le Caire 2 jours ou Abu Simbel — laisse vide si
                  l&apos;activité tient dans le champ &quot;Programme complet&quot; ci-dessus.
                </p>
                {[...(jours[a.id] || [])]
                  .sort((x, y) => x.ordre - y.ordre)
                  .map((j, idx, arr) => (
                    <div key={j.id} className="mb-2 rounded-md border border-neutral-200 p-2">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-500">
                          Jour {idx + 1}
                        </span>
                        <input
                          placeholder="Titre (ex. Arrivée au Caire)"
                          value={j.titre}
                          onChange={(e) => onUpdateJour(a.id, j.id, { titre: e.target.value })}
                          className="input flex-1"
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onMoveJour(a.id, j.id, -1)}
                          className="text-neutral-500 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === arr.length - 1}
                          onClick={() => onMoveJour(a.id, j.id, 1)}
                          className="text-neutral-500 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => onDeleteJour(a.id, j.id)}
                          className="text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                      <textarea
                        placeholder="Programme de ce jour…"
                        value={j.description}
                        onChange={(e) => onUpdateJour(a.id, j.id, { description: e.target.value })}
                        className="input min-h-[70px] resize-y"
                      />
                    </div>
                  ))}
                <button
                  onClick={() => onAddJour(a.id)}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  + Ajouter un jour
                </button>
              </div>

              <div className="mb-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">
                  Jours où l&apos;activité a lieu
                </p>
                <div className="flex flex-wrap gap-2">
                  {JOURS_SEMAINE.map((j) => {
                    const active = (a.jours_disponibles || []).includes(j);
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => toggleJour(a, j)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          active
                            ? "border-[#171717] bg-[#171717] text-white"
                            : "border-neutral-300 text-neutral-600"
                        }`}
                      >
                        {j}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-neutral-400">
                  Le calendrier du mois (visible une fois l&apos;activité validée) surlignera
                  automatiquement en bleu toutes les dates correspondant aux jours cochés
                  ci-dessus.
                </p>
              </div>

              <div className="mb-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">
                  Tags (pour trier le catalogue par thème)
                </p>
                <ChipMultiSelect
                  values={a.tags || []}
                  presets={CATALOGUE_TAGS_PRESETS}
                  onToggle={(label) => toggleListField(a, "tags", label)}
                  newValue={newTag[a.id] || ""}
                  onNewValueChange={(v) => setNewTag((prev) => ({ ...prev, [a.id]: v }))}
                  onAddCustom={() =>
                    addCustomListField(a, "tags", newTag[a.id] || "", () =>
                      setNewTag((prev) => ({ ...prev, [a.id]: "" }))
                    )
                  }
                  placeholder="Autre thème…"
                />
              </div>

              <div className="mb-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">Tarification</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdate(a.id, { tarif_mode: "personne" })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      a.tarif_mode !== "groupe"
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Par personne
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate(a.id, { tarif_mode: "groupe" })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      a.tarif_mode === "groupe"
                        ? "border-[#C9973E] bg-[#C9973E] text-white"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Forfait groupe
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-neutral-400">
                  Forfait groupe : pour les activités comme un speedboat ou un yacht, où le prix
                  n&apos;est pas par personne mais un forfait de base pour un nombre de
                  personnes, plus un tarif par personne supplémentaire.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Catégorie">
                  <select
                    value={a.categorie}
                    onChange={(e) => onUpdate(a.id, { categorie: e.target.value })}
                    className="input"
                  >
                    {CATALOGUE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Durée">
                  <select
                    value={a.duree}
                    onChange={(e) => onUpdate(a.id, { duree: e.target.value })}
                    className="input"
                  >
                    {(a.categorie === "Transfert" ? DUREE_OPTIONS_TRANSFERT : DUREE_OPTIONS).map(
                      (d) => (
                        <option key={d || "vide"} value={d}>
                          {d || "—"}
                        </option>
                      )
                    )}
                  </select>
                </Field>
                <Field label="Disponibilités (précisions libres)">
                  <input
                    placeholder="ex. sauf jours fériés, sur réservation 48h avant…"
                    value={a.disponibilites}
                    onChange={(e) => onUpdate(a.id, { disponibilites: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Guide">
                  <select
                    value={a.guide}
                    onChange={(e) => onUpdate(a.id, { guide: e.target.value })}
                    className="input"
                  >
                    {GUIDE_OPTIONS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Règle d'annulation">
                  <select
                    value={a.regle_annulation}
                    onChange={(e) =>
                      onUpdate(a.id, {
                        regle_annulation: e.target.value as CatalogueItem["regle_annulation"],
                      })
                    }
                    className="input"
                  >
                    {REGLES_ANNULATION.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end pb-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={a.guide_francophone_sur_demande}
                      onChange={(e) =>
                        onUpdate(a.id, { guide_francophone_sur_demande: e.target.checked })
                      }
                    />
                    ⭐ Guide francophone sur demande
                  </label>
                </div>
                <div className="flex items-end pb-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdate(a.id, { guide_egyptologue: !a.guide_egyptologue })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      a.guide_egyptologue
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-neutral-300 text-neutral-600 hover:border-blue-400"
                    }`}
                  >
                    ★ Guide francophone égyptologue
                  </button>
                </div>
                <div className="flex items-end gap-2 pb-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={a.guide_supplement}
                      onChange={(e) => onUpdate(a.id, { guide_supplement: e.target.checked })}
                    />
                    Guide en supplément
                  </label>
                  {a.guide_supplement && (
                    <input
                      type="number"
                      value={a.guide_supplement_prix}
                      onChange={(e) =>
                        onUpdate(a.id, { guide_supplement_prix: Number(e.target.value) })
                      }
                      className="input w-20"
                      placeholder="€"
                    />
                  )}
                </div>
                {a.tarif_mode !== "groupe" ? (
                  <>
                    <Field label="PU adulte (€)">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={a.pu_adulte}
                          onChange={(e) => onUpdate(a.id, { pu_adulte: Number(e.target.value) })}
                          className="input w-20"
                        />
                        <input
                          value={a.pu_adulte_age}
                          onChange={(e) => onUpdate(a.id, { pu_adulte_age: e.target.value })}
                          className="input min-w-[120px] flex-1"
                          placeholder="ex. 11 ans et +"
                        />
                      </div>
                    </Field>
                    {isSpaActivity(a) ? (
                      <Field label="Âge minimum">
                        <p className="mt-1.5 text-xs font-medium text-[#0F5C56]">
                          ℹ️ À partir de 10 ans uniquement
                        </p>
                      </Field>
                    ) : (
                      <Field label="PU enfant (€)">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={a.pu_enfant}
                            onChange={(e) => onUpdate(a.id, { pu_enfant: Number(e.target.value) })}
                            className="input w-20"
                          />
                          <input
                            value={a.pu_enfant_age}
                            onChange={(e) => onUpdate(a.id, { pu_enfant_age: e.target.value })}
                            className="input min-w-[120px] flex-1"
                            placeholder="ex. 4 à 10 ans"
                          />
                        </div>
                        {isQuadActivity(a) && (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            ⚠ Interdit aux enfants de moins de 6 ans
                          </p>
                        )}
                      </Field>
                    )}
                    {!isQuadActivity(a) && !isSpaActivity(a) && (
                      <Field label="PU bébé (€)">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={a.pu_bebe}
                            onChange={(e) => onUpdate(a.id, { pu_bebe: Number(e.target.value) })}
                            className="input w-20"
                          />
                          <input
                            value={a.pu_bebe_age}
                            onChange={(e) => onUpdate(a.id, { pu_bebe_age: e.target.value })}
                            className="input min-w-[120px] flex-1"
                            placeholder="ex. 0 à 3 ans"
                          />
                        </div>
                      </Field>
                    )}
                    <Field label="PU accompagnateur (€)">
                      <div className="flex gap-2">
                          <input
                                  type="number"
                                  value={a.pu_accompagnateur}
                                  onChange={(e) => onUpdate(a.id, { pu_accompagnateur: Number(e.target.value) })}
                                  className="input w-20"
                                />
                          <input
                                  value={a.pu_accompagnateur_age}
                                  onChange={(e) => onUpdate(a.id, { pu_accompagnateur_age: e.target.value })}
                                  className="input min-w-[120px] flex-1"
                                  placeholder="ex. accompagnant non-plongeur"
                                />
                      </div>
                      {isChevalOuChameau(a.nom) && (
                        <p className="mt-1 text-xs text-[#8B4531]">
                          💡 Cheval/chameau : un enfant qui monte seul paie le tarif adulte (prix par
                          cheval/chameau) — mets ce tarif accompagnateur à 0 €, un enfant derrière un
                          adulte est compté ici mais ne paie rien.
                        </p>
                      )}
                    </Field>
                    <Field label="PU enfant 3 ans (€)">
                      <input
                        type="number"
                        value={a.pu_enfant_3ans}
                        onChange={(e) => onUpdate(a.id, { pu_enfant_3ans: Number(e.target.value) })}
                        className="input w-20"
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Prix forfait de base (€)">
                      <input
                        type="number"
                        value={a.prix_groupe_base}
                        onChange={(e) => onUpdate(a.id, { prix_groupe_base: Number(e.target.value) })}
                        className="input"
                      />
                    </Field>
                    <Field label="Nombre de personnes incluses">
                      <input
                        type="number"
                        min={0}
                        value={a.prix_groupe_base_pax}
                        onChange={(e) => onUpdate(a.id, { prix_groupe_base_pax: Number(e.target.value) })}
                        className="input"
                      />
                    </Field>
                    <Field label="Note tarif (si prix forfait à 0 = variable)">
                      <input
                        value={a.prix_groupe_note}
                        onChange={(e) => onUpdate(a.id, { prix_groupe_note: e.target.value })}
                        placeholder="ex. 25 €/quad, 110 €/buggy selon le nombre choisi"
                        className="input"
                      />
                    </Field>
                    <Field label="PU personne supp. (€)">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={a.prix_groupe_extra1}
                          onChange={(e) => onUpdate(a.id, { prix_groupe_extra1: Number(e.target.value) })}
                          className="input w-20"
                        />
                        <input
                          value={a.prix_groupe_extra1_age}
                          onChange={(e) => onUpdate(a.id, { prix_groupe_extra1_age: e.target.value })}
                          className="input min-w-[120px] flex-1"
                          placeholder="ex. 11 ans et +"
                        />
                      </div>
                    </Field>
                    <Field label="PU enfant supp. (€)">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={a.prix_groupe_extra_enfant}
                          onChange={(e) => onUpdate(a.id, { prix_groupe_extra_enfant: Number(e.target.value) })}
                          className="input w-20"
                        />
                        <input
                          value={a.prix_groupe_extra_enfant_age}
                          onChange={(e) => onUpdate(a.id, { prix_groupe_extra_enfant_age: e.target.value })}
                          className="input min-w-[120px] flex-1"
                          placeholder="ex. 4 à 10 ans"
                        />
                      </div>
                    </Field>
                    <Field label="PU bébé (€)">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={a.pu_bebe}
                          onChange={(e) => onUpdate(a.id, { pu_bebe: Number(e.target.value) })}
                          className="input w-20"
                        />
                        <input
                          value={a.pu_bebe_age}
                          onChange={(e) => onUpdate(a.id, { pu_bebe_age: e.target.value })}
                          className="input min-w-[120px] flex-1"
                          placeholder="ex. 0 à 3 ans"
                        />
                      </div>
                    </Field>
                    <p className="col-span-3 text-xs text-neutral-400">
                      Ex. speedboat : forfait 150 € pour 2 personnes, puis 10 €/personne
                      supplémentaire. Ex. yacht : forfait 700 € pour 10 personnes, puis
                      10 €/adulte supp. et 5 €/enfant supp.
                    </p>
                  </>
                )}
                {canSeeMargins && (
                  <Field label="Marge cible (%)">
                    <input
                      type="number"
                      value={a.marge_pct}
                      onChange={(e) => onUpdate(a.id, { marge_pct: Number(e.target.value) })}
                      className="input"
                    />
                  </Field>
                )}
                <Field label="Horaire approximatif">
                  <input
                    value={a.horaire_approx}
                    onChange={(e) => onUpdate(a.id, { horaire_approx: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Point de RDV">
                  <input
                    value={a.point_rdv}
                    onChange={(e) => onUpdate(a.id, { point_rdv: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>

              <div className="mt-3">
                <Field label="Spécificités importantes (apparaissent en rouge sur la fiche)">
                  <textarea
                    value={a.specificites}
                    onChange={(e) => onUpdate(a.id, { specificites: e.target.value })}
                    placeholder={
                      "ex. Uniquement pour les familles avec enfants\nex. Nécessite un acompte de 120€ par personne à la réservation\nex. 2 adultes minimum\nex. Ne pas recommander cette activité, renvoyer vers Le Caire en mini-bus"
                    }
                    className="input min-h-[70px] resize-y"
                  />
                </Field>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">Inclus</p>
                <ChipMultiSelect
                  values={a.inclus_liste || []}
                  presets={INCLUS_PRESETS}
                  onToggle={(label) => toggleListField(a, "inclus_liste", label)}
                  newValue={newInclus[a.id] || ""}
                  onNewValueChange={(v) => setNewInclus((prev) => ({ ...prev, [a.id]: v }))}
                  onAddCustom={() =>
                    addCustomListField(a, "inclus_liste", newInclus[a.id] || "", () =>
                      setNewInclus((prev) => ({ ...prev, [a.id]: "" }))
                    )
                  }
                  placeholder="Autre chose d'inclus…"
                />
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">Non inclus</p>
                <ChipMultiSelect
                  values={a.non_inclus_liste || []}
                  presets={NON_INCLUS_PRESETS}
                  onToggle={(label) => toggleListField(a, "non_inclus_liste", label)}
                  newValue={newNonInclus[a.id] || ""}
                  onNewValueChange={(v) => setNewNonInclus((prev) => ({ ...prev, [a.id]: v }))}
                  onAddCustom={() =>
                    addCustomListField(a, "non_inclus_liste", newNonInclus[a.id] || "", () =>
                      setNewNonInclus((prev) => ({ ...prev, [a.id]: "" }))
                    )
                  }
                  placeholder="Autre chose de non inclus…"
                />
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">À prévoir</p>
                <ChipMultiSelect
                  values={a.a_prevoir_liste || []}
                  presets={A_PREVOIR_PRESETS}
                  onToggle={(label) => toggleListField(a, "a_prevoir_liste", label)}
                  newValue={newAPrevoir[a.id] || ""}
                  onNewValueChange={(v) => setNewAPrevoir((prev) => ({ ...prev, [a.id]: v }))}
                  onAddCustom={() =>
                    addCustomListField(a, "a_prevoir_liste", newAPrevoir[a.id] || "", () =>
                      setNewAPrevoir((prev) => ({ ...prev, [a.id]: "" }))
                    )
                  }
                  placeholder="Autre chose à prévoir…"
                />
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-neutral-700">
                  Champs obligatoires pour réserver cette activité
                </p>
                <p className="mb-1.5 text-xs text-neutral-400">
                  Tant que ces informations ne sont pas remplies sur une réservation de ce type,
                  l&apos;employée ne pourra pas la valider. Un champ personnalisé apparaît comme une
                  case à cocher sur la réservation.
                </p>
                <ChipMultiSelect
                  values={a.champs_requis_liste || []}
                  presets={CHAMPS_REQUIS_PRESETS}
                  onToggle={(label) => toggleListField(a, "champs_requis_liste", label)}
                  newValue={newChampsRequis[a.id] || ""}
                  onNewValueChange={(v) => setNewChampsRequis((prev) => ({ ...prev, [a.id]: v }))}
                  onAddCustom={() =>
                    addCustomListField(a, "champs_requis_liste", newChampsRequis[a.id] || "", () =>
                      setNewChampsRequis((prev) => ({ ...prev, [a.id]: "" }))
                    )
                  }
                  placeholder="Autre champ obligatoire…"
                />
              </div>
              <div className="mt-3">
                <p className="mb-1 text-sm font-medium text-neutral-700">
                  Options proposées (privatif, dîner spectacle, visite supplémentaire…)
                </p>
                {(options[a.id] || []).map((o) => (
                  <div key={o.id} className="mb-2 rounded-md border border-neutral-200 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Nom de l'option (ex. Privatif)"
                        value={o.nom}
                        onChange={(e) => onUpdateOption(a.id, o.id, { nom: e.target.value })}
                        className="input flex-1"
                      />
                      <input
                        type="number"
                        placeholder="Prix €"
                        value={o.prix}
                        onChange={(e) => onUpdateOption(a.id, o.id, { prix: Number(e.target.value) })}
                        className="input w-24"
                      />
                      <button onClick={() => onDeleteOption(a.id, o.id)} className="text-red-600">
                        ✕
                      </button>
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateOption(a.id, o.id, { mode: "personne" })}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          o.mode !== "groupe"
                            ? "border-[#171717] bg-[#171717] text-white"
                            : "border-neutral-300 text-neutral-600"
                        }`}
                      >
                        Prix par personne
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateOption(a.id, o.id, { mode: "groupe" })}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          o.mode === "groupe"
                            ? "border-[#C9973E] bg-[#C9973E] text-white"
                            : "border-neutral-300 text-neutral-600"
                        }`}
                      >
                        Prix groupe (forfait)
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => onAddOption(a.id)}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  + Ajouter une option
                </button>
              </div>
              {a.categorie === "Transfert" && (
                <div className="mt-3">
                  <p className="mb-1 text-sm font-medium text-neutral-700">
                    Tarifs de transfert par zone
                  </p>
                  <p className="mb-1.5 text-xs text-neutral-400">
                    Le prix d&apos;un transfert n&apos;est jamais par personne : c&apos;est un
                    forfait pour le trajet, qui dépend de la zone de l&apos;hôtel (plus ou moins
                    loin) et du véhicule utilisé (voiture ou van selon le nombre de personnes).
                  </p>
                  {(transfertTarifs[a.id] || []).map((t) => (
                    <div key={t.id} className="mb-2 flex flex-wrap items-center gap-2">
                      <select
                        value={t.zone}
                        onChange={(e) =>
                          onUpdateTransfertTarif(a.id, t.id, { zone: e.target.value })
                        }
                        className="input min-w-[140px] flex-1"
                      >
                        <option value="">— Zone —</option>
                        {ZONES_TRANSFERT.map((z) => (
                          <option key={z}>{z}</option>
                        ))}
                      </select>
                      <select
                        value={t.vehicule}
                        onChange={(e) =>
                          onUpdateTransfertTarif(a.id, t.id, { vehicule: e.target.value })
                        }
                        className="input min-w-[160px] flex-1"
                      >
                        <option value="">— Véhicule —</option>
                        {VEHICULES_TRANSFERT.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Prix forfait €"
                        value={t.prix}
                        onChange={(e) =>
                          onUpdateTransfertTarif(a.id, t.id, { prix: Number(e.target.value) })
                        }
                        className="input w-28"
                      />
                      <button
                        onClick={() => onDeleteTransfertTarif(a.id, t.id)}
                        className="text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onAddTransfertTarif(a.id)}
                    className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    + Ajouter un tarif de transfert
                  </button>
                </div>
              )}
              <div className="mt-3">
                <p className="mb-1 text-sm font-medium text-neutral-700">
                  FAQ (questions fréquentes des clients)
                </p>
                {(faq[a.id] || []).map((f) => (
                  <div key={f.id} className="mb-2 rounded-md border border-neutral-200 p-2">
                    <div className="mb-1.5 flex items-center gap-2">
                      <input
                        placeholder="Question"
                        value={f.question}
                        onChange={(e) => onUpdateFaq(a.id, f.id, { question: e.target.value })}
                        className="input flex-1"
                      />
                      <button onClick={() => onDeleteFaq(a.id, f.id)} className="text-red-600">
                        ✕
                      </button>
                    </div>
                    <textarea
                      placeholder="Réponse"
                      value={f.reponse}
                      onChange={(e) => onUpdateFaq(a.id, f.id, { reponse: e.target.value })}
                      className="input min-h-[60px] resize-y"
                    />
                  </div>
                ))}
                <button
                  onClick={() => onAddFaq(a.id)}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  + Ajouter une question
                </button>
              </div>

              <div className="mt-3">
                <PhotoUpload
                  path={a.photo_path}
                  onPathChange={(photo_path) => onUpdate(a.id, { photo_path })}
                />
              </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-6">
      {requestOpen && (
        <CatalogueModificationRequestModal
          items={items}
          onSubmit={submitModificationRequest}
          onClose={() => setRequestOpen(false)}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#171717]">
            Catalogue d&apos;activités
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Rempli une fois, réutilisé pour chaque réservation — pense à une nouvelle employée qui
            découvre l&apos;activité : sois précise et complète.
          </p>
        </div>
        {canSeeMargins ? (
          <button
            onClick={() => {
              onAdd();
              setSelectedTag("__ALL__");
              setSelectedActivityId(null);
            }}
            className="whitespace-nowrap rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Nouvelle activité
          </button>
        ) : (
          <button
            onClick={() => setRequestOpen(true)}
            className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Demander une modification
          </button>
        )}
      </div>

      <div className="relative">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une activité par nom…"
          className="input w-full"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        )}
      </div>

      {searchQuery.trim() ? (
        <div className="space-y-3">
          {searchResults.length === 0 && (
            <p className="text-sm text-neutral-400">
              Aucune activité ne correspond à &laquo; {searchQuery} &raquo;.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {searchResults.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setSelectedTag("__ALL__");
                  setSelectedActivityId(a.id);
                  setSearchQuery("");
                }}
                className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-left hover:border-[#171717]"
              >
                <p className="font-heading text-base font-semibold text-[#171717]">
                  {a.nom || "Sans nom"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">{a.categorie}</p>
                {!a.valide ? (
                  <span className="mt-1.5 inline-block rounded-full bg-[#f5a623]/20 px-2 py-0.5 text-[11px] text-[#666666]">
                    ✎ Brouillon
                  </span>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
                    <PriceSummary a={a} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : !selectedTag ? (
        <>
          <div className="flex items-center justify-end">
            <ViewToggle mode={tagViewMode} onChange={setTagViewMode} />
          </div>
          {tagViewMode === "cards" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                onClick={() => setSelectedTag("__ALL__")}
                className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-left hover:border-[#171717]"
              >
                <p className="font-heading text-base font-semibold text-[#171717]">
                  Toutes les activités
                </p>
                <p className="mt-1 text-xs text-neutral-400">{items.length} activité(s)</p>
              </button>
              {tagCounts.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-left hover:border-[#171717]"
                >
                  <p className="font-heading text-base font-semibold text-[#171717]">{tag}</p>
                  <p className="mt-1 text-xs text-neutral-400">{count} activité(s)</p>
                </button>
              ))}
              {sansCategorieCount > 0 && (
                <button
                  onClick={() => setSelectedTag("__SANS__")}
                  className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-left hover:border-[#171717]"
                >
                  <p className="font-heading text-base font-semibold text-[#171717]">
                    Sans catégorie
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">{sansCategorieCount} activité(s)</p>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              <button
                onClick={() => setSelectedTag("__ALL__")}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#fafafa]"
              >
                <p className="font-heading text-sm font-semibold text-[#171717]">
                  Toutes les activités
                </p>
                <p className="text-xs text-neutral-400">{items.length} activité(s)</p>
              </button>
              {tagCounts.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#fafafa]"
                >
                  <p className="font-heading text-sm font-semibold text-[#171717]">{tag}</p>
                  <p className="text-xs text-neutral-400">{count} activité(s)</p>
                </button>
              ))}
              {sansCategorieCount > 0 && (
                <button
                  onClick={() => setSelectedTag("__SANS__")}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#fafafa]"
                >
                  <p className="font-heading text-sm font-semibold text-[#171717]">
                    Sans catégorie
                  </p>
                  <p className="text-xs text-neutral-400">{sansCategorieCount} activité(s)</p>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => {
              setSelectedTag(null);
              setSelectedActivityId(null);
              setReorderMode(false);
            }}
            className="text-sm font-medium text-[#171717] hover:underline"
          >
            ← Toutes les catégories
          </button>

          <div className="flex flex-wrap gap-2">
            {["Toutes", ...CATALOGUE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  categoryFilter === cat
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {selectedActivityId ? (
            (() => {
              const a = items.find((i) => i.id === selectedActivityId);
              if (!a) return null;
              if (!a.valide) {
                return (
                  <div>
                    <button
                      onClick={() => setSelectedActivityId(null)}
                      className="mb-3 text-sm font-medium text-[#171717] hover:underline"
                    >
                      ← Toutes les activités
                    </button>
                    {renderBrouillon(a)}
                  </div>
                );
              }
              return (
                <div>
                  <button
                    onClick={() => setSelectedActivityId(null)}
                    className="mb-3 text-sm font-medium text-[#171717] hover:underline"
                  >
                    ← Toutes les activités
                  </button>
            <div
              key={a.id}
              className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
                {/* LEFT: photo + description + details */}
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-[#171717]">
                        {a.nom || "Sans nom"}
                      </h3>
                      <p className="text-xs text-neutral-400">{a.categorie}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(a.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[#171717]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#171717]"
                          >
                            {tag}
                          </span>
                        ))}
                        {topVenteIds.has(a.id) && (
                          <span className="rounded-full bg-[#171717]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#666666]">
                            🏆 Top des ventes
                          </span>
                        )}
                        {canSeeMargins && topRentabiliteIds.has(a.id) && (
                          <span className="rounded-full bg-[#0070f3]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#0070f3]">
                            💰 Top rentabilité
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {canSeeMargins && a.marge_pct > 0 && (
                        <span className="rounded-full bg-[#0070f3]/10 px-2.5 py-1 text-[11px] font-medium text-[#0070f3]">
                          Marge cible {a.marge_pct}%
                        </span>
                      )}
                      {canSeeMargins && (
                        <>
                          <button
                            onClick={() => onDuplicate(a)}
                            className="rounded-md border border-[#171717]/20 px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#fafafa]/60"
                          >
                            ⧉ Dupliquer
                          </button>
                          <button
                            onClick={() => onUpdate(a.id, { valide: false })}
                            className="rounded-md border border-[#171717]/20 px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#fafafa]/60"
                          >
                            ✎ Modifier
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="relative mb-4">
                    <CardPhoto path={a.photo_path} alt={a.nom} />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      {a.duree && (
                        <span className="rounded-full border border-[#eaeaea] bg-white/90 px-3 py-1 text-[11px] font-medium text-[#171717] backdrop-blur">
                          ⏱ {a.duree}
                        </span>
                      )}
                      {a.horaire_approx && (
                        <span className="rounded-full border border-[#eaeaea] bg-white/90 px-3 py-1 text-[11px] font-medium text-[#171717] backdrop-blur">
                          🕐 {a.horaire_approx}
                        </span>
                      )}
                      {a.point_rdv && (
                        <span className="rounded-full border border-[#eaeaea] bg-white/90 px-3 py-1 text-[11px] font-medium text-[#171717] backdrop-blur">
                          📍 {a.point_rdv}
                        </span>
                      )}
                    </div>
                  </div>

                  {a.specificites && (
                    <div className="mb-4 whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                      ⚠ {a.specificites}
                    </div>
                  )}

                  <h4 className="mb-2 text-sm font-semibold text-[#171717]">Description</h4>
                  <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                    {a.description || (
                      <span className="italic text-neutral-400">
                        Pas encore de description — ajoute-la en modifiant l&apos;activité.
                      </span>
                    )}
                  </p>
                  <div className="mb-5">
                    <div className="flex gap-1.5">
                      {JOURS_SEMAINE.map((j) => {
                        const active = (a.jours_disponibles || []).includes(j);
                        return (
                          <div
                            key={j}
                            title={j}
                            className={`flex h-8 w-8 flex-1 items-center justify-center rounded-full text-xs font-medium ${
                              active
                                ? "border-2 border-[#171717] text-[#171717]"
                                : "border border-neutral-200 text-neutral-300"
                            }`}
                          >
                            {JOUR_ABREV[j]}
                          </div>
                        );
                      })}
                    </div>
                    {a.disponibilites && (
                      <p className="mt-2 text-xs text-neutral-500">ℹ️ {a.disponibilites}</p>
                    )}
                  </div>

                  {a.programme && (
                    <>
                      <h4 className="mb-2 text-sm font-semibold text-[#171717]">
                        Programme complet
                      </h4>
                      <p className="mb-5 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                        {a.programme}
                      </p>
                    </>
                  )}

                  {(() => {
                    const sortedJours = [...(jours[a.id] || [])].sort((x, y) => x.ordre - y.ordre);
                    if (sortedJours.length === 0) return null;
                    return (
                      <>
                        <h4 className="mb-2 text-sm font-semibold text-[#171717]">
                          Programme jour par jour
                        </h4>
                        <div className="mb-5 space-y-3">
                          {sortedJours.map((j, idx) => (
                            <div key={j.id}>
                              <p className="text-sm font-semibold text-[#171717]">
                                Jour {idx + 1}
                                {j.titre ? ` — ${j.titre}` : ""}
                              </p>
                              <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                                {j.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  <h4 className="mb-1 text-sm font-semibold text-[#171717]">
                    Ce qu&apos;il faut savoir
                  </h4>
                  <div className="mb-5">
                    <InfoRow icon={<IconGuide />} label="Guide">
                      <p className="text-sm text-neutral-700">
                    {a.guide && a.guide !== "Aucun" ? a.guide : "Pas de guide dédié"}
                        {a.guide_francophone_sur_demande && (
                          <span className="ml-1.5 text-[#f5a623]">
                            ⭐ Guide francophone sur demande
                          </span>
                        )}
                        {a.guide_egyptologue && (
                          <span className="ml-1.5 font-medium text-blue-600">
                            ★ Guide francophone égyptologue
                          </span>
                        )}
                        {a.guide_supplement && (
                          <span className="ml-1.5 text-neutral-500">
                            + Guide en supplément ({a.guide_supplement_prix} €)
                          </span>
                        )}
                      </p>
                    </InfoRow>
                    <InfoRow icon={<IconPin />} label="Point de RDV" value={a.point_rdv} />
                    <InfoRow icon={<IconCheck />} label="Inclus">
                      {(a.inclus_liste || []).length > 0 ? (
                        <ul className="space-y-0.5 text-sm text-neutral-700">
                          {(a.inclus_liste || []).map((i) => (
                            <li key={i}>✓ {i}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-400 italic">Rien de précisé</p>
                      )}
                    </InfoRow>
                    <InfoRow icon={<IconCross />} label="Non inclus">
                      {(a.non_inclus_liste || []).length > 0 ? (
                        <ul className="space-y-0.5 text-sm text-neutral-700">
                          {(a.non_inclus_liste || []).map((i) => (
                            <li key={i}>✕ {i}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-400 italic">Rien de précisé</p>
                      )}
                    </InfoRow>
                    <InfoRow icon={<IconBag />} label="À prévoir">
                      {(a.a_prevoir_liste || []).length > 0 ? (
                        <ul className="space-y-0.5 text-sm text-neutral-700">
                          {(a.a_prevoir_liste || []).map((i) => (
                            <li key={i}>• {i}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-400 italic">Rien de précisé</p>
                      )}
                    </InfoRow>
                  </div>

                  {(faq[a.id] || []).length > 0 && (
                    <>
                      <h4 className="mb-1 text-sm font-semibold text-[#171717]">FAQ</h4>
                      <div className="divide-y divide-neutral-100">
                        {(faq[a.id] || []).map((f) => (
                          <details key={f.id} className="group py-2">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-700">
                              {f.question || "Question sans titre"}
                              <svg
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                              >
                                <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </summary>
                            <p className="mt-1.5 text-sm text-neutral-600">{f.reponse}</p>
                          </details>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* RIGHT: tarifs sidebar */}
                <div className="border-t border-neutral-100 bg-[#fafafa]/30 p-5 lg:border-l lg:border-t-0">
                  <h4 className="mb-3 text-sm font-semibold text-[#171717]">Tarifs</h4>
                  <div className="mb-5 space-y-2">
                    {a.tarif_mode !== "groupe" ? (
                      <>
                        <div className="flex items-center gap-3">
                          <RowIcon>
                            <IconAdulte />
                          </RowIcon>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-neutral-700">Adulte</p>
                            <p className="text-[11px] text-neutral-400">{a.pu_adulte_age}</p>
                            {chevalOuChameauMot(a.nom) && (
                              <p className="text-[11px] font-medium text-[#0F5C56]">
                                ℹ️ Tarif par {chevalOuChameauMot(a.nom)}
                              </p>
                            )}
                          </div>
                          <span className="font-amounts text-sm text-[#171717]">
                            {euros(a.pu_adulte)}€
                          </span>
                        </div>
                        {isSpaActivity(a) ? (
                          <p className="text-[11px] font-medium text-[#0F5C56]">
                            ℹ️ À partir de 10 ans uniquement
                          </p>
                        ) : (
                          <div className="flex items-center gap-3">
                            <RowIcon>
                              <IconEnfant />
                            </RowIcon>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Enfant</p>
                              <p className="text-[11px] text-neutral-400">{a.pu_enfant_age}</p>
                              {isQuadActivity(a) && (
                                <p className="text-[11px] font-medium text-red-600">
                                  ⚠ Interdit aux enfants de moins de 6 ans
                                </p>
                              )}
                            </div>
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.pu_enfant)}€
                            </span>
                          </div>
                        )}
                        {!isQuadActivity(a) && !isSpaActivity(a) && (
                          <div className="flex items-center gap-3">
                            <RowIcon>
                              <IconBebe />
                            </RowIcon>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Bébé</p>
                              <p className="text-[11px] text-neutral-400">{a.pu_bebe_age}</p>
                            </div>
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.pu_bebe)}€
                            </span>
                          </div>
                        )}
                        {a.pu_accompagnateur > 0 && (
                    <div className="flex items-center gap-3">
                        <RowIcon>
                              <IconAdulte />
                        </RowIcon>
                        <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Accompagnateur</p>
                              <p className="text-[11px] text-neutral-400">{a.pu_accompagnateur_age}</p>
                        </div>
                        <span className="font-amounts text-sm text-[#171717]">
                          {euros(a.pu_accompagnateur)}€
                        </span>
                    </div>
                  )}
                        {a.pu_enfant_3ans > 0 && (
                          <div className="flex items-center gap-3">
                            <RowIcon>
                              <IconEnfant />
                            </RowIcon>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Enfant 3 ans</p>
                            </div>
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.pu_enfant_3ans)}€
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <RowIcon>
                            <IconAdulte />
                          </RowIcon>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-neutral-700">Forfait de base</p>
                            <p className="text-[11px] text-neutral-400">
                              jusqu&apos;à {a.prix_groupe_base_pax} personne(s)
                            </p>
                          </div>
                          {a.prix_groupe_base ? (
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.prix_groupe_base)}€
                            </span>
                          ) : (
                            !a.prix_groupe_note && (
                              <span className="text-sm text-neutral-500">Sur demande</span>
                            )
                          )}
                        </div>
                        {!a.prix_groupe_base && a.prix_groupe_note && (
                          <p className="pl-11 text-sm text-neutral-600">{a.prix_groupe_note}</p>
                        )}
                        {a.prix_groupe_extra1 > 0 && (
                          <div className="flex items-center gap-3">
                            <RowIcon>
                              <IconAdulte />
                            </RowIcon>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Personne supp.</p>
                              <p className="text-[11px] text-neutral-400">{a.prix_groupe_extra1_age}</p>
                            </div>
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.prix_groupe_extra1)}€
                            </span>
                          </div>
                        )}
                        {a.prix_groupe_extra_enfant > 0 && (
                          <div className="flex items-center gap-3">
                            <RowIcon>
                              <IconEnfant />
                            </RowIcon>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Enfant supp.</p>
                              <p className="text-[11px] text-neutral-400">{a.prix_groupe_extra_enfant_age}</p>
                            </div>
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.prix_groupe_extra_enfant)}€
                            </span>
                          </div>
                        )}
                        {a.pu_bebe > 0 && (
                          <div className="flex items-center gap-3">
                            <RowIcon>
                              <IconBebe />
                            </RowIcon>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-neutral-700">Bébé</p>
                              <p className="text-[11px] text-neutral-400">{a.pu_bebe_age}</p>
                            </div>
                            <span className="font-amounts text-sm text-[#171717]">
                              {euros(a.pu_bebe)}€
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {(() => {
                    const filledTarifs = (tarifs[a.id] || []).filter((t) => t.label.trim());
                    if (filledTarifs.length === 0) return null;
                    return (
                      <>
                        <h4 className="mb-3 text-sm font-semibold text-[#171717]">
                          Tarifs supplémentaires
                        </h4>
                        <div className="mb-3 space-y-2">
                          {filledTarifs.map((t) => (
                            <div key={t.id} className="flex items-center gap-3">
                              <RowIcon>
                                <IconTag />
                              </RowIcon>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-neutral-700">{t.label}</p>
                              </div>
                              <span className="font-amounts text-sm text-[#171717]">
                                {euros(t.pu)}€
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  {(() => {
                    const filledTransfertTarifs = (transfertTarifs[a.id] || []).filter(
                      (t) => t.zone.trim() && t.vehicule.trim()
                    );
                    if (filledTransfertTarifs.length === 0) return null;
                    return (
                      <>
                        <h4 className="mb-3 text-sm font-semibold text-[#171717]">
                          Tarifs de transfert par zone
                        </h4>
                        <div className="mb-3 space-y-2">
                          {filledTransfertTarifs.map((t) => (
                            <div key={t.id} className="flex items-center gap-3">
                              <RowIcon>
                                <IconTag />
                              </RowIcon>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-neutral-700">{t.zone}</p>
                                <p className="text-[11px] text-neutral-400">{t.vehicule}</p>
                              </div>
                              <span className="font-amounts text-sm text-[#171717]">
                                {euros(t.prix)}€
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  {(() => {
                    const filledOptions = (options[a.id] || []).filter((o) => o.nom.trim());
                    if (filledOptions.length === 0) return null;
                    return (
                      <>
                        <h4 className="mb-3 text-sm font-semibold text-[#171717]">Options</h4>
                        <div className="mb-3 space-y-2">
                          {filledOptions.map((o) => (
                            <div key={o.id} className="flex items-center gap-3">
                              <RowIcon>
                                <IconTag />
                              </RowIcon>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-neutral-700">{o.nom}</p>
                                <p className="text-[11px] text-neutral-400">
                                  {o.mode === "groupe" ? "Prix groupe (forfait)" : "Prix par personne"}
                                </p>
                              </div>
                              <span className="font-amounts text-sm text-[#171717]">
                                {euros(o.prix)}€
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                  {canSeeMargins && (
                    <button
                      onClick={() => {
                        onUpdate(a.id, { valide: false });
                        onAddTarif(a.id);
                      }}
                      className="w-full rounded-full bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      + Ajouter un tarif
                    </button>
                  )}

                  <h4 className="mb-3 mt-6 text-sm font-semibold text-[#171717]">
                    Disponibilités
                  </h4>
                  <AvailabilityCalendar
                    jours={a.jours_disponibles}
                    dates={a.prochaines_dispo_dates}
                    editable={false}
                  />
                </div>
              </div>
            </div>
                </div>
              );
            })()
          ) : reorderMode ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-neutral-400">
                  ⠿ Glisse-dépose une activité pour changer son ordre d&apos;affichage, puis valide.
                </p>
                <button
                  type="button"
                  onClick={() => setReorderMode(false)}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  ✓ Valider l&apos;ordre
                </button>
              </div>
              {filtered.length === 0 && (
                <div className="text-sm text-neutral-400">
                  Aucune activité dans cette catégorie pour l&apos;instant.
                </div>
              )}
              <div className="space-y-2">
                {filtered.map((a) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDraggedId(a.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedId && draggedId !== a.id) onReorder(draggedId, a.id);
                      setDraggedId(null);
                    }}
                    className={`flex cursor-move items-center gap-2 rounded-[6px] border border-[#eaeaea] bg-white px-4 py-3 ${
                      draggedId === a.id ? "opacity-40" : ""
                    }`}
                  >
                    <span className="text-neutral-300">⠿</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-[#171717]">
                      {a.nom || "Sans nom"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                {canReorder ? (
                  <button
                    type="button"
                    onClick={() => setReorderMode(true)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-[#171717] hover:text-[#171717]"
                  >
                    ↕ Réordonner
                  </button>
                ) : (
                  <span />
                )}
                <ViewToggle mode={activityViewMode} onChange={setActivityViewMode} />
              </div>
              {filtered.length === 0 && (
                <div className="text-sm text-neutral-400">
                  Aucune activité dans cette catégorie pour l&apos;instant.
                </div>
              )}
              <div
                className={
                  activityViewMode === "cards"
                    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                    : "divide-y divide-neutral-100 overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white"
                }
              >
                {filtered.map((a) =>
                  !a.valide ? (
                    <div key={a.id} className={activityViewMode === "cards" ? "sm:col-span-2" : ""}>
                      {renderBrouillon(a)}
                    </div>
                  ) : activityViewMode === "cards" ? (
                    <button
                      key={a.id}
                      onClick={() => setSelectedActivityId(a.id)}
                      className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-left hover:border-[#171717]"
                    >
                      <p className="font-heading text-base font-semibold text-[#171717]">
                        {a.nom || "Sans nom"}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">{a.categorie}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
                        <PriceSummary a={a} />
                      </div>
                    </button>
                  ) : (
                    <button
                      key={a.id}
                      onClick={() => setSelectedActivityId(a.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#fafafa]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#171717]">
                          {a.nom || "Sans nom"}
                        </p>
                        <p className="text-xs text-neutral-400">{a.categorie}</p>
                      </div>
                      <div className="flex flex-shrink-0 gap-3 text-xs text-neutral-600">
                        <PriceSummary a={a} />
                      </div>
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
