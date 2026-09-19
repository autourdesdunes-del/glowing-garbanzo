import { Reservation } from "@/lib/types";
import { localDateStr } from "@/lib/dates";

// Petits formateurs/helpers propres à PlanningView.tsx — extraits pour
// alléger ce fichier, sans changement de comportement.
export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
export function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
export function fmtDateLong(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
export function toStr(d: Date) {
  return localDateStr(d);
}
export function dateRangeIncludes(r: Reservation, dateStr: string) {
  if (!r.date_debut) return false;
  const end = r.date_fin || r.date_debut;
  return dateStr >= r.date_debut && dateStr <= end;
}
export function resaActiveOn(r: Reservation, dateStr: string) {
  if (r.statut_resa === "Annulée") return false;
  return dateRangeIncludes(r, dateStr);
}
export function rangesOverlap(rStart: string | null, rEnd: string | null, fStart: string, fEnd: string) {
  if (!rStart) return false;
  const end = rEnd || rStart;
  return rStart <= fEnd && end >= fStart;
}

// pickup_reel est un texte libre ("heure / lieu", ex. "9h devant la
// réception") — extrait l'heure en minutes depuis minuit pour trier les
// activités d'une même journée par ordre de pick-up (demande de Mélanie,
// 2026-09-19). Renvoie null si aucune heure n'est reconnaissable en tête du
// texte, pour laisser ces activités après celles avec un pick-up daté.
export function pickupMinutes(pickupReel: string | null | undefined): number | null {
  const m = /(\d{1,2})\s*[:h]\s*(\d{2})?/i.exec(pickupReel || "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Certaines activités (ex. "Le Caire en mini-bus") ont un pick-up réel très
// tôt le matin, donc en pratique récupéré la VEILLE au soir (ex. 23:35),
// pas le jour même de l'activité (Mélanie, 2026-09-19, voir pickup_veille
// dans types.ts). Pour le tri, on retranche 24h à ce pick-up : "23:35 la
// veille" devient -25 min, donc toujours avant n'importe quel pick-up du
// jour même (0-1439 min) — l'activité reste affichée sous le jour J
// (date_debut), seul son rang dans le tri change.
export function pickupSortMinutes(r: { pickup_reel: string; pickup_veille: boolean }): number | null {
  const m = pickupMinutes(r.pickup_reel);
  if (m === null) return null;
  return r.pickup_veille ? m - 1440 : m;
}

export const FILTERS = [
  { key: "hier", label: "Hier" },
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "demain", label: "Demain" },
  { key: "prochainement", label: "Prochainement" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois_choisi", label: "Choisir un mois" },
] as const;

export const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export function monthStartOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
export function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
export function monthEndOf(monthStartStr: string) {
  const d = new Date(monthStartStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
// Grille complète semaine par semaine (lundi → dimanche), en débordant sur
// le mois précédent/suivant pour ne jamais avoir de semaine incomplète.
export function buildMonthGrid(monthStartStr: string): string[] {
  const d = new Date(monthStartStr + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + endOffset);
  const days: string[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(toStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
