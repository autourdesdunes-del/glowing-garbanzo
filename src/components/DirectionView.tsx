"use client";

import { useMemo, useState } from "react";
import {
  CatalogueItem,
  CatalogueModificationRequest,
  Client,
  DirectionTache,
  Profile,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxeModificationRequest,
} from "@/lib/types";
import { remboursementImpact, reservationsVendues, resaTotalMontant } from "@/lib/resa";
import { STATS_HISTORIQUES_MENSUELLES } from "@/lib/statsHistoriques";
import { downloadCsv } from "@/lib/csv";
import MonthlyBarChart from "@/components/charts/MonthlyBarChart";
import { todayStr } from "@/lib/dates";
import { generateMonthlyReport } from "@/lib/generateMonthlyReport";
import RecapMoisView from "@/components/RecapMoisView";
import CodesPromoManager from "@/components/direction/CodesPromoManager";
import JournalActiviteView from "@/components/direction/JournalActiviteView";
import MarketingView from "@/components/direction/MarketingView";
import RecentActivityFeed from "@/components/direction/RecentActivityFeed";
import { Donut, MetricCardTrend } from "@/components/direction/DashboardWidgets";
import { DirActionRow } from "@/components/direction/DirectionUI";

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

// Toutes les clés possibles du sous-menu Direction, à plat — déclaré à part
// (plutôt que dérivé de DIRECTION_SUBS par un type générique) pour rester
// simple et lisible malgré l'imbrication à 2 niveaux introduite ci-dessous.
export type DirectionSub =
  | "dashboard"
  | "dashboardATraiter"
  | "dashboardRapport"
  | "journal"
  | "remboursements"
  | "comptabilite"
  | "compta_jour"
  | "compta_mois"
  | "compta_annee"
  | "marketing"
  | "statistiques"
  | "statsAgences"
  | "statsEmployes"
  | "recap"
  | "parametres";

type DirectionSubLeaf = { key: DirectionSub; label: string };
type DirectionSubNode = DirectionSubLeaf & { children?: readonly DirectionSubLeaf[] };

// Sous-menu de gauche pour l'onglet Direction — arborescence à 2 niveaux
// maximum (façon classeur Notion : une page peut avoir des sous-pages),
// affichée par AppShell.tsx (repliable/dépliable par section) ; la clé
// pilote quel bloc de contenu s'affiche ici, qu'elle soit de premier niveau
// ou nichée sous "children".
export const DIRECTION_SUBS: readonly DirectionSubNode[] = [
  {
    key: "dashboard",
    label: "Tableau de bord direction",
    children: [
      { key: "dashboardATraiter", label: "À traiter" },
      { key: "dashboardRapport", label: "Rapport détaillé" },
    ],
  },
  // Qui a fait quoi, jour par jour, tous employés confondus — demande de
  // Mélanie du 2026-09-23 (impossible jusque-là de savoir qui avait modifié
  // quoi sur une fiche, ni de voir la journée d'une employée d'un coup).
  { key: "journal", label: "Journal d'activité" },
  // Même contenu que Suivis > Remboursements (voir AppShell.tsx) — dupliqué
  // ici temporairement, le temps de migrer cet onglet vers le dashboard.
  { key: "remboursements", label: "Remboursements" },
  {
    key: "comptabilite",
    label: "Comptabilité",
    children: [
      { key: "compta_jour", label: "Bilan financier par jour" },
      { key: "compta_mois", label: "Bilan financier par mois" },
      { key: "compta_annee", label: "Bilan financier par an" },
    ],
  },
  { key: "marketing", label: "Digital marketing" },
  {
    key: "statistiques",
    label: "Statistiques",
    children: [
      { key: "statsAgences", label: "Stat agences" },
      { key: "statsEmployes", label: "Stat employés" },
    ],
  },
  // Même contenu que l'onglet "Récap du mois" de Bodé/Hossam — pour la
  // Direction, il vit ici plutôt qu'en onglet séparé de premier niveau
  // (voir "recap" retiré du TABS top-level pour viewAs === "moi" côté
  // AppShell.tsx).
  { key: "recap", label: "Récap du mois" },
  { key: "parametres", label: "Paramètres" },
] as const;

