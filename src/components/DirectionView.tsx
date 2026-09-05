"use client";

import { useMemo, useState } from "react";
import {
  CatalogueItem,
  CatalogueModificationRequest,
  Client,
  DirectionTache,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxeModificationRequest,
} from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import { downloadCsv } from "@/lib/csv";
import MonthlyBarChart from "@/components/charts/MonthlyBarChart";
import { todayStr } from "@/lib/dates";
import { generateMonthlyReport } from "@/lib/generateMonthlyReport";
import RecapMoisView from "@/components/RecapMoisView";
import CodesPromoManager from "@/components/direction/CodesPromoManager";
import { DirActionRow, DirMetric } from "@/components/direction/DirectionUI";

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
  remboursements,
  taches,
  onAddTache,
  onUpdateTache,
  onDeleteTache,
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
  remboursements: Remboursement[];
  taches: DirectionTache[];
  onAddTache: (texte: string) => void;
  onUpdateTache: (id: string, patch: Partial<DirectionTache>) => void;
  onDeleteTache: (id: string) => void;
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

  // -- Liste prioritaire : les remboursements en attente (donnée existante)
  // et les tâches libres que la Direction ajoute elle-même (ex. "finir le
  // CRM") — mélangées en une seule checklist, triées de la plus ancienne à
  // la plus récente. Les demandes catalogue/taxe restent visibles dans
  // "Actions rapides" ci-dessous, pas ici (retiré à la demande de Mélanie).
  type TodoRow =
    | { kind: "remboursement"; data: Remboursement }
    | { kind: "tache"; data: DirectionTache };
  const remboursementsEnAttente = remboursements.filter((r) => r.statut !== "Effectué");
  const todoRows: TodoRow[] = [
    ...remboursementsEnAttente.map((data): TodoRow => ({ kind: "remboursement", data })),
    ...taches.filter((t) => !t.fait).map((data): TodoRow => ({ kind: "tache", data })),
  ].sort((a, b) => a.data.created_at.localeCompare(b.data.created_at));
  const [nouvelleTache, setNouvelleTache] = useState("");
  const [showCatalogueDemandes, setShowCatalogueDemandes] = useState(false);
  const [showTaxeDemandes, setShowTaxeDemandes] = useState(false);

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
          <div className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
            {todoRows.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[#666666]">Rien en attente — tout est fait.</div>
            ) : (
              <div className="divide-y divide-[#eaeaea]">
                {todoRows.map((row) => {
                  if (row.kind === "tache") {
                    const t = row.data;
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => onUpdateTache(t.id, { fait: true })}
                          className="h-4 w-4 flex-shrink-0"
                        />
                        <span className="flex-1 text-sm text-[#171717]">{t.texte}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteTache(t.id)}
                          className="text-xs text-neutral-400 hover:text-red-600"
                        >
                          Retirer
                        </button>
                      </div>
                    );
                  }
                  const r = row.data;
                  const client = clients.find((c) => c.id === r.client_id);
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        title="À traiter dans Suivis > Remboursements (photo justificative requise)"
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] border border-[#eaeaea]"
                      />
                      <span className="flex-1 text-sm text-[#171717]">
                        Remboursement — <strong>{client?.nom || "Client"}</strong>{" "}
                        <span className="text-[#666666]">
                          ({r.raison === "Autre" ? r.raison_autre || "Autre" : r.raison})
                        </span>
                      </span>
                      <span className="font-amounts flex-shrink-0 text-sm font-semibold text-[#171717]">
                        {euros(r.montant)} €
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-[#eaeaea] px-4 py-3">
              <input
                value={nouvelleTache}
                onChange={(e) => setNouvelleTache(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nouvelleTache.trim()) {
                    onAddTache(nouvelleTache.trim());
                    setNouvelleTache("");
                  }
                }}
                placeholder="+ Ajouter une tâche…"
                className="input flex-1 border-none bg-transparent px-0 text-sm focus:ring-0"
              />
              {nouvelleTache.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onAddTache(nouvelleTache.trim());
                    setNouvelleTache("");
                  }}
                  className="rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Ajouter
                </button>
              )}
            </div>
          </div>
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
                onClick={() => setShowCatalogueDemandes((v) => !v)}
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
                onClick={() => setShowTaxeDemandes((v) => !v)}
              />
            </div>
          </div>

          {showCatalogueDemandes && (
            <div className="space-y-2">
              {modifCatalogueRows.map((r) => {
                const isOpen = expandedRequestId === r.id;
                return (
                  <div key={r.id} className="rounded-md border border-neutral-200 bg-white">
                    <div
                      onClick={() => setExpandedRequestId(isOpen ? null : r.id)}
                      className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm"
                    >
                      <span className="font-amounts text-neutral-500">{fmtDate(r.created_at)}</span>
                      <span>
                        <strong>{r.demandeur_nom || "Sans nom"}</strong> —{" "}
                        {r.catalogue_item_noms.join(", ") || "Activité(s) non précisée(s)"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.statut === "Traité"
                            ? "bg-[#171717]/10 text-[#171717]"
                            : "bg-[#f5a623]/20 text-[#666666]"
                        }`}
                      >
                        {r.statut}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="space-y-2 border-t border-neutral-100 p-3 text-sm text-neutral-600">
                        <div>{r.explication}</div>
                        {r.statut !== "Traité" && (
                          <button
                            onClick={() => onResolveCatalogueModificationRequest(r.id)}
                            className="rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Marquer traité
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showTaxeDemandes && (
            <div className="space-y-2">
              {modifTaxeRows.map((r) => {
                const isOpen = expandedTaxeRequestId === r.id;
                return (
                  <div key={r.id} className="rounded-md border border-neutral-200 bg-white">
                    <div
                      onClick={() => setExpandedTaxeRequestId(isOpen ? null : r.id)}
                      className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm"
                    >
                      <span className="font-amounts text-neutral-500">{fmtDate(r.created_at)}</span>
                      <span>
                        <strong>{r.demandeur_nom || "Sans nom"}</strong> — {r.ville}
                        {r.tranche_label ? ` (${r.tranche_label.split("\n")[0]})` : ""}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.statut === "Traité"
                            ? "bg-[#171717]/10 text-[#171717]"
                            : "bg-[#f5a623]/20 text-[#666666]"
                        }`}
                      >
                        {r.statut}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="space-y-2 border-t border-neutral-100 p-3 text-sm text-neutral-600">
                        <div>{r.explication}</div>
                        {r.statut !== "Traité" && (
                          <button
                            onClick={() => onResolveTransfertTaxeModificationRequest(r.id)}
                            className="rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                          >
                            Marquer traité
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
