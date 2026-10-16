import { Client, PaiementEtape, Remboursement, Reservation } from "@/lib/types";

// Dernière modification pertinente du dossier (fiche client, réservations,
// remboursements, étapes de paiement) — utilisé pour savoir si un dossier
// déjà vérifié doit repasser par "à vérifier" (une vérification plus
// ancienne que la dernière modification n'est plus fiable).
export function dernierChangementDossier(
  client: Client,
  reservations: Reservation[],
  remboursements: Remboursement[],
  paiementsEtapes: PaiementEtape[]
): string {
  const dates = [
    client.updated_at,
    ...reservations.filter((r) => r.client_id === client.id).map((r) => r.updated_at),
    ...remboursements.filter((r) => r.client_id === client.id).map((r) => r.created_at),
    ...paiementsEtapes.filter((e) => e.client_id === client.id).map((e) => e.created_at),
  ].filter((d): d is string => !!d);
  return dates.reduce((max, d) => (d > max ? d : max), client.created_at);
}
