"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CatalogueItem,
  CatalogueModificationRequest,
  Client,
  DirectionTache,
  HotelReference,
  PaiementEtape,
  PaiementPrevu,
  Profile,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxeModificationRequest,
} from "@/lib/types";
import { cleanActivityTitle, remboursementImpact, reservationsVendues, resaTotalMontant } from "@/lib/resa";
import { pickupSortMinutes } from "@/lib/planningViewFormat";
import { STATS_HISTORIQUES_MENSUELLES } from "@/lib/statsHistoriques";
import { downloadCsv } from "@/lib/csv";
import MonthlyBarChart from "@/components/charts/MonthlyBarChart";
import StatsAgenceView from "@/components/StatsAgenceView";
import StatsEmployesView from "@/components/StatsEmployesView";
import { todayStr } from "@/lib/dates";
import { generateMonthlyReport } from "@/lib/generateMonthlyReport";
import RecapMoisView from "@/components/RecapMoisView";
import CodesPromoManager from "@/components/direction/CodesPromoManager";
import JournalActiviteView from "@/components/direction/JournalActiviteView";
import MarketingView from "@/components/direction/MarketingView";
import RecentActivityFeed from "@/components/direction/RecentActivityFeed";
import { Donut, MetricCardTrend } from "@/components/direction/DashboardWidgets";
import { DirActionRow } from "@/components/direction/DirectionUI";
import { ActivityDetailModal } from "@/components/planning/ActivityDetailModal";
import { createClient } from "@/lib/supabase/client";

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
  | "benefices"
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
      // Année > mois > jour > détail par client/activité du jour — demande
      // de Mélanie, 2026-10-29 : voir le détail des bénéfices, pas
      // seulement un total agrégé par mois.
      { key: "benefices", label: "Bénéfices" },
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

// Abréviations courtes pour l'axe du graphique — un simple .slice(0, 3) sur
// MOIS_FR confond juin/juillet (tous deux "jui"), invisible tant que 2022
// n'avait que 4 mois mais plus du tout une fois l'année complète affichée.
const COMPTA_MOIS_ABREV = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

