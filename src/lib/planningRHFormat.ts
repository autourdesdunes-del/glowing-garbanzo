import { PlanningShift } from "@/lib/types";

// Petits formateurs/helpers propres à PlanningRHView.tsx — extraits pour
// alléger ce fichier, sans changement de comportement.

export function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
export function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function todayStr() {
  return localIso(new Date());
}
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000) + 1;
}
export function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localIso(d);
}
export function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
// Avril, août, octobre : haute saison pour l'agence — pas de congé possible
// sur ces mois-là, même partiellement.
const BLOCKED_CONGE_MONTHS = [4, 8, 10];
export function rangeHitsBlockedMonth(debut: string, fin: string) {
  const d = new Date(debut + "T00:00:00");
  const end = new Date(fin + "T00:00:00");
  while (d <= end) {
    if (BLOCKED_CONGE_MONTHS.includes(d.getMonth() + 1)) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}
// Chaque semaine commence le lundi — toute date choisie est ramenée au
// lundi de sa semaine, pour ne plus jamais décaler l'alternance A/B.
export function mondayOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return localIso(d);
}

export const WEEKDAY_JS_TO_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export function statutLabel(statut: string, debut?: string, fin?: string) {
  if (statut === "conge") return "Congé";
  if (statut === "repos") return "OFF";
  if (statut === "superviseur") return "Superviseur";
  return debut || fin ? `${debut} – ${fin}` : "Travail";
}

export function statutBadgeClass(statut: string) {
  if (statut === "conge") return "bg-neutral-300 text-neutral-600";
  if (statut === "repos") return "bg-neutral-200 text-neutral-500";
  if (statut === "superviseur") return "bg-purple-200 text-purple-800";
  return "bg-blue-100 text-blue-700";
}

// Tri des cartes d'une journée : OFF toujours en premier (repérable d'un
// coup d'œil), puis congé/superviseur, puis les horaires de travail triés
// par heure de début croissante.
export function sortDayShifts(a: PlanningShift, b: PlanningShift) {
  const rank = (s: PlanningShift) => (s.statut === "repos" ? 0 : s.statut === "travail" ? 2 : 1);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 2) return (a.shift_debut || "").localeCompare(b.shift_debut || "");
  return 0;
}

// Priorité d'affichage quand plusieurs personnes ont des statuts différents
// le même jour (vue d'ensemble équipe) : congé/superviseur d'abord car ce
// sont les exceptions les plus utiles à repérer d'un coup d'œil.
const STATUT_PRIORITY = ["conge", "superviseur", "travail", "repos"];
export function dominantStatut(dayShifts: PlanningShift[]): string | null {
  if (dayShifts.length === 0) return null;
  for (const s of STATUT_PRIORITY) {
    if (dayShifts.some((sh) => sh.statut === s)) return s;
  }
  return dayShifts[0].statut;
}

export const AVATAR_PALETTE = [
  { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400" },
  { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-400" },
  { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  { bg: "bg-pink-50", border: "border-pink-200", dot: "bg-pink-400" },
  { bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-400" },
  { bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-400" },
];

export const MONTH_NAMES_FULL = [
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
export const WEEKDAY_ABREV = ["L", "M", "M", "J", "V", "S", "D"];
