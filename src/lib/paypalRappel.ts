import { PaypalPaiement } from "@/lib/types";

// Calcule la clé du palier de rappel "paiement PayPal à rattacher" dû
// "maintenant", à comparer au dernier palier déjà affiché (localStorage
// côté composant, même convention que billetEnvoiRappel.ts) — premier
// rappel dans l'heure qui suit la réception, puis toutes les 3h tant que
// le paiement n'a pas été rattaché à un client.
export function paypalRappelDueKey(p: PaypalPaiement, lastShownKey: string | null, now: Date): string | null {
  if (p.rattache_client_id) return null;

  const heuresEcoulees = (now.getTime() - Date.parse(p.paypal_recu_le)) / 3600000;
  if (heuresEcoulees < 0) return null;

  const windowKey = heuresEcoulees < 1 ? "initial" : `relance-${Math.floor((heuresEcoulees - 1) / 3)}`;

  return windowKey !== lastShownKey ? windowKey : null;
}