// Aucun champ n'est garanti — un mois peut être ajouté dès qu'on connaît
// ne serait-ce qu'un seul champ (ex. seulement le bénéfice, ou à
// l'inverse ventes/CA sans le bénéfice pas encore calculé — demande de
// Mélanie, 2026-10-15 et 2026-10-19), les autres se complètent dès qu'ils
// sont connus. Chaque affichage doit gérer leur absence (jamais supposer
// 0, qui mentirait sur "rien vendu"/"rien gagné").
type BilanMensuel = {
  ventes?: number;
  moyenneParJour?: number;
  caTotal?: number;
  benefices?: number;
  margePct?: number;
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
  2023: {
    1: { ventes: 10, moyenneParJour: 0.32, caTotal: 1435, benefices: 331.68, margePct: 25 },
    2: { ventes: 89, moyenneParJour: 3.17, caTotal: 9422, benefices: 3103.86, margePct: 33 },
    3: { ventes: 175, moyenneParJour: 5.64, caTotal: 18202.5, benefices: 5524, margePct: 30.5 },
    4: { ventes: 196, moyenneParJour: 6.53, caTotal: 36036.5, benefices: 8519, margePct: 23.5 },
    5: { ventes: 223, moyenneParJour: 7.19, caTotal: 32852, benefices: 7743, margePct: 23.57 },
    6: { ventes: 180, moyenneParJour: 6, caTotal: 22555, benefices: 5555, margePct: 24.63 },
    7: { ventes: 259, moyenneParJour: 8.35, caTotal: 40070.5, benefices: 11512, margePct: 28.9 },
    8: { ventes: 349, moyenneParJour: 11.25, caTotal: 45632.53, benefices: 12740, margePct: 28 },
    9: { ventes: 255, moyenneParJour: 8.5, caTotal: 34202, benefices: 8337, margePct: 24.5 },
    10: { ventes: 187, moyenneParJour: 6.03, caTotal: 39395.5, benefices: 7101, margePct: 18.3 },
    11: { ventes: 164, moyenneParJour: 5.46, caTotal: 20476.5, benefices: 5825, margePct: 28.5 },
    12: { ventes: 126, moyenneParJour: 4.06, caTotal: 15864.5, benefices: 4940, margePct: 31 },
  },
  2024: {
    1: { ventes: 70, moyenneParJour: 2.26, caTotal: 12328.5, benefices: 4695, margePct: 38.08 },
    2: { ventes: 144, moyenneParJour: 4.96, caTotal: 20621.5, benefices: 8160, margePct: 39.57 },
    3: { ventes: 269, moyenneParJour: 8.67, caTotal: 34405, benefices: 12105, margePct: 35.18 },
    4: { ventes: 350, moyenneParJour: 11.73, caTotal: 56165.5, benefices: 19015, margePct: 33.86 },
    5: { ventes: 347, moyenneParJour: 11.19, caTotal: 44405, benefices: 14520, margePct: 32.7 },
    6: { ventes: 292, moyenneParJour: 9.73, caTotal: 37778, benefices: 12100, margePct: 32.03 },
    7: { ventes: 280, moyenneParJour: 9.03, caTotal: 48563, benefices: 14176, margePct: 29.19 },
    8: { ventes: 420, moyenneParJour: 13.54, caTotal: 59430, benefices: 19455, margePct: 32.74 },
    9: { ventes: 368, moyenneParJour: 12.26, caTotal: 51905, benefices: 15140, margePct: 29.17 },
    10: { ventes: 453, moyenneParJour: 14.61, caTotal: 86016.5, benefices: 22920, margePct: 26.65 },
    11: { ventes: 325, moyenneParJour: 10.83, caTotal: 47254, benefices: 11160, margePct: 23.62 },
    12: { ventes: 184, moyenneParJour: 5.93, caTotal: 33099.6, benefices: 9125, margePct: 27.57 },
  },
  2025: {
    1: { ventes: 149, moyenneParJour: 4.8, caTotal: 25402.5, benefices: 6872, margePct: 27.05 },
    2: { ventes: 292, moyenneParJour: 10.43, caTotal: 55901, benefices: 16120, margePct: 28.83 },
    3: { ventes: 381, moyenneParJour: 12.29, caTotal: 69832.5, benefices: 17115, margePct: 24.5 },
    4: { ventes: 546, moyenneParJour: 18.2, caTotal: 140310, benefices: 21850, margePct: 15.57 },
    5: { ventes: 489, moyenneParJour: 15.77, caTotal: 114615.5, benefices: 24750, margePct: 21.59 },
    6: { ventes: 322, moyenneParJour: 10.73, caTotal: 50892, benefices: 12950, margePct: 25.44 },
    7: { ventes: 324, moyenneParJour: 10.45, caTotal: 51727, benefices: 13100, margePct: 25.32 },
    8: { ventes: 586, moyenneParJour: 18.9, caTotal: 111709.52, benefices: 27800, margePct: 24.88 },
    9: { ventes: 658, moyenneParJour: 21.93, caTotal: 93993, benefices: 22400, margePct: 23.83 },
    10: { ventes: 663, moyenneParJour: 21.39, caTotal: 119036.95, benefices: 30770, margePct: 25.84 },
    11: { ventes: 723, moyenneParJour: 24.4, caTotal: 111533.25, benefices: 21750, margePct: 19.05 },
    // Marge non indiquée pour décembre dans la source Notion — calculée
    // (bénéfices / CA) comme pour les autres mois.
    12: { ventes: 435, moyenneParJour: 14.03, caTotal: 95600, benefices: 18420, margePct: 19.27 },
  },
  // 2026 en cours — janvier à juillet sont complets (ventes, CA, bénéfices,
  // marge) dans la source Notion. Août et septembre ont ventes/moyenne/CA
  // mais pas encore le bénéfice (demande de Mélanie, 2026-10-19) — à
  // compléter dès qu'il est connu (voir le support des champs incomplets
  // juste au-dessus).
  2026: {
    1: { ventes: 380, moyenneParJour: 12.26, caTotal: 64226, benefices: 16800, margePct: 26.15 },
    2: { ventes: 856, moyenneParJour: 30.57, caTotal: 183149, benefices: 29370, margePct: 16.03 },
    3: { ventes: 888, moyenneParJour: 28.65, caTotal: 153653.75, benefices: 35280, margePct: 22.92 },
    4: { ventes: 1100, moyenneParJour: 36.67, caTotal: 241819.87, benefices: 48490, margePct: 20.05 },
    5: { ventes: 762, moyenneParJour: 24.58, caTotal: 132739.5, benefices: 26950, margePct: 20.3 },
    6: { ventes: 455, moyenneParJour: 15.17, caTotal: 85585, benefices: 23780, margePct: 27.78 },
    7: { ventes: 531, moyenneParJour: 17.13, caTotal: 97875, benefices: 24700, margePct: 25.24 },
    8: { ventes: 714, moyenneParJour: 23.03, caTotal: 125693.5 },
    // Bénéfice pas encore connu (demande de Mélanie, 2026-10-19) — à
    // compléter dès qu'il est disponible.
    9: { ventes: 486, moyenneParJour: 16.2, caTotal: 80332.51 },
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
  data: { mois: number; label: string; ventes: number; ca: number; benefices?: number }[];
  onSelectMois: (mois: number) => void;
}) {
  const width = 900;
  const height = 420;
  const padX = 36;
  const padTop = 48;
  const padBottom = 40;
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
      <div className="mb-3 flex items-center gap-5 text-sm text-neutral-500">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: COULEUR_VENTES }} />
          Activités vendues
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: COULEUR_CA }} />
          Chiffre d&apos;affaires
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Activités vendues et chiffre d'affaires par mois"
      >
        <path d={pathVentes} fill="none" stroke={COULEUR_VENTES} strokeWidth="3" />
        <path d={pathCa} fill="none" stroke={COULEUR_CA} strokeWidth="3" />
        {data.map((d, i) => {
          // Les cercles seuls sont une cible de clic bien trop petite —
          // une bande transparente sur toute la hauteur du mois, elle, se
          // clique n'importe où dans sa colonne.
          const bandWidth = data.length > 1 ? innerW / data.length : innerW;
          // Pas d'étiquette de valeur permanente — sur 12 mois elles se
          // chevauchaient dès que les deux courbes se croisaient (illisible,
          // retour de Mélanie, 2026-10-15). Un <title> SVG marchait mal
          // (natif, lent, peu fiable selon navigateur) — remplacé par une
          // vraie bulle qui s'affiche instantanément au survol
          // (group-hover), avec les deux valeurs dedans.
          const topY = Math.min(yForVentes(d.ventes), yForCa(d.ca));
          const tooltipW = 220;
          const tooltipH = 72;
          const tooltipX = Math.min(Math.max(xFor(i) - tooltipW / 2, 4), width - tooltipW - 4);
          const tooltipY = Math.max(topY - tooltipH - 14, 4);
          return (
            <g
              key={d.mois}
              onClick={() => onSelectMois(d.mois)}
              className="group cursor-pointer"
              role="button"
              aria-label={`Voir le détail de ${d.label}`}
            >
              <rect
                x={xFor(i) - bandWidth / 2}
                y={padTop - 16}
                width={bandWidth}
                height={innerH + 16}
                fill="transparent"
                className="transition group-hover:fill-black/5"
              />
              <circle cx={xFor(i)} cy={yForVentes(d.ventes)} r={5.5} fill={COULEUR_VENTES} />
              <circle cx={xFor(i)} cy={yForCa(d.ca)} r={5.5} fill={COULEUR_CA} />
              <text x={xFor(i)} y={height - 10} textAnchor="middle" fontSize="14" fill="#78716c">
                {d.label}
              </text>
              <g className="pointer-events-none opacity-0 transition group-hover:opacity-100">
                <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx={6} fill="#171717" />
                <text x={tooltipX + 12} y={tooltipY + 20} fontSize="13" fontWeight="600" fill="white">
                  {d.label}
                </text>
                <text x={tooltipX + 12} y={tooltipY + 40} fontSize="12" fill={COULEUR_VENTES}>
                  {d.ventes} vente{d.ventes > 1 ? "s" : ""}
                </text>
                <text x={tooltipX + 12} y={tooltipY + 60} fontSize="12" fill={COULEUR_CA}>
                  CA {eurosDec(d.ca)} € (bénéf. {d.benefices !== undefined ? `${eurosDec(d.benefices)} €` : "—"})
                </text>
              </g>
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
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  remboursements,
}: {
  sub: DirectionSub;
  annee: number;
  setAnnee: (a: number) => void;
  mois: number | null;
  setMois: (m: number) => void;
  onNavigateSub: (sub: DirectionSub) => void;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  remboursements: Remboursement[];
}) {
  const moisDispos = moisDisponiblesPour(annee);

  // Mois en cours (ex. "2026-10") : au lieu d'attendre l'import manuel
  // Notion en fin de mois, ce mois-là se calcule en direct depuis les
  // vraies données (ventes confirmées, CA), et se met donc à jour tout
  // seul au fil des nouvelles réservations — affiché distinctement (bleu,
  // badge "En cours") pour ne jamais le confondre avec un bilan figé
  // (demande de Mélanie, 2026-10-19).
  const todayFull = todayStr();
  const todayYm = todayFull.slice(0, 7);
  const anneeEnCours = Number(todayFull.slice(0, 4));
  const moisEnCours = Number(todayFull.slice(5, 7));
  const jourEnCours = Number(todayFull.slice(8, 10));
  const estMoisEnCours = mois !== null && annee === anneeEnCours && mois === moisEnCours;

  const bilanEnDirect: BilanMensuel | null = useMemo(() => {
    if (!estMoisEnCours) return null;
    // Une activité peut être validée ("Confirmée") isolément sur un
    // prospect sans que son dossier entier ne soit confirmé (bouton
    // "✓ Valider cette activité") — sans ce filtre, un prospect jamais
    // confirmé gonflait quand même le CA en direct (incident vécu,
    // 2026-10-19/20, même famille que Sylvain Mormentyn).
    const ventesMois = reservationsVendues(reservations).filter(
      (r) =>
        (r.date_debut || "").slice(0, 7) === todayYm &&
        clients.find((c) => c.id === r.client_id)?.statut === "Client confirmé"
    );
    // Un remboursement/avoir sur une activité reste compté sans ça comme
    // vendue à plein tarif — même garde que Bénéfices (BeneficesView) et le
    // classement rentabilité (rows plus bas), sans quoi ce CA "en direct"
    // divergeait de Bénéfices du montant exact des remboursements du mois
    // (200€ d'écart constaté, Mélanie, 2026-10-31).
    const caTotal = ventesMois.reduce((s, r) => {
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return s;
      const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      const impactCa = remboursements
        .filter((rb) => rb.activite_id === r.id)
        .reduce((sum, rb) => sum + remboursementImpact(rb).ca, 0);
      return s + total + impactCa;
    }, 0);
    return {
      ventes: ventesMois.length,
      moyenneParJour: jourEnCours > 0 ? ventesMois.length / jourEnCours : 0,
      caTotal,
    };
  }, [estMoisEnCours, reservations, clients, resaOptions, resaTarifs, remboursements, todayYm, jourEnCours]);

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
    <div className={`mx-auto p-6 ${sub === "compta_annee" ? "max-w-6xl" : "max-w-3xl"}`}>
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

      {sub === "compta_mois" && mois !== null && estMoisEnCours && bilanEnDirect && (
        <div className="mt-5 space-y-3">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            ● En cours
          </span>
          <div className="grid grid-cols-2 gap-3">
            <StatTile mono={false} tone="blue" label="Ventes au mois" value={`${bilanEnDirect.ventes}`} />
            <StatTile
              mono={false}
              tone="blue"
              label="Moyenne par jour"
              value={(bilanEnDirect.moyenneParJour ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile mono={false} tone="blue" label="CA total" value={`${eurosDec(bilanEnDirect.caTotal ?? 0)} €`} />
            <StatTile mono={false} tone="blue" label="Bénéfices" value="—" />
            <StatTile mono={false} tone="blue" label="Marge (CA/Bénef)" value="—" />
          </div>
          <p className="text-xs text-neutral-400">
            Mois en cours — calculé en direct à partir des réservations confirmées, se met à jour
            automatiquement au fil des ventes. Bénéfices/marge pas disponibles en direct (connus
            seulement à la clôture du mois).
          </p>
        </div>
      )}

      {sub === "compta_mois" &&
        mois !== null &&
        !estMoisEnCours &&
        (bilanMois ? (
          <div className="mt-5 space-y-3">
            {(bilanMois.ventes !== undefined || bilanMois.moyenneParJour !== undefined) && (
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  mono={false}
                  label="Ventes au mois"
                  value={bilanMois.ventes !== undefined ? `${bilanMois.ventes}` : "—"}
                />
                <StatTile
                  mono={false}
                  label="Moyenne par jour"
                  value={
                    bilanMois.moyenneParJour !== undefined
                      ? bilanMois.moyenneParJour.toLocaleString("fr-FR")
                      : "—"
                  }
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                mono={false}
                tone="blue"
                label="CA total"
                value={bilanMois.caTotal !== undefined ? `${eurosDec(bilanMois.caTotal)} €` : "—"}
              />
              <StatTile
                mono={false}
                tone="green"
                label="Bénéfices"
                value={bilanMois.benefices !== undefined ? `${eurosDec(bilanMois.benefices)} €` : "—"}
              />
              <StatTile
                mono={false}
                label="Marge (CA/Bénef)"
                value={bilanMois.margePct !== undefined ? `${bilanMois.margePct.toLocaleString("fr-FR")}%` : "—"}
              />
            </div>
            {(bilanMois.ventes === undefined ||
              bilanMois.caTotal === undefined ||
              bilanMois.benefices === undefined) && (
              <p className="text-xs text-neutral-400">
                Dossier incomplet pour l&apos;instant — certaines informations sont encore manquantes, elles
                s&apos;ajouteront dès qu&apos;elles seront transmises.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            {MOIS_FR[mois - 1]} {annee} — rien configuré pour l&apos;instant.
          </p>
        ))}

      {sub === "compta_mois" && mois !== null && (
        <div className="mt-6">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Comparatif — {MOIS_FR[mois - 1]} au fil des années
          </p>
          {(() => {
            const moisFixe = mois;
            const lignesAutresAnnees = COMPTA_ANNEES.map((a) => ({
              annee: a,
              // Mois en cours : pas d'entrée figée dans COMPTA_BILANS_MENSUELS
              // (normal, elle n'arrive qu'à la clôture) — le comparatif
              // utilise alors le bilan en direct pour ne pas faire
              // disparaître l'année en cours de ce tableau.
              bilan:
                a === anneeEnCours && moisFixe === moisEnCours && bilanEnDirect
                  ? bilanEnDirect
                  : COMPTA_BILANS_MENSUELS[a]?.[moisFixe],
            })).filter((l) => l.bilan);
            if (lignesAutresAnnees.length === 0) {
              return <p className="text-sm text-neutral-500">Aucune autre année avec des données.</p>;
            }
            // Flèche verte sur l'année qui a fait le plus gros bénéfice ce
            // mois-là, toutes années confondues (demande de Mélanie,
            // 2026-10-15) — seulement parmi les années où le bénéfice est
            // connu (ex. août 2026 pas encore).
            const lignesAvecBenef = lignesAutresAnnees.filter((l) => l.bilan!.benefices !== undefined);
            const anneeMeilleurBenef =
              lignesAvecBenef.length > 0
                ? lignesAvecBenef.reduce((best, l) => (l.bilan!.benefices! > best.bilan!.benefices! ? l : best))
                    .annee
                : null;
            return (
              <div className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#eaeaea] text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      <th className="px-3 py-2 font-medium">Année</th>
                      <th className="px-3 py-2 text-right font-medium">Ventes</th>
                      <th className="px-3 py-2 text-right font-medium">CA</th>
                      <th className="px-3 py-2 text-right font-medium">Bénéfices</th>
                      <th className="px-3 py-2 text-right font-medium">Vs année préc.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaeaea]">
                    {lignesAutresAnnees.map(({ annee: a, bilan }) => {
                      // Comparé à la vraie année a-1, pas à la ligne
                      // précédente du tableau — une année sans données ne
                      // doit jamais être prise comme référence silencieuse.
                      const bilanPrecedent = COMPTA_BILANS_MENSUELS[a - 1]?.[moisFixe];
                      const evolutionPct =
                        bilanPrecedent &&
                        bilanPrecedent.benefices !== undefined &&
                        bilanPrecedent.benefices > 0 &&
                        bilan!.benefices !== undefined
                          ? ((bilan!.benefices - bilanPrecedent.benefices) / bilanPrecedent.benefices) * 100
                          : null;
                      return (
                        <tr key={a} className={a === annee ? "bg-[#fafafa]" : ""}>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setAnnee(a)}
                              className={`hover:underline ${a === annee ? "font-semibold text-[#171717]" : ""}`}
                            >
                              {a}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">{bilan!.ventes ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {bilan!.caTotal !== undefined ? `${eurosDec(bilan!.caTotal)} €` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {bilan!.benefices !== undefined ? `${eurosDec(bilan!.benefices)} €` : "—"}
                            {anneeMeilleurBenef !== null && a === anneeMeilleurBenef && (
                              <span className="ml-1 text-green-600" title="Meilleur bénéfice sur ce mois">
                                ↑
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2 text-right ${
                              evolutionPct === null
                                ? "text-neutral-400"
                                : evolutionPct >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                            }`}
                          >
                            {evolutionPct === null
                              ? "—"
                              : `${evolutionPct >= 0 ? "+" : ""}${evolutionPct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {sub === "compta_annee" &&
        (moisAvecDonnees.length > 0 ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile mono={false} label="CA total de l'année" value={`${eurosDec(caTotalAnnee)} €`} />
              <StatTile
                mono={false}
                tone="green"
                label="Bénéfices de l'année"
                value={`${eurosDec(beneficesAnnee)} €`}
              />
              <StatTile
                mono={false}
                label="Marge (CA/Bénef)"
                value={`${margeAnnee.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Activités vendues et CA par mois — {annee} — clique un mois pour son détail
              </p>
              <ComptaCourbeChart
                data={moisAvecDonnees
                  // Un mois dont on ne connaît ni les ventes ni le CA n'a
                  // pas sa place ici — le tracer à 0 vente/0€ laisserait
                  // croire à un vrai mois à zéro plutôt qu'à une donnée
                  // manquante. Le bénéfice, lui, n'est pas une condition :
                  // un mois peut apparaître avec ventes/CA connus et
                  // bénéfice encore "—" (ex. août 2026).
                  .filter((m) => bilansAnnee[m]?.ventes !== undefined && bilansAnnee[m]?.caTotal !== undefined)
                  .map((m) => ({
                    mois: m,
                    label: COMPTA_MOIS_ABREV[m - 1],
                    ventes: bilansAnnee[m]!.ventes!,
                    ca: bilansAnnee[m]!.caTotal!,
                    benefices: bilansAnnee[m]!.benefices,
                  }))}
                onSelectMois={allerAuMois}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Bénéfices par mois — {annee}
                </p>
                <div className="rounded-md bg-white p-4">
                  <Donut
                    segments={moisAvecDonnees
                      // Un mois sans bénéfice connu (ex. août 2026) n'a
                      // rien à faire dans un camembert de répartition des
                      // bénéfices — il resterait quand même listé à "0%",
                      // ce qui laisserait croire à un vrai zéro.
                      .filter((m) => bilansAnnee[m]?.benefices !== undefined)
                      .map((m) => ({
                        label: MOIS_FR[m - 1],
                        value: bilansAnnee[m]!.benefices!,
                        color: COMPTA_MOIS_COULEURS[m - 1],
                      }))}
                    centerValue={`${eurosDec(beneficesAnnee)} €`}
                    centerLabel="bénéfices"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Détail des bénéfices — {annee}
                </p>
                <div className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#eaeaea] text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        <th className="px-3 py-2 font-medium">Mois</th>
                        <th className="px-3 py-2 text-right font-medium">Bénéfices</th>
                        <th className="px-3 py-2 text-right font-medium">Part de l&apos;année</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaeaea]">
                      {(() => {
                        // Repère le mois le plus et le moins rentable de
                        // l'année affichée — surlignés en vert/rouge pastel
                        // pour sauter aux yeux dans le tableau (demande de
                        // Mélanie, 2026-10-15). Seulement s'il y a plus d'un
                        // mois, sinon la même ligne serait les deux à la fois.
                        // Un mois sans bénéfice connu (ex. août 2026) ne
                        // peut pas concourir pour le max/min — ni en être
                        // faussement exclu (il reste 0 implicite).
                        const moisConnus = moisAvecDonnees.filter((m) => bilansAnnee[m]?.benefices !== undefined);
                        let moisMax: number | null = null;
                        let moisMin: number | null = null;
                        if (moisConnus.length > 1) {
                          moisConnus.forEach((m) => {
                            const benef = bilansAnnee[m]!.benefices!;
                            if (moisMax === null || benef > bilansAnnee[moisMax]!.benefices!) moisMax = m;
                            if (moisMin === null || benef < bilansAnnee[moisMin]!.benefices!) moisMin = m;
                          });
                        }
                        return moisAvecDonnees.map((m) => {
                          const benef = bilansAnnee[m]?.benefices;
                          const part = benef !== undefined && beneficesAnnee > 0 ? (benef / beneficesAnnee) * 100 : null;
                          const rowClass =
                            m === moisMax ? "bg-green-50" : m === moisMin ? "bg-red-50" : "";
                          return (
                            <tr key={m} className={rowClass}>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => allerAuMois(m)}
                                  className="flex items-center gap-1.5 text-left hover:underline"
                                >
                                  <span
                                    className="h-2 w-2 flex-shrink-0 rounded-full"
                                    style={{ backgroundColor: COMPTA_MOIS_COULEURS[m - 1] }}
                                  />
                                  <span className="capitalize">{MOIS_FR[m - 1]}</span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-[#171717]">
                                {benef !== undefined ? `${eurosDec(benef)} €` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right text-neutral-500">
                                {part !== null ? `${part.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%` : "—"}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#eaeaea] font-semibold text-[#171717]">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{eurosDec(beneficesAnnee)} €</td>
                        <td className="px-3 py-2 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
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

// Champ "Coût réel" éditable directement depuis Bénéfices — demande de
// Mélanie, 2026-10-29 : elle veut saisir le coût depuis cette rubrique,
// pas depuis la fiche client. State local pour rester tapable pendant la
// frappe ; l'enregistrement part au blur ou sur Entrée, jamais à chaque
// frappe.
function CoutReelCell({ value, onCommit }: { value: number | null; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string>(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  return (
    <input
      type="number"
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        onCommit(Number.isFinite(n) ? n : 0);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder="—"
      className="w-20 rounded-[4px] border border-[#eaeaea] px-2 py-1 text-right text-sm focus:border-[#171717]/40 focus:outline-none"
    />
  );
}

// Bénéfices — demande de Mélanie, 2026-10-29. Contrairement aux bilans
// jour/mois/an ci-dessus (souvent saisis à la main depuis l'import Notion),
// cette page part toujours des vraies réservations du CRM : année > mois >
// jour > détail par client/activité, avec le même calcul CA/marge que le
// classement rentabilité (garde "Client confirmé", distinction coût
// saisi/non saisi, impact remboursements — voir `rows` plus bas).
function BeneficesView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  catalogue,
  coutsMap,
  coutsVerifieMap,
  remboursements,
  onOpenClient,
  onUpdateCoutReel,
  onUpdateCoutVerifie,
  paiementsEtapes,
  paiementsPrevus,
  onOpenRdvPaiement,
  onUpdateReservation,
  onUpdateClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  catalogue: CatalogueItem[];
  coutsMap: Record<string, number>;
  coutsVerifieMap: Record<string, boolean>;
  remboursements: Remboursement[];
  onOpenClient: (id: string) => void;
  onUpdateCoutReel: (reservationId: string, value: number) => void;
  onUpdateCoutVerifie: (reservationId: string, verifie: boolean) => void;
  paiementsEtapes: PaiementEtape[];
  paiementsPrevus: PaiementPrevu[];
  onOpenRdvPaiement: (clientId: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
}) {
  const [annee, setAnnee] = useState<number>(COMPTA_ANNEES[COMPTA_ANNEES.length - 1]);
  const [mois, setMois] = useState<number | null>(null);
  const [jour, setJour] = useState<string | null>(null);
  // Popup détail activité — même modale que Réservations (demande de
  // Mélanie, 2026-10-29), pour ne pas dupliquer sa logique.
  const [activeActivity, setActiveActivity] = useState<{ client: Client; r: Reservation } | null>(null);
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("hotels_reference")
      .select("*")
      .then(({ data }) => setHotelsRef((data as HotelReference[]) || []));
  }, []);

  const normalizeNom = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  const catalogueByNom: Record<string, CatalogueItem> = {};
  catalogue.forEach((a) => {
    catalogueByNom[normalizeNom(a.nom)] = a;
  });

  const ventesAnnee = useMemo(
    () =>
      reservationsVendues(reservations).filter(
        (r) =>
          (r.date_debut || "").slice(0, 4) === String(annee) &&
          clients.find((c) => c.id === r.client_id)?.statut === "Client confirmé"
      ),
    [reservations, clients, annee]
  );

  const moisDispos = useMemo(() => {
    const set = new Set<number>();
    ventesAnnee.forEach((r) => {
      if (r.date_debut) set.add(Number(r.date_debut.slice(5, 7)));
    });
    return set;
  }, [ventesAnnee]);

  const ventesMois = useMemo(
    () => (mois === null ? [] : ventesAnnee.filter((r) => Number((r.date_debut || "").slice(5, 7)) === mois)),
    [ventesAnnee, mois]
  );

  // Agrégat par jour (nombre de ventes, CA, bénéfice) pour la liste de
  // jours du mois choisi — même calcul que le détail, juste sommé.
  const joursDispos = useMemo(() => {
    const map = new Map<string, { ca: number; benefice: number; nb: number }>();
    ventesMois.forEach((r) => {
      const date = r.date_debut as string;
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;
      const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      const coutSaisi = coutsMap[r.id] !== undefined;
      const cout = Number(coutsMap[r.id]) || 0;
      const impacts = remboursements.filter((rb) => rb.activite_id === r.id).map(remboursementImpact);
      const impactCa = impacts.reduce((s, i) => s + i.ca, 0);
      const impactMarge = impacts.reduce((s, i) => s + i.marge, 0);
      const prev = map.get(date) || { ca: 0, benefice: 0, nb: 0 };
      map.set(date, {
        ca: prev.ca + total + impactCa,
        // Tant que le coût réel n'est pas saisi, on compte 0 € de bénéfice
        // (pas le CA entier) — demande de Mélanie, 2026-10-29 : un coût
        // manquant ne doit jamais gonfler artificiellement le bénéfice
        // affiché.
        benefice: prev.benefice + (coutSaisi ? total - cout + impactMarge : 0),
        nb: prev.nb + 1,
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ventesMois, clients, resaOptions, resaTarifs, coutsMap, remboursements]);

  // Détail client/activité du jour choisi — mêmes champs que `rows` plus
  // bas dans ce fichier (classement rentabilité), appliqués à une seule
  // journée.
  const detailJour = useMemo(() => {
    if (!jour) return [];
    return ventesMois
      .filter((r) => r.date_debut === jour)
      .map((r) => {
        const client = clients.find((c) => c.id === r.client_id);
        const total = client ? resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []) : 0;
        const coutSaisi = coutsMap[r.id] !== undefined;
        const cout = Number(coutsMap[r.id]) || 0;
        const impacts = remboursements.filter((rb) => rb.activite_id === r.id).map(remboursementImpact);
        const impactCa = impacts.reduce((s, i) => s + i.ca, 0);
        const impactMarge = impacts.reduce((s, i) => s + i.marge, 0);
        const catalogueMatch = r.catalogue_item_id
          ? catalogue.find((a) => a.id === r.catalogue_item_id)
          : catalogueByNom[normalizeNom(cleanActivityTitle(r.nom_activite || ""))];
        return {
          id: r.id,
          clientId: r.client_id,
          clientNom: client?.nom || "Sans nom",
          activite: catalogueMatch?.nom || r.nom_activite || "Sans nom",
          ca: total + impactCa,
          cout,
          coutSaisi,
          // Coût jamais saisi = bénéfice affiché à 0 €, pas le CA entier
          // (demande de Mélanie, 2026-10-29).
          benefice: coutSaisi ? total - cout + impactMarge : 0,
          verifie: coutsVerifieMap[r.id] === true,
          reservation: r,
          client,
        };
      })
      .sort((a, b) => {
        // Même ordre que Réservations (par heure de pick-up réel
        // croissante, celles sans pick-up derrière) — demande de Mélanie,
        // 2026-10-29, au lieu d'un tri alphabétique par client.
        const pa = pickupSortMinutes(a.reservation);
        const pb = pickupSortMinutes(b.reservation);
        if (pa !== null && pb !== null) return pa - pb;
        if (pa !== null) return -1;
        if (pb !== null) return 1;
        return a.clientNom.localeCompare(b.clientNom);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jour, ventesMois, clients, resaOptions, resaTarifs, coutsMap, coutsVerifieMap, remboursements, catalogue]);

  const totalJour = detailJour.reduce(
    (acc, r) => ({ ca: acc.ca + r.ca, cout: acc.cout + r.cout, benefice: acc.benefice + r.benefice }),
    { ca: 0, cout: 0, benefice: 0 }
  );

  // Somme des jours du mois choisi — demande de Mélanie, 2026-10-29.
  const totalMois = joursDispos.reduce(
    (acc, [, agg]) => ({ ca: acc.ca + agg.ca, benefice: acc.benefice + agg.benefice }),
    { ca: 0, benefice: 0 }
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
        <span>Comptabilité</span>
        <span>/</span>
        <span className={mois === null ? "font-medium text-[#171717]" : ""}>Bénéfices</span>
        {mois !== null && (
          <>
            <span>/</span>
            <button
              type="button"
              onClick={() => setJour(null)}
              className={jour === null ? "font-medium text-[#171717]" : "hover:underline"}
            >
              {MOIS_FR[mois - 1]} {annee}
            </button>
          </>
        )}
        {jour !== null && (
          <>
            <span>/</span>
            <span className="font-medium text-[#171717] capitalize">{fmtDate(jour)}</span>
          </>
        )}
      </div>

      <h2 className="font-heading text-lg font-semibold text-[#171717]">Bénéfices</h2>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {COMPTA_ANNEES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAnnee(a);
              setMois(null);
              setJour(null);
            }}
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

      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const dispo = moisDispos.has(m);
          return (
            <button
              key={m}
              type="button"
              disabled={!dispo}
              onClick={() => {
                setMois(m);
                setJour(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                mois === m
                  ? "border-[#171717] bg-[#171717] text-white"
                  : dispo
                    ? "border-[#eaeaea] text-[#666666] hover:bg-[#fafafa]"
                    : "border-[#f5f5f5] text-neutral-300"
              }`}
            >
              {MOIS_FR[m - 1]}
            </button>
          );
        })}
      </div>

      {mois === null && (
        <p className="mt-4 text-sm text-neutral-500">
          Choisis un mois pour voir les jours avec des ventes confirmées.
        </p>
      )}

      {mois !== null && jour === null && (
        <div className="mt-5">
          {joursDispos.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Aucune vente confirmée en {MOIS_FR[mois - 1]} {annee}.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatTile mono={false} label={`CA de ${MOIS_FR[mois - 1]}`} value={`${euros(totalMois.ca)} €`} />
                <StatTile
                  mono={false}
                  tone="green"
                  label={`Bénéfices de ${MOIS_FR[mois - 1]}`}
                  value={`${euros(totalMois.benefice)} €`}
                />
              </div>
              <div className="mt-3 space-y-1.5">
              {joursDispos.map(([date, agg]) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setJour(date)}
                  className="flex w-full items-center justify-between rounded-[6px] border border-[#eaeaea] bg-white px-4 py-2.5 text-left hover:border-[#171717]/30 hover:bg-[#fafafa]"
                >
                  <span className="font-heading text-sm font-medium text-[#171717] capitalize">{fmtDate(date)}</span>
                  <span className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>
                      {agg.nb} activité{agg.nb > 1 ? "s" : ""}
                    </span>
                    <span className="text-[#171717]">CA {euros(agg.ca)} €</span>
                    <span className="font-medium text-green-700">Bénéf. {euros(agg.benefice)} €</span>
                  </span>
                </button>
              ))}
              </div>
            </>
          )}
        </div>
      )}

      {jour !== null && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setJour(null)}
            className="mb-3 text-xs text-neutral-500 hover:underline"
          >
            ← retour aux jours de {MOIS_FR[mois! - 1]}
          </button>

          <p className="mb-3 text-xs text-neutral-400">
            Total {MOIS_FR[mois! - 1]} : <span className="text-[#171717]">CA {euros(totalMois.ca)} €</span>{" "}
            · <span className="font-medium text-green-700">Bénéf. {euros(totalMois.benefice)} €</span>
          </p>

          <div className="grid grid-cols-3 gap-3">
            <StatTile mono={false} label="CA du jour" value={`${euros(totalJour.ca)} €`} />
            <StatTile mono={false} label="Coût réel" value={`${euros(totalJour.cout)} €`} />
            <StatTile mono={false} tone="green" label="Bénéfices" value={`${euros(totalJour.benefice)} €`} />
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            {detailJour.filter((r) => r.verifie).length} / {detailJour.length} ligne
            {detailJour.length > 1 ? "s" : ""} vérifiée{detailJour.filter((r) => r.verifie).length > 1 ? "s" : ""}
          </p>

          <div className="mt-2 overflow-x-auto rounded-[6px] border border-[#eaeaea]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#eaeaea] bg-[#fafafa] text-xs uppercase tracking-wide text-neutral-400">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Activité</th>
                  <th className="px-3 py-2 text-right">CA</th>
                  <th className="px-3 py-2 text-right">Coût réel</th>
                  <th className="px-3 py-2 text-right">Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                {detailJour.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-sm text-neutral-500">
                      Rien ce jour-là.
                    </td>
                  </tr>
                ) : (
                  detailJour.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#f0f0f0] last:border-0 ${r.verifie ? "bg-green-50/60" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={r.verifie}
                          onChange={(e) => onUpdateCoutVerifie(r.id, e.target.checked)}
                          title="Coût et bénéfice vérifiés"
                          className="h-4 w-4 accent-[#0F5C56]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenClient(r.clientId)}
                          className="text-left text-[#171717] hover:underline"
                        >
                          {r.clientNom}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-neutral-600">
                        {r.client ? (
                          <button
                            type="button"
                            onClick={() => setActiveActivity({ client: r.client as Client, r: r.reservation })}
                            className="text-left hover:underline"
                          >
                            {r.activite}
                          </button>
                        ) : (
                          r.activite
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{euros(r.ca)} €</td>
                      <td className="px-3 py-2 text-right">
                        <CoutReelCell
                          value={r.coutSaisi ? r.cout : null}
                          onCommit={(v) => onUpdateCoutReel(r.id, v)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">{euros(r.benefice)} €</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeActivity && (
        <ActivityDetailModal
          key={activeActivity.r.id}
          client={activeActivity.client}
          r={activeActivity.r}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          paiementsPrevus={paiementsPrevus}
          onOpenClient={onOpenClient}
          onOpenActivity={(rr) => setActiveActivity({ client: activeActivity.client, r: rr })}
          onOpenRdvPaiement={onOpenRdvPaiement}
          onUpdateReservation={onUpdateReservation}
          onUpdateClient={(patch) => onUpdateClient(activeActivity.client.id, patch)}
          hotelsRef={hotelsRef}
          onClose={() => setActiveActivity(null)}
        />
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
  paiementsEtapes,
  paiementsPrevus,
  onOpenRdvPaiement,
  onUpdateReservation,
  onUpdateClient,
  onUpdateCoutReel,
  coutsVerifieMap,
  onUpdateCoutVerifie,
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
  // Pour le popup "Voir l'activité" de Récap du mois (sub === "recap").
  paiementsEtapes: PaiementEtape[];
  paiementsPrevus: PaiementPrevu[];
  onOpenRdvPaiement: (clientId: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  // Saisie du coût réel depuis Bénéfices (sub === "benefices") — demande de
  // Mélanie, 2026-10-29. Toujours "manuel" (voir BeneficesView).
  onUpdateCoutReel: (reservationId: string, value: number) => void;
  coutsVerifieMap: Record<string, boolean>;
  onUpdateCoutVerifie: (reservationId: string, verifie: boolean) => void;
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

  // Rattache une réservation saisie à la main (sans catalogue_item_id) au
  // catalogue par nom, si une correspondance exacte existe une fois
  // nettoyé/normalisé — sinon "Louxor en mini-bus" ou "Yacht privé (grand
  // modèle)" ressort en deux lignes distinctes dans les classements
  // (certaines ventes liées au catalogue, d'autres saisies à la main avec
  // exactement le même nom), demande de Mélanie, 2026-10-28.
  const normalizeNom = (s: string) =>
    (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();
  const catalogueByNom: Record<string, CatalogueItem> = {};
  catalogue.forEach((a) => {
    catalogueByNom[normalizeNom(a.nom)] = a;
  });

  const rows = reservationsVendues(reservations)
    .filter(
      (r) =>
        inRange(r.date_debut) &&
        // Une activité peut être validée isolément sur un prospect sans
        // que son dossier soit confirmé — sans ce filtre, ça gonflait le
        // CA/classement rentabilité (incident vécu, 2026-10-19/20).
        clients.find((c) => c.id === r.client_id)?.statut === "Client confirmé"
    )
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
      // catalogue à jour prime) ; à défaut, tente un rattachement par nom
      // normalisé (voir catalogueByNom plus haut) avant de retomber sur le
      // nom d'activité saisi à la main.
      const catalogueMatch = r.catalogue_item_id
        ? catalogue.find((a) => a.id === r.catalogue_item_id)
        : catalogueByNom[normalizeNom(cleanActivityTitle(r.nom_activite || ""))];
      return {
        groupKey: r.catalogue_item_id || catalogueMatch?.id || `manuel:${r.nom_activite || "Sans nom"}`,
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
    .filter(
      (r) =>
        (r.date_debut || "").slice(0, 7) === currentMonth &&
        clients.find((c) => c.id === r.client_id)?.statut === "Client confirmé"
    )
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
    // Même garde que rows/rowsMoisActuel ci-dessus — une activité validée
    // isolément sur un prospect ne doit jamais entrer dans la tendance
    // CA/marge (incident vécu, 2026-10-19/20).
    if (client?.statut !== "Client confirmé") return;
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
        paiementsEtapes={paiementsEtapes}
        paiementsPrevus={paiementsPrevus}
        onOpenClient={onOpenClient}
        onOpenRdvPaiement={onOpenRdvPaiement}
        onUpdateReservation={onUpdateReservation}
        onUpdateClient={onUpdateClient}
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
        clients={clients}
        reservations={reservations}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
        remboursements={remboursements}
      />
    );
  }

  if (sub === "benefices") {
    return (
      <BeneficesView
        clients={clients}
        reservations={reservations}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
        catalogue={catalogue}
        coutsMap={coutsMap}
        remboursements={remboursements}
        onOpenClient={onOpenClient}
        onUpdateCoutReel={onUpdateCoutReel}
        coutsVerifieMap={coutsVerifieMap}
        onUpdateCoutVerifie={onUpdateCoutVerifie}
        paiementsEtapes={paiementsEtapes}
        paiementsPrevus={paiementsPrevus}
        onOpenRdvPaiement={onOpenRdvPaiement}
        onUpdateReservation={onUpdateReservation}
        onUpdateClient={onUpdateClient}
      />
    );
  }

  if (sub === "statsAgences") {
    return <StatsAgenceView />;
  }

  if (sub === "statsEmployes") {
    return <StatsEmployesView />;
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

function StatTile({
  label,
  value,
  mono = true,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  // "green"/"blue" = carte toujours dans cette couleur pastel, ex.
  // "Bénéfices" (vert) et "CA total" (bleu) dans Comptabilité (demande de
  // Mélanie, 2026-10-15) — inchangé partout ailleurs.
  tone?: "default" | "green" | "blue";
}) {
  const toneClass =
    tone === "green" ? "border-green-100 bg-green-50" : tone === "blue" ? "border-blue-100 bg-blue-50" : "border-[#eaeaea] bg-white";
  return (
    <div className={`relative overflow-hidden rounded-[6px] border p-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold text-[#171717] ${mono ? "font-amounts" : ""}`}>{value}</p>
    </div>
  );
}
