"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CatalogueItem,
  CatalogueModificationRequest,
  Client,
  CodePromo,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxeModificationRequest,
} from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import MonthlyBarChart from "@/components/charts/MonthlyBarChart";
import { todayStr } from "@/lib/dates";
import { generateMonthlyReport } from "@/lib/generateMonthlyReport";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import RecapMoisView from "@/components/RecapMoisView";

const MOIS_FR = [
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
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MOIS_FR[Number(m) - 1]} ${y}`;
}
function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Même langage visuel que le Tableau de bord d'accueil (DashboardView.tsx)
// — répété ici plutôt que partagé, ces deux fichiers ne s'importent pas
// l'un l'autre et le jeu d'icônes utile à la Direction est un sous-ensemble
// différent de celui de l'accueil.
function IconSvg({ path, className = "h-5 w-5" }: { path: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {path}
    </svg>
  );
}
const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  clipboard: (
    <>
      <rect x="5" y="3.5" width="10" height="14" rx="1.5" />
      <path d="M8 3.5V3a2 2 0 0 1 4 0v.5" />
      <path d="M7.5 9h5M7.5 12h5" strokeLinecap="round" />
    </>
  ),
  car: (
    <>
      <path d="M3 12.5 4.3 8a1.5 1.5 0 0 1 1.4-1h8.6a1.5 1.5 0 0 1 1.4 1l1.3 4.5" strokeLinejoin="round" />
      <rect x="2.5" y="12.5" width="15" height="3.5" rx="1.2" />
      <circle cx="6" cy="16.3" r="1.2" />
      <circle cx="14" cy="16.3" r="1.2" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" />
      <path d="M13 11.9c1.9.3 4.5 1.6 4.5 4.1" strokeLinecap="round" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M6.8 10.2l2.1 2.1 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};
function DirIcon({ name, className }: { name: keyof typeof DIRECTION_ICONS; className?: string }) {
  return <IconSvg path={DIRECTION_ICONS[name]} className={className} />;
}

// Typographique, pas de carte — même traitement que Metric côté accueil.
function DirMetric({
  label,
  value,
  sub,
  first,
}: {
  label: string;
  value: string;
  sub?: string;
  first?: boolean;
}) {
  return (
    <div className={`flex-1 px-5 ${first ? "pl-0" : "border-l border-[#eaeaea]"}`}>
      <p className="text-[11px] font-medium text-[#666666]">{label}</p>
      <p className="mt-1.5 text-[28px] font-bold leading-none text-[#171717]">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[#666666]">{sub}</p>}
    </div>
  );
}

function DirActionRow({
  icon,
  title,
  sub,
  count,
  onClick,
}: {
  icon: keyof typeof DIRECTION_ICONS;
  title: string;
  sub: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 transition ${
        onClick ? "cursor-pointer hover:bg-[#fafafa]" : ""
      }`}
    >
      <DirIcon name={icon} className="h-4.5 w-4.5 flex-shrink-0 text-[#666666]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#171717]">{title}</p>
        <p className="text-xs text-[#666666]">{sub}</p>
      </div>
      {!!count && (
        <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          🔔 {count}
        </span>
      )}
      {onClick && (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-[#666666]">
          ›
        </span>
      )}
    </div>
  );
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell);
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";")
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Sous-menu de gauche pour l'onglet Direction — même pattern que
// SUIVIS_SUBS/PLANNING_SUBS (cf. SuivisView.tsx) : le libellé est affiché
// tel quel dans la barre latérale d'AppShell.tsx, la clé pilote quel bloc
// de contenu s'affiche ici.
export const DIRECTION_SUBS = [
  { key: "dashboard", label: "Tableau de bord direction" },
  // Même contenu que Suivis > Remboursements (voir AppShell.tsx) — dupliqué
  // ici temporairement, le temps de migrer cet onglet vers le dashboard.
  { key: "remboursements", label: "Remboursements" },
  { key: "comptabilite", label: "Comptabilité" },
  { key: "marketing", label: "Digital marketing" },
  { key: "statsAgences", label: "Stat agences" },
  { key: "statsEmployes", label: "Stat employés" },
  // Même contenu que l'onglet "Récap du mois" de Bodé/Hossam — pour la
  // Direction, il vit ici plutôt qu'en onglet séparé de premier niveau
  // (voir "recap" retiré du TABS top-level pour viewAs === "moi" côté
  // AppShell.tsx).
  { key: "recap", label: "Récap du mois" },
  { key: "parametres", label: "Paramètres" },
] as const;
export type DirectionSub = (typeof DIRECTION_SUBS)[number]["key"];

