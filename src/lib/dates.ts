// Toutes les dates métier de l'app sont des chaînes "YYYY-MM-DD" en heure
// locale (date_debut, date_fin, etc.). `Date.prototype.toISOString()`
// convertit en UTC : pour tout fuseau en avance sur UTC (Europe, Égypte —
// donc toute l'équipe), minuit local tombe la veille en UTC, ce qui fait
// glisser silencieusement la date d'un jour en arrière. Ne jamais dériver
// une date "calendrier" avec toISOString — toujours passer par ces helpers.
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

// Index JS Date.getDay() (0 = dimanche) vers le nom de jour tel qu'utilisé
// dans catalogue_activites.jours_disponibles.
export const WEEKDAY_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

export function weekdayFr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAY_FR[d.getDay()];
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "2026-08-28" -> "28/08" — jj/mm, convention réutilisée partout où une
// date courte doit s'afficher (annulations, billets…).
export function fmtDDMM(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "09:00" -> "9h" / "09:30" -> "9h30" — heure courte façon "à l'oral",
// jamais "09h00" avec minutes à zéro.
export function fmtHeureCourte(heure: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure);
  if (!m) return "";
  const h = Number(m[1]);
  const min = m[2];
  return min === "00" ? `${h}h` : `${h}h${min}`;
}

// Suffixe "(annulé le 28/08)" ou "(annulé le 28/08 à 9h)" à coller après le
// titre d'une activité annulée — heure omise si non renseignée.
export function fmtAnnulationSuffix(dateStr: string | null, heure: string): string {
  const jjmm = fmtDDMM(dateStr);
  if (!jjmm) return "(annulé)";
  const h = fmtHeureCourte(heure);
  return h ? `(annulé le ${jjmm} à ${h})` : `(annulé le ${jjmm})`;
}
