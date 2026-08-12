import { Reservation } from "@/lib/types";
import { localDateStr } from "@/lib/dates";

// Calcule la clé du palier de rappel dû "maintenant" pour un billet d'avion
// pas encore acheté (billet_etape === "attente_hossam"), à comparer au
// dernier palier déjà affiché (stocké en localStorage côté composant — pas
// en base, chaque appareil a son propre historique de rappels vus, comme
// AppelReminders). Paliers : 30/21/14/10/7 jours avant, puis deux fois par
// jour (matin/après-midi) pendant la dernière semaine. Retourne null si
// aucun rappel n'est dû.
export function billetRappelDueKey(
  r: Reservation,
  lastShownKey: string | null,
  now: Date
): string | null {
  if (r.billet_etape !== "attente_hossam" || !r.billet_date) return null;

  // Jamais vu sur cet appareil : le tout premier rappel ("le dépôt vient
  // d'être versé, pensez au billet") est dû immédiatement, quelle que soit
  // la date du vol.
  if (!lastShownKey) return "initial";

  const joursAvant = Math.floor(
    (Date.parse(r.billet_date + "T00:00:00") - Date.parse(localDateStr(now) + "T00:00:00")) / 86400000
  );
  if (joursAvant < 0) return null; // date de vol passée, plus de rappel

  let windowKey: string | null;
  if (joursAvant >= 30) windowKey = "j30";
  else if (joursAvant >= 21) windowKey = "j21";
  else if (joursAvant >= 14) windowKey = "j14";
  else if (joursAvant >= 10) windowKey = "j10";
  else if (joursAvant >= 7) windowKey = "j7";
  else {
    const half = now.getHours() < 14 ? "am" : "pm";
    windowKey = `${localDateStr(now)}-${half}`;
  }

  return windowKey !== lastShownKey ? windowKey : null;
}
