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