// Cherche le libellé d'une clé à n'importe quel niveau de l'arborescence —
// sans ça, le placeholder générique affichait un titre vide pour toute
// sous-page nichée (ex. "statsAgences", introuvable en cherchant seulement
// au premier niveau).
function directionSubLabel(sub: DirectionSub): string {
  for (const node of DIRECTION_SUBS) {
    if (node.key === sub) return node.label;
    const child = node.children?.find((c) => c.key === sub);
    if (child) return child.label;
  }
  return "";
}

function DirectionSubPlaceholder({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="font-heading text-lg font-semibold text-[#171717]">{label}</h2>
      <p className="mt-3 text-sm text-neutral-500">Bientôt disponible.</p>
    </div>
  );
}

// Page d'accueil "Comptabilité" — façon sommaire Notion : une rubrique =
// une sous-page, cliquer dessus y navigue (même destination que le
// sous-menu de gauche, juste une autre porte d'entrée).
const COMPTA_RUBRIQUES = DIRECTION_SUBS.find((s) => s.key === "comptabilite")!.children!;

function ComptabiliteIndex({ onNavigateSub }: { onNavigateSub: (sub: DirectionSub) => void }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="font-heading text-lg font-semibold text-[#171717]">Comptabilité</h2>
      <p className="mt-1 text-sm text-neutral-500">Choisis une rubrique.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {COMPTA_RUBRIQUES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onNavigateSub(r.key)}
            className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-left hover:border-[#171717]/30 hover:bg-[#fafafa]"
          >
            <p className="font-heading text-sm font-semibold text-[#171717]">{r.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// Une rubrique de Comptabilité — coquille prête à être remplie (contenu à
// venir, au cas par cas selon ce que Mélanie veut y voir).
// Années disponibles comme sous-rubrique de chaque bilan (jour/mois/an) —
// 2022 à 2026, demande de Mélanie. À étendre ici le jour où une année
// suivante doit s'ajouter.
const COMPTA_ANNEES = [2022, 2023, 2024, 2025, 2026] as const;

type BilanMensuel = {
  ventes: number;
  moyenneParJour: number;
  caTotal: number;
  benefices: number;
  margePct: number;
};

// Données historiques saisies à la main (import Notion), mois par mois —
// jamais calculées depuis les réservations du CRM (ces années sont
// antérieures ou extérieures à son usage réel). 1 = janvier ... 12 = décembre.
const COMPTA_BILANS_MENSUELS: Record<number, Partial<Record<number, BilanMensuel>>> = {
  2022: {
    9: { ventes: 5, moyenneParJour: 0.16, caTotal: 535, benefices: 105, margePct: 20 },
    10: { ventes: 9, moyenneParJour: 0.29, caTotal: 881, benefices: 313.72, margePct: 36 },
    11: { ventes: 45, moyenneParJour: 1.5, caTotal: 5589, benefices: 1074.61, margePct: 19.2 },
    12: { ventes: 34, moyenneParJour: 1.09, caTotal: 6425, benefices: 2436.91, margePct: 37.9 },
  },
};

// Mois réellement sélectionnables par année — l'agence a été créée en
// septembre 2022, donc janvier à août 2022 n'ont jamais existé (demande de
// Mélanie : "tu peux supprimer les autres mois"). Pas d'entrée = les 12 mois.
const COMPTA_MOIS_DISPONIBLES: Partial<Record<number, number[]>> = {
  2022: [9, 10, 11, 12],
};

function moisDisponiblesPour(annee: number) {
  return COMPTA_MOIS_DISPONIBLES[annee] || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

// Toujours 2 décimales pour un montant en Comptabilité (demande de
// Mélanie, 2026-10-15) — euros() ailleurs dans ce fichier n'en affiche que
// si la valeur en a déjà, gardé tel quel pour ne rien changer au tableau
// de bord Direction.
function eurosDec(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Couleur par mois (1 = janvier ... 12 = décembre) — palette étendue à
// partir des couleurs de marque (terracotta/gold/teal), pour que le
// camembert des bénéfices reste lisible même sur une année complète.
const COMPTA_MOIS_COULEURS = [
  "#5C2A1D",
  "#8B4531",
  "#C9973E",
  "#0F5C56",
  "#2E86AB",
  "#A23B72",
  "#F18F01",
  "#6B4226",
  "#588157",
  "#BC6C25",
  "#3D405B",
  "#E07A5F",
];

const COULEUR_VENTES = "#0F5C56";
const COULEUR_CA = "#C9973E";

// Courbe double axe (nombre d'activités vendues à gauche, CA à droite) —
// remplace l'ancien graphique en barres, qui ne montrait que le CA
// (demande de Mélanie, 2026-10-15). Cliquer un point amène sur le détail
// du mois, comme avant.
function ComptaCourbeChart({
  data,
  onSelectMois,
}: {
  data: { mois: number; label: string; ventes: number; ca: number }[];
  onSelectMois: (mois: number) => void;
}) {
  const width = 640;
  const height = 220;
  const padX = 28;
  const padTop = 34;
  const padBottom = 28;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const maxVentes = Math.max(...data.map((d) => d.ventes), 1);
  const maxCa = Math.max(...data.map((d) => d.ca), 1);
  const xFor = (i: number) => (data.length > 1 ? padX + (i / (data.length - 1)) * innerW : padX + innerW / 2);
  const yForVentes = (v: number) => padTop + innerH - (v / maxVentes) * innerH;
  const yForCa = (v: number) => padTop + innerH - (v / maxCa) * innerH;
  const pathVentes = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yForVentes(d.ventes).toFixed(1)}`)
    .join(" ");
  const pathCa = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yForCa(d.ca).toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto rounded-md bg-white p-4">
      <div className="mb-2 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: COULEUR_VENTES }} />
          Activités vendues
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: COULEUR_CA }} />
          Chiffre d&apos;affaires
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Activités vendues et chiffre d'affaires par mois"
      >
        <path d={pathVentes} fill="none" stroke={COULEUR_VENTES} strokeWidth="2" />
        <path d={pathCa} fill="none" stroke={COULEUR_CA} strokeWidth="2" />
        {data.map((d, i) => {
          // Les cercles seuls (r=3.5 dans un viewBox de 640, donc ~1-2px
          // réels à l'écran) sont une cible bien trop petite pour cliquer —
          // une bande transparente sur toute la hauteur du mois, elle, se
          // clique n'importe où dans sa colonne.
          const bandWidth = data.length > 1 ? innerW / data.length : innerW;
          return (
            <g
              key={d.mois}
              onClick={() => onSelectMois(d.mois)}
              className="cursor-pointer"
              role="button"
              aria-label={`Voir le détail de ${d.label}`}
            >
              <title>
                {d.label} : {d.ventes} vente{d.ventes > 1 ? "s" : ""}, {eurosDec(d.ca)} €
              </title>
              <rect
                x={xFor(i) - bandWidth / 2}
                y={padTop - 16}
                width={bandWidth}
                height={innerH + 16}
                fill="transparent"
                className="transition hover:fill-black/5"
              />
              <text
                x={xFor(i)}
                y={yForVentes(d.ventes) - 8}
                textAnchor="middle"
                fontSize="9"
                fill={COULEUR_VENTES}
              >
                {d.ventes}
              </text>
              <circle cx={xFor(i)} cy={yForVentes(d.ventes)} r={3.5} fill={COULEUR_VENTES} />
              <text x={xFor(i)} y={yForCa(d.ca) - 8} textAnchor="middle" fontSize="9" fill={COULEUR_CA}>
                {eurosDec(d.ca)} €
              </text>
              <circle cx={xFor(i)} cy={yForCa(d.ca)} r={3.5} fill={COULEUR_CA} />
              <text x={xFor(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#78716c">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ComptabiliteBilanPage({
  sub,
  annee,
  setAnnee,
  mois,
  setMois,
  onNavigateSub,
}: {
  sub: DirectionSub;
  annee: number;
  setAnnee: (a: number) => void;
  mois: number | null;
  setMois: (m: number) => void;
  onNavigateSub: (sub: DirectionSub) => void;
}) {
  const moisDispos = moisDisponiblesPour(annee);

  const changerAnnee = (a: number) => {
    setAnnee(a);
    if (mois !== null) {
      const dispos = moisDisponiblesPour(a);
      if (!dispos.includes(mois)) setMois(dispos[0]);
    }
  };

  const allerAuMois = (m: number) => {
    setMois(m);
    onNavigateSub("compta_mois");
  };

  const bilanMois = mois !== null ? COMPTA_BILANS_MENSUELS[annee]?.[mois] : undefined;
  const bilansAnnee = COMPTA_BILANS_MENSUELS[annee] || {};
  const moisAvecDonnees = Object.keys(bilansAnnee)
    .map(Number)
    .sort((a, b) => a - b);
  const caTotalAnnee = moisAvecDonnees.reduce((s, m) => s + (bilansAnnee[m]?.caTotal || 0), 0);
  const beneficesAnnee = moisAvecDonnees.reduce((s, m) => s + (bilansAnnee[m]?.benefices || 0), 0);
  const margeAnnee = caTotalAnnee > 0 ? (beneficesAnnee / caTotalAnnee) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-3 flex items-center gap-1.5 text-xs text-neutral-400">
        <span>Comptabilité</span>
        <span>/</span>
        <span className="font-medium text-[#171717]">{directionSubLabel(sub)}</span>
      </div>
      <h2 className="font-heading text-lg font-semibold text-[#171717]">{directionSubLabel(sub)}</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {COMPTA_ANNEES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => changerAnnee(a)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              annee === a
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-[#eaeaea] text-[#666666] hover:bg-[#fafafa]"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      {mois !== null && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {moisDispos.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMois(m)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                mois === m
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-[#eaeaea] text-[#666666] hover:bg-[#fafafa]"
              }`}
            >
              {MOIS_FR[m - 1]}
            </button>
          ))}
        </div>
      )}

      {sub === "compta_mois" &&
        mois !== null &&
        (bilanMois ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile mono={false} label="Ventes au mois" value={`${bilanMois.ventes}`} />
            <StatTile mono={false} label="Moyenne par jour" value={bilanMois.moyenneParJour.toLocaleString("fr-FR")} />
            <StatTile mono={false} label="CA total" value={`${eurosDec(bilanMois.caTotal)} €`} />
            <StatTile mono={false} label="Bénéfices" value={`${eurosDec(bilanMois.benefices)} €`} />
            <StatTile mono={false} label="Marge (CA/Bénef)" value={`${bilanMois.margePct.toLocaleString("fr-FR")}%`} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            {MOIS_FR[mois - 1]} {annee} — rien configuré pour l&apos;instant.
          </p>
        ))}

      {sub === "compta_annee" &&
        (moisAvecDonnees.length > 0 ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile mono={false} label="CA total de l'année" value={`${eurosDec(caTotalAnnee)} €`} />
              <StatTile mono={false} label="Bénéfices de l'année" value={`${eurosDec(beneficesAnnee)} €`} />
              <StatTile
                mono={false}
                label="Marge (CA/Bénef)"
                value={`${margeAnnee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Activités vendues et CA par mois — {annee} — clique un mois pour son détail
                </p>
                <ComptaCourbeChart
                  data={moisAvecDonnees.map((m) => ({
                    mois: m,
                    label: MOIS_FR[m - 1].slice(0, 3),
                    ventes: bilansAnnee[m]?.ventes || 0,
                    ca: bilansAnnee[m]?.caTotal || 0,
                  }))}
                  onSelectMois={allerAuMois}
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Bénéfices par mois — {annee}
                </p>
                <div className="rounded-md bg-white p-4">
                  <Donut
                    segments={moisAvecDonnees.map((m) => ({
                      label: MOIS_FR[m - 1],
                      value: bilansAnnee[m]?.benefices || 0,
                      color: COMPTA_MOIS_COULEURS[m - 1],
                    }))}
                    centerValue={`${eurosDec(beneficesAnnee)} €`}
                    centerLabel="bénéfices"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">{annee} — rien configuré pour l&apos;instant.</p>
        ))}

      {sub === "compta_jour" && (
        <p className="mt-4 text-sm text-neutral-500">
          {mois !== null ? `${MOIS_FR[mois - 1]} ` : ""}
          {annee} — rien configuré pour l&apos;instant.
        </p>
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
  remboursements,
  taches,
  onAddTache,
  onUpdateTache,
  onDeleteTache,
  teamProfiles,
  onOpenClient,
  onNavigateSub,
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
  teamProfiles: Profile[];
  onOpenClient: (id: string) => void;
  onNavigateSub: (sub: DirectionSub) => void;
}) {
  // Partagé entre les 3 pages Comptabilité (pas un state local à chacune) —
  // pour que cliquer un mois dans "par an" fasse déjà atterrir "par mois"
  // dessus, et que l'année/le mois choisis restent cohérents en naviguant
  // de l'une à l'autre.
  const [comptaAnnee, setComptaAnnee] = useState<number>(COMPTA_ANNEES[COMPTA_ANNEES.length - 1]);
  const [comptaMois, setComptaMois] = useState<number>(new Date().getMonth() + 1);
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

  const rows = reservationsVendues(reservations)
    .filter((r) => inRange(r.date_debut))
    .map((r) => {
      const client = clients.find((c) => c.id === r.client_id);
      const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      // coutsMap[r.id] === undefined veut dire "coût réel jamais saisi", pas
      // "coût nul" (updateCoutReel upserte même une saisie à 0€, ex.
      // activité offerte) — sans cette distinction, une activité dont
      // personne n'a encore rempli le coût affichait 100% de marge et
      // remontait à tort en tête de "Activités les plus rentables".
      const coutSaisi = coutsMap[r.id] !== undefined;
      const cout = Number(coutsMap[r.id]) || 0;
      // Un remboursement/dédommagement sur une activité restée "Confirmée"
      // (jamais annulée) doit se répercuter ici — sinon elle continue de
      // compter comme vendue à plein tarif, argent parti compris.
      const impacts = remboursements
        .filter((rb) => rb.activite_id === r.id)
        .map(remboursementImpact);
      const impactCa = impacts.reduce((s, i) => s + i.ca, 0);
      const impactMarge = impacts.reduce((s, i) => s + i.marge, 0);
      // Groupe par modèle catalogue quand la réservation en vient (le nom
      // catalogue à jour prime), sinon par nom d'activité saisi à la main.
      const catalogueMatch = r.catalogue_item_id
        ? catalogue.find((a) => a.id === r.catalogue_item_id)
        : null;
      return {
        groupKey: r.catalogue_item_id || `manuel:${r.nom_activite || "Sans nom"}`,
        nom: catalogueMatch?.nom || r.nom_activite || "Sans nom",
        date: r.date_debut,
        total: total + impactCa,
        marge: total - cout + impactMarge,
        coutSaisi,
        clientId: r.client_id,
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

  const byActivite: Record<
    string,
    { nom: string; count: number; total: number; marge: number; sansCout: number }
  > = {};
  rows.forEach((r) => {
    if (!byActivite[r.groupKey]) {
      byActivite[r.groupKey] = { nom: r.nom, count: 0, total: 0, marge: 0, sansCout: 0 };
    }
    byActivite[r.groupKey].count += 1;
    byActivite[r.groupKey].total += r.total;
    byActivite[r.groupKey].marge += r.marge;
    if (!r.coutSaisi) byActivite[r.groupKey].sansCout += 1;
  });
  const topVendues = Object.entries(byActivite).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  // Une activité dont AUCUNE vente n'a de coût réel saisi n'a pas sa place
  // dans un classement de rentabilité — sa "marge" n'est qu'un total de
  // vente déguisé (cout = 0 par défaut), voir le commentaire sur coutSaisi
  // plus haut. Celles avec un coût partiellement saisi restent affichées
  // (mieux qu'aucune donnée) mais avec un avertissement, voir le rendu.
  const topRentables = Object.entries(byActivite)
    .filter(([, d]) => d.sansCout < d.count)
    .sort((a, b) => b[1].marge - a[1].marge)
    .slice(0, 8);

  // Groupé par client_id (pas par nom affiché) : deux clients distincts
  // portant le même nom — homonyme, ou tous deux sans nom renseigné — ne
  // doivent jamais voir leur CA fusionné en une seule ligne ici.
  const byClient: Record<string, { nom: string; total: number }> = {};
  rows.forEach((r) => {
    const key = r.clientId || `sans-id:${r.clientNom}`;
    if (!byClient[key]) byClient[key] = { nom: r.clientNom, total: 0 };
    byClient[key].total += r.total;
  });
  const topClients = Object.values(byClient)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((c) => [c.nom, c.total] as [string, number]);

  const caTotal = rows.reduce((s, r) => s + r.total, 0);
  const margeTotal = rows.reduce((s, r) => s + r.marge, 0);
  const margePct = caTotal > 0 ? Math.round((margeTotal / caTotal) * 100) : 0;

  // -- Métriques du mois en cours, fixes en haut de page — indépendantes du
  // sélecteur mois/plage ci-dessous (lui sert à l'export et aux tops, pas
  // au résumé du mois "en direct"). Même logique que `rows`, filtrée sur le
  // mois courant plutôt que sur `dateFrom`/`dateTo`.
  const rowsMoisActuel = reservationsVendues(reservations)
    .filter((r) => (r.date_debut || "").slice(0, 7) === currentMonth)
    .map((r) => {
      const client = clients.find((c) => c.id === r.client_id);
      const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      // coutsMap[r.id] === undefined veut dire "coût réel jamais saisi", pas
      // "coût nul" (updateCoutReel upserte même une saisie à 0€, ex.
      // activité offerte) — sans cette distinction, une activité dont
      // personne n'a encore rempli le coût affichait 100% de marge et
      // remontait à tort en tête de "Activités les plus rentables".
      const coutSaisi = coutsMap[r.id] !== undefined;
      const cout = Number(coutsMap[r.id]) || 0;
      const impacts = remboursements
        .filter((rb) => rb.activite_id === r.id)
        .map(remboursementImpact);
      const impactCa = impacts.reduce((s, i) => s + i.ca, 0);
      const impactMarge = impacts.reduce((s, i) => s + i.marge, 0);
      return { total: total + impactCa, marge: total - cout + impactMarge, coutSaisi };
    });
  const caMoisActuel = rowsMoisActuel.reduce((s, r) => s + r.total, 0);
  const margeMoisActuel = rowsMoisActuel.reduce((s, r) => s + r.marge, 0);
  const margePctMoisActuel = caMoisActuel > 0 ? Math.round((margeMoisActuel / caMoisActuel) * 100) : 0;
  const sansCoutMoisActuel = rowsMoisActuel.filter((r) => !r.coutSaisi).length;

  // Même logique que clientsInEgypt côté accueil (DashboardView.tsx).
  const todayStrNow = todayStr();
  const clientsInEgypt = clients.filter(
    (c) => c.date_debut && c.date_fin && c.date_debut <= todayStrNow && todayStrNow <= c.date_fin
  );
  const clientsDuMois = clients.filter((c) => (c.date_debut || "").slice(0, 7) === currentMonth);

  // -- Tendance sur 6 mois (CA/marge/nouveaux clients), indépendante du
  // sélecteur mois/plage du "Rapport détaillé" plus bas (toujours calée sur
  // le mois en cours, glissante) — sert aux sparklines et aux % de tendance
  // de la Vue d'ensemble (maquette Mélanie, 2026-09-23).
  const [curY, curM] = currentMonth.split("-").map(Number);
  const monthsTrailing = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(curY, curM - 1 - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  // Fenêtre plus large pour le gros graphique "CA par mois" de la Vue
  // d'ensemble (même logique, juste 12 mois au lieu de 6).
  const monthsTrailing12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(curY, curM - 1 - (11 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const statsByMonthAll: Record<string, { ca: number; marge: number; clients: number }> = {};
  reservationsVendues(reservations).forEach((r) => {
    const key = (r.date_debut || "").slice(0, 7);
    if (!key) return;
    const client = clients.find((c) => c.id === r.client_id);
    const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    const cout = Number(coutsMap[r.id]) || 0;
    const impacts = remboursements.filter((rb) => rb.activite_id === r.id).map(remboursementImpact);
    const impactCa = impacts.reduce((s, i) => s + i.ca, 0);
    const impactMarge = impacts.reduce((s, i) => s + i.marge, 0);
    if (!statsByMonthAll[key]) statsByMonthAll[key] = { ca: 0, marge: 0, clients: 0 };
    statsByMonthAll[key].ca += total + impactCa;
    statsByMonthAll[key].marge += total - cout + impactMarge;
  });
  clients.forEach((c) => {
    const key = (c.date_debut || "").slice(0, 7);
    if (!key) return;
    if (!statsByMonthAll[key]) statsByMonthAll[key] = { ca: 0, marge: 0, clients: 0 };
    statsByMonthAll[key].clients += 1;
  });
  // Pour tout mois déjà clos où le relevé manuel de Mélanie existe (voir
  // STATS_HISTORIQUES_MENSUELLES), on lui fait confiance plutôt qu'au calcul
  // CRM — les réservations/coûts saisis dans le CRM ne remontent pas assez
  // loin ni assez fiablement pour ces mois-là (import du 2026-09-23). Seul
  // "clients" (nouveaux clients, pas suivi dans le relevé) reste calculé.
  Object.entries(STATS_HISTORIQUES_MENSUELLES).forEach(([key, hist]) => {
    statsByMonthAll[key] = { ...hist, clients: statsByMonthAll[key]?.clients || 0 };
  });
  const trailing = monthsTrailing.map((m) => statsByMonthAll[m] || { ca: 0, marge: 0, clients: 0 });
  const moisPrecedent = trailing[trailing.length - 2];
  const moisActuelTrailing = trailing[trailing.length - 1];
  const pctChange = (actuel: number, precedent: number) =>
    precedent > 0 ? Math.round(((actuel - precedent) / precedent) * 100) : null;
  const trendCa = pctChange(moisActuelTrailing.ca, moisPrecedent.ca);
  const trendMarge = pctChange(moisActuelTrailing.marge, moisPrecedent.marge);
  const trendClients = pctChange(moisActuelTrailing.clients, moisPrecedent.clients);

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

  if (sub === "journal") {
    return <JournalActiviteView clients={clients} teamProfiles={teamProfiles} onOpenClient={onOpenClient} />;
  }

  if (sub === "marketing") {
    return <MarketingView clients={clients} />;
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

  if (sub === "comptabilite") {
    return <ComptabiliteIndex onNavigateSub={onNavigateSub} />;
  }

  if (sub === "compta_jour" || sub === "compta_mois" || sub === "compta_annee") {
    return (
      <ComptabiliteBilanPage
        sub={sub}
        annee={comptaAnnee}
        setAnnee={setComptaAnnee}
        mois={sub === "compta_annee" ? null : comptaMois}
        setMois={setComptaMois}
        onNavigateSub={onNavigateSub}
      />
    );
  }

  if (sub !== "dashboard" && sub !== "dashboardATraiter" && sub !== "dashboardRapport") {
    return <DirectionSubPlaceholder label={directionSubLabel(sub)} />;
  }

  // Fil d'Ariane façon Notion : "Tableau de bord direction / À traiter" —
  // rappelle qu'on est sur une sous-page de la page dépliée dans la sidebar.
  const breadcrumb = sub !== "dashboard" && (
    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
      <span>Tableau de bord direction</span>
      <span>/</span>
      <span className="font-medium text-[#171717]">{directionSubLabel(sub)}</span>
    </div>
  );

  if (sub === "dashboardATraiter") {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        {breadcrumb}
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">À traiter</h1>
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
      </div>
    );
  }

  if (sub === "dashboardRapport") {
    return (
      <div className="mx-auto max-w-6xl space-y-8 p-8">
        {breadcrumb}
      <div className="flex flex-wrap items-end justify-between gap-3">
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
                {d.sansCout > 0 && (
                  <span className="ml-2 text-[11px] font-normal text-[#f5a623]">
                    ⚠️ coût manquant sur {d.sansCout}/{d.count}
                  </span>
                )}
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

  // Vue d'ensemble — page d'accueil du "classeur" Direction (maquette
  // Mélanie, 2026-09-23) : cartes de tendance avec mini-graphe, gros
  // graphique CA/mois, tops activités/clients du mois, répartition marge vs
  // coûts, et un aperçu de l'activité récente de l'équipe.
  const coutMoisActuel = moisActuelTrailing.ca - moisActuelTrailing.marge;
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Tableau de bord Direction</h1>
        <p className="mt-1 text-sm text-[#666666]">{monthLabel(currentMonth)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCardTrend
          label="CA du mois"
          value={`${euros(caMoisActuel)} €`}
          trendPct={trendCa}
          trendLabel="vs mois précédent"
          values={trailing.map((t) => t.ca)}
        />
        <MetricCardTrend
          label="Bénéfice du mois"
          value={`${euros(margeMoisActuel)} €`}
          trendPct={trendMarge}
          trendLabel={
            sansCoutMoisActuel > 0
              ? `${margePctMoisActuel}% de marge — ⚠️ coût manquant sur ${sansCoutMoisActuel} vente(s)`
              : `${margePctMoisActuel}% de marge`
          }
          values={trailing.map((t) => t.marge)}
        />
        <MetricCardTrend
          label="Clients en Égypte"
          value={String(clientsInEgypt.length)}
          values={[clientsInEgypt.length, clientsInEgypt.length]}
        />
        <MetricCardTrend
          label="Clients ce mois"
          value={String(clientsDuMois.length)}
          trendPct={trendClients}
          trendLabel="vs mois précédent"
          values={trailing.map((t) => t.clients)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4 lg:col-span-2">
          <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">CA par mois (12 derniers mois)</h2>
          <MonthlyBarChart
            data={monthsTrailing12.map((m) => ({ label: m.slice(2), value: statsByMonthAll[m]?.ca || 0 }))}
          />
        </div>
        <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
          <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">Marge vs coûts</h2>
          <Donut
            segments={[
              { label: "Marge", value: Math.max(moisActuelTrailing.marge, 0), color: "#0F5C56" },
              { label: "Coûts", value: Math.max(coutMoisActuel, 0), color: "#C9973E" },
            ]}
            centerValue={`${margePctMoisActuel}%`}
            centerLabel="marge"
          />
          <p className="mt-3 text-xs text-neutral-400">{monthLabel(currentMonth)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
          <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
            Activités les plus vendues — {monthLabel(currentMonth)}
          </h2>
          {topVendues.length === 0 ? (
            <p className="text-sm text-neutral-400">Pas encore d&apos;activités vendues.</p>
          ) : (
            <div className="space-y-1">
              {topVendues.slice(0, 5).map(([key, d], i) => (
                <div key={key} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-[#fafafa]">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#fafafa] text-[10px] font-semibold text-neutral-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#171717]">{d.nom}</span>
                  <span className="flex-shrink-0 text-xs text-neutral-400">{d.count} vente(s)</span>
                  <span className="flex-shrink-0 font-semibold text-[#171717]">{euros(d.total)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
          <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
            Plus gros clients — {monthLabel(currentMonth)}
          </h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-neutral-400">Pas encore de clients avec activités.</p>
          ) : (
            <div className="space-y-1">
              {topClients.slice(0, 5).map(([nom, total], i) => (
                <div key={nom} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-[#fafafa]">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#fafafa] text-[10px] font-semibold text-neutral-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[#171717]">{nom}</span>
                  <span className="flex-shrink-0 font-semibold text-[#171717]">{euros(total)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
        <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">Activité récente de l&apos;équipe</h2>
        <RecentActivityFeed clients={clients} teamProfiles={teamProfiles} onOpenClient={onOpenClient} />
      </div>
    </div>
  );
}

function StatTile({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold text-[#171717] ${mono ? "font-amounts" : ""}`}>{value}</p>
    </div>
  );
}
