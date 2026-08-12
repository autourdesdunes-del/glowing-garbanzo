import { Reservation } from "@/lib/types";

// Calcule la clé du palier de rappel "billet reçu, pensez à l'envoyer au
// client" dû "maintenant", à comparer au dernier palier déjà affiché
// (localStorage côté composant, même convention que billetRappel.ts).
// Contrairement aux rappels "pas encore acheté" (paliers calés sur des
// jours calendaires), ceux-ci sont calés sur des heures écoulées depuis la
// réception du billet (billet_recu_le) : premier rappel dans l'heure qui
// suit, puis toutes les 3h tant que le billet n'est pas marqué envoyé.
export function billetEnvoiRappelDueKey(
  r: Reservation,
  lastShownKey: string | null,
  now: Date
): string | null {
  if (r.billet_etape !== "a_envoyer_client" || !r.billet_recu_le) return null;

  const heuresEcoulees = (now.getTime() - Date.parse(r.billet_recu_le)) / 3600000;
  if (heuresEcoulees < 0) return null;

  const windowKey = heuresEcoulees < 1 ? "initial" : `relance-${Math.floor((heuresEcoulees - 1) / 3)}`;

  return windowKey !== lastShownKey ? windowKey : null;
}