function DirectionSubPlaceholder({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="font-heading text-lg font-semibold text-[#171717]">{label}</h2>
      <p className="mt-3 text-sm text-neutral-500">Bientôt disponible.</p>
    </div>
  );
}

// Codes de réduction que la Direction ajoute ici — consultables en lecture
// seule par l'équipe dans HELP > Codes promo, pour vérifier qu'un code
// donné par un client est valide.
function CodesPromoManager() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [codes, setCodes] = useState<CodePromo[]>([]);
  const [nouveauCode, setNouveauCode] = useState("");
  const [nouvelleDescription, setNouvelleDescription] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("codes_promo").select("*").order("created_at", { ascending: false });
      setCodes((data as CodePromo[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ajouterCode = async () => {
    const code = nouveauCode.trim();
    if (!code) return;
    const { data, error } = await supabase
      .from("codes_promo")
      .insert({ code, description: nouvelleDescription.trim() })
      .select()
      .single();
    if (error) {
      toast("Échec de l'ajout du code.");
      return;
    }
    setCodes((prev) => [data as CodePromo, ...prev]);
    setNouveauCode("");
    setNouvelleDescription("");
  };

  const toggleActif = async (c: CodePromo) => {
    setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, actif: !x.actif } : x)));
    const { error } = await supabase.from("codes_promo").update({ actif: !c.actif }).eq("id", c.id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const supprimerCode = async (id: string) => {
    setCodes((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("codes_promo").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">Codes promo</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Visibles par l&apos;équipe en lecture seule dans HELP &gt; Codes promo.
        </p>
      </div>

      <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nouveauCode}
            onChange={(e) => setNouveauCode(e.target.value)}
            placeholder="Code (ex. MIL10)"
            className="input sm:w-48"
          />
          <input
            value={nouvelleDescription}
            onChange={(e) => setNouvelleDescription(e.target.value)}
            placeholder="Description (ex. -10% fidélité)"
            className="input flex-1"
          />
        </div>
        <button
          type="button"
          disabled={!nouveauCode.trim()}
          onClick={ajouterCode}
          className="mt-2 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Ajouter le code
        </button>
      </div>

      {codes.length === 0 ? (
        <p className="text-sm text-neutral-400">Aucun code pour l&apos;instant.</p>
      ) : (
        <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
          {codes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#171717]">{c.code}</p>
                {c.description && <p className="text-xs text-[#666666]">{c.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActif(c)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    c.actif ? "bg-[#0F5C56]/10 text-[#0F5C56]" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {c.actif ? "Actif" : "Inactif"}
                </button>
                <button
                  type="button"
                  onClick={() => supprimerCode(c.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DirectionView({
  sub,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  catalogue,
  onUpdateCatalogueItem,
  coutsMap,
  catalogueModificationRequests,
  onResolveCatalogueModificationRequest,
  transfertTaxeModificationRequests,
  onResolveTransfertTaxeModificationRequest,
}: {
  sub: DirectionSub;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  catalogue: CatalogueItem[];
  onUpdateCatalogueItem: (id: string, patch: Partial<CatalogueItem>) => void;
  coutsMap: Record<string, number>;
  catalogueModificationRequests: CatalogueModificationRequest[];
  onResolveCatalogueModificationRequest: (id: string) => void;
  transfertTaxeModificationRequests: TransfertTaxeModificationRequest[];
  onResolveTransfertTaxeModificationRequest: (id: string) => void;
}) {
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedTaxeRequestId, setExpandedTaxeRequestId] = useState<string | null>(null);
  const modifCatalogueRows = [...catalogueModificationRequests].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  const modifTaxeRows = [...transfertTaxeModificationRequests].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  const currentMonth = todayStr().slice(0, 7);
  const monthOptions = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    reservations.forEach((r) => {
      if (r.date_debut) set.add(r.date_debut.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [reservations, currentMonth]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [customRange, setCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
  const [dateTo, setDateTo] = useState(`${currentMonth}-${String(lastDayOfMonth(currentMonth)).padStart(2, "0")}`);

  const pickMonth = (ym: string) => {
    setSelectedMonth(ym);
    setCustomRange(false);
    setDateFrom(`${ym}-01`);
    setDateTo(`${ym}-${String(lastDayOfMonth(ym)).padStart(2, "0")}`);
  };

  const inRange = (date: string | null) => {
    if (!date) return !dateFrom && !dateTo;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  };

  const rows = reservations
    .filter((r) => inRange(r.date_debut))
    .map((r) => {
      const client = clients.find((c) => c.id === r.client_id);
      const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      const cout = Number(coutsMap[r.id]) || 0;
      // Groupe par modèle catalogue quand la réservation en vient (le nom
      // catalogue à jour prime), sinon par nom d'activité saisi à la main.
      const catalogueMatch = r.catalogue_item_id
        ? catalogue.find((a) => a.id === r.catalogue_item_id)
        : null;
      return {
        groupKey: r.catalogue_item_id || `manuel:${r.nom_activite || "Sans nom"}`,
        nom: catalogueMatch?.nom || r.nom_activite || "Sans nom",
        date: r.date_debut,
        total,
        marge: total - cout,
        clientNom: client?.nom || "Sans nom",
      };
    });

  const exportCsv = () => {
    downloadCsv(
      `direction-${dateFrom || "debut"}_${dateTo || "fin"}.csv`,
      [
        ["Activité", "Date", "Client", "Total (€)", "Marge (€)"],
        ...rows.map((r) => [r.nom, r.date || "", r.clientNom, r.total, r.marge]),
      ]
    );
  };

  const byMonth: Record<string, number> = {};
  const byYear: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.date) return;
    byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + r.total;
    byYear[r.date.slice(0, 4)] = (byYear[r.date.slice(0, 4)] || 0) + r.total;
  });

  const byActivite: Record<string, { nom: string; count: number; total: number; marge: number }> =
    {};
  rows.forEach((r) => {
    if (!byActivite[r.groupKey]) {
      byActivite[r.groupKey] = { nom: r.nom, count: 0, total: 0, marge: 0 };
    }
    byActivite[r.groupKey].count += 1;
    byActivite[r.groupKey].total += r.total;
    byActivite[r.groupKey].marge += r.marge;
  });
  const topVendues = Object.entries(byActivite).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const topRentables = Object.entries(byActivite)
    .sort((a, b) => b[1].marge - a[1].marge)
    .slice(0, 8);

  const byClient: Record<string, number> = {};
  rows.forEach((r) => {
    byClient[r.clientNom] = (byClient[r.clientNom] || 0) + r.total;
  });
  const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const caTotal = rows.reduce((s, r) => s + r.total, 0);
  const margeTotal = rows.reduce((s, r) => s + r.marge, 0);
  const margePct = caTotal > 0 ? Math.round((margeTotal / caTotal) * 100) : 0;

  // -- Métriques du mois en cours, fixes en haut de page — indépendantes du
  // sélecteur mois/plage ci-dessous (lui sert à l'export et aux tops, pas
  // au résumé du mois "en direct"). Même logique que `rows`, filtrée sur le
  // mois courant plutôt que sur `dateFrom`/`dateTo`.
  const rowsMoisActuel = reservations
    .filter((r) => (r.date_debut || "").slice(0, 7) === currentMonth)
    .map((r) => {
      const client = clients.find((c) => c.id === r.client_id);
      const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      const cout = Number(coutsMap[r.id]) || 0;
      return { total, marge: total - cout };
    });
  const caMoisActuel = rowsMoisActuel.reduce((s, r) => s + r.total, 0);
  const margeMoisActuel = rowsMoisActuel.reduce((s, r) => s + r.marge, 0);
  const margePctMoisActuel = caMoisActuel > 0 ? Math.round((margeMoisActuel / caMoisActuel) * 100) : 0;

  // Même logique que clientsInEgypt côté accueil (DashboardView.tsx).
  const todayStrNow = todayStr();
  const clientsInEgypt = clients.filter(
    (c) => c.date_debut && c.date_fin && c.date_debut <= todayStrNow && todayStrNow <= c.date_fin
  );
  const clientsDuMois = clients.filter((c) => (c.date_debut || "").slice(0, 7) === currentMonth);

  // -- Liste prioritaire : les deux types de demande de modification en
  // attente, fusionnés et triés de la plus ancienne à la plus récente (la
  // plus ancienne en attente traitée en premier).
  type PrioriteRow =
    | { kind: "catalogue"; data: CatalogueModificationRequest }
    | { kind: "taxe"; data: TransfertTaxeModificationRequest };
  const prioriteRows: PrioriteRow[] = [
    ...modifCatalogueRows.filter((r) => r.statut !== "Traité").map((data): PrioriteRow => ({ kind: "catalogue", data })),
    ...modifTaxeRows.filter((r) => r.statut !== "Traité").map((data): PrioriteRow => ({ kind: "taxe", data })),
  ].sort((a, b) => a.data.created_at.localeCompare(b.data.created_at));

  const exportPdf = () => {
    generateMonthlyReport({
      periodeLabel: customRange
        ? `${dateFrom || "début"} → ${dateTo || "fin"}`
        : monthLabel(selectedMonth),
      caTotal,
      margeTotal,
      margePct,
      topVentes: topVendues.map(([, d]) => ({ nom: d.nom, count: d.count, total: d.total })),
      topRentables: topRentables.map(([, d]) => ({ nom: d.nom, marge: d.marge })),
      topClients: topClients.map(([nom, total]) => ({ nom, total })),
    });
  };

  if (sub === "parametres") {
    return <CodesPromoManager />;
  }

  if (sub === "recap") {
    return (
      <RecapMoisView
        reservations={reservations}
        clients={clients}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
      />
    );
  }

  if (sub !== "dashboard") {
    return <DirectionSubPlaceholder label={DIRECTION_SUBS.find((s) => s.key === sub)?.label ?? ""} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Tableau de bord Direction</h1>
        <p className="mt-1 text-sm text-[#666666]">{monthLabel(currentMonth)}</p>
      </div>

      <div className="flex overflow-x-auto rounded-[6px] border border-[#eaeaea] bg-white px-5 py-4">
        <DirMetric first label="CA du mois" value={`${euros(caMoisActuel)} €`} />
        <DirMetric
          label="Bénéfice du mois"
          value={`${euros(margeMoisActuel)} €`}
          sub={`${margePctMoisActuel}% de marge`}
        />
        <DirMetric label="Clients en Égypte" value={String(clientsInEgypt.length)} />
        <DirMetric label="Clients ce mois" value={String(clientsDuMois.length)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">Liste prioritaire</h2>
          {prioriteRows.length === 0 ? (
            <div className="rounded-[6px] border border-[#eaeaea] bg-white px-4 py-6 text-center text-sm text-[#666666]">
              Rien en attente — tout est traité.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-wide text-[#666666]">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Détail</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {prioriteRows.map((row) => {
                    const isOpen =
                      row.kind === "catalogue"
                        ? expandedRequestId === row.data.id
                        : expandedTaxeRequestId === row.data.id;
                    const toggle = () =>
                      row.kind === "catalogue"
                        ? setExpandedRequestId(isOpen ? null : row.data.id)
                        : setExpandedTaxeRequestId(isOpen ? null : row.data.id);
                    return (
                      <Fragment key={row.data.id}>
                        <tr
                          onClick={toggle}
                          className="cursor-pointer border-t border-[#eaeaea] hover:bg-[#fafafa]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-amounts text-[#666666]">
                            {fmtDate(row.data.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-full bg-[#f5a623]/20 px-2 py-0.5 text-xs font-medium text-[#666666]">
                              {row.kind === "catalogue" ? "Catalogue" : "Taxe transfert"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#171717]">
                            {row.kind === "catalogue" ? (
                              <>
                                <strong>{row.data.demandeur_nom || "Sans nom"}</strong> —{" "}
                                {row.data.catalogue_item_noms.join(", ") || "Activité(s) non précisée(s)"}
                              </>
                            ) : (
                              <>
                                <strong>{row.data.demandeur_nom || "Sans nom"}</strong> — {row.data.ville}
                                {row.data.tranche_label ? ` (${row.data.tranche_label.split("\n")[0]})` : ""}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-[#666666]">›</td>
                        </tr>
                        {isOpen && (
                          <tr className="border-t border-[#eaeaea] bg-[#fafafa]">
                            <td colSpan={4} className="space-y-2 px-4 py-3 text-sm text-[#666666]">
                              <div>{row.data.explication}</div>
                              <button
                                onClick={() =>
                                  row.kind === "catalogue"
                                    ? onResolveCatalogueModificationRequest(row.data.id)
                                    : onResolveTransfertTaxeModificationRequest(row.data.id)
                                }
                                className="rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                              >
                                Marquer traité
                              </button>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">Actions rapides</h2>
            <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              <DirActionRow
                icon="clipboard"
                title="Demandes catalogue"
                sub={
                  modifCatalogueRows.filter((r) => r.statut !== "Traité").length > 0
                    ? `${modifCatalogueRows.filter((r) => r.statut !== "Traité").length} en attente`
                    : "Rien en attente"
                }
                count={modifCatalogueRows.filter((r) => r.statut !== "Traité").length}
              />
              <DirActionRow
                icon="car"
                title="Demandes taxes de transfert"
                sub={
                  modifTaxeRows.filter((r) => r.statut !== "Traité").length > 0
                    ? `${modifTaxeRows.filter((r) => r.statut !== "Traité").length} en attente`
                    : "Rien en attente"
                }
                count={modifTaxeRows.filter((r) => r.statut !== "Traité").length}
              />
            </div>
          </div>

          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">CA par année</h2>
            <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              {Object.entries(byYear)
                .sort()
                .reverse()
                .map(([y, v]) => (
                  <div key={y} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="font-amounts text-[#666666]">{y}</span>
                    <span className="font-semibold text-[#171717]">{euros(v)} €</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#eaeaea] pt-6">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#171717]">Rapport détaillé</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Rapport figé au moment de l&apos;export — les chiffres à l&apos;écran, eux, se
            recalculent en direct.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-500">
            Mois
            <select
              value={customRange ? "custom" : selectedMonth}
              onChange={(e) => {
                if (e.target.value === "custom") setCustomRange(true);
                else pickMonth(e.target.value);
              }}
              className="input mt-1 block"
            >
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {monthLabel(ym)}
                </option>
              ))}
              <option value="custom">Personnalisé…</option>
            </select>
          </label>
          {customRange && (
            <>
              <label className="text-xs text-neutral-500">
                Du
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input mt-1 block"
                />
              </label>
              <label className="text-xs text-neutral-500">
                Au
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input mt-1 block"
                />
              </label>
            </>
          )}
          <button
            onClick={exportPdf}
            className="rounded-md bg-[#666666] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Rapport PDF
          </button>
          <button
            onClick={exportCsv}
            className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Exporter en CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="CA total" value={`${euros(caTotal)} €`} />
        <StatTile label="Marge totale" value={`${euros(margeTotal)} €`} />
        <StatTile label="Marge" value={`${margePct}%`} />
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-[#171717]">
          Marge de référence par activité (catalogue)
        </h3>
        <p className="mb-2 text-xs text-neutral-500">
          Note indicative par type d&apos;activité — la marge réelle par dossier reste calculée
          depuis le &quot;Coût réel&quot; saisi sur chaque réservation.
        </p>
        {catalogue.length === 0 && (
          <div className="text-sm text-neutral-400">Aucune activité dans le catalogue.</div>
        )}
        <div className="space-y-2">
          {catalogue.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-2 text-sm"
            >
              <span className="flex-1 font-medium text-[#171717]">{a.nom || "Sans nom"}</span>
              <input
                type="number"
                value={a.marge_pct}
                onChange={(e) =>
                  onUpdateCatalogueItem(a.id, { marge_pct: Number(e.target.value) })
                }
                className="input max-w-[90px]"
              />
              <span className="text-neutral-500">% de marge visée</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">CA par mois</h3>
        <MonthlyBarChart
          data={Object.entries(byMonth)
            .sort()
            .map(([m, v]) => ({ label: m.slice(2), value: v }))}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">CA par année</h3>
        <div className="space-y-1">
          {Object.entries(byYear)
            .sort()
            .reverse()
            .map(([y, v]) => (
              <div
                key={y}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
              >
                <span className="font-amounts text-neutral-500">{y}</span>
                <span>{euros(v)} €</span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Activités les plus vendues</h3>
        {topVendues.length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore d&apos;activités vendues.</div>
        )}
        <div className="space-y-1">
          {topVendues.map(([key, d]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{d.nom}</strong> — {d.count} vente(s)
              </span>
              <span>{euros(d.total)} €</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Activités les plus rentables</h3>
        {topRentables.length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore de données de coût.</div>
        )}
        <div className="space-y-1">
          {topRentables.map(([key, d]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{d.nom}</strong>
              </span>
              <span>{euros(d.marge)} € de marge</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Plus gros clients</h3>
        {topClients.length === 0 && (
          <div className="text-sm text-neutral-400">
            Pas encore de clients avec activités.
          </div>
        )}
        <div className="space-y-1">
          {topClients.map(([nom, total]) => (
            <div
              key={nom}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{nom}</strong>
              </span>
              <span>{euros(total)} €</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="font-amounts mt-1 text-2xl font-semibold text-[#171717]">{value}</p>
    </div>
  );
}
