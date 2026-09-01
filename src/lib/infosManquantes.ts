import { Client, Reservation } from "@/lib/types";
import { addDays, todayStr } from "@/lib/dates";

// Catégories d'infos manquantes déduites automatiquement des données déjà
// en base, plutôt que cochées à la main (ce qui pouvait rester coché après
// que l'info a été complétée, ou être oublié). Les libellés reprennent
// exactement ceux existants dans infos_manquantes_options pour rester
// cohérents avec les tags manuels déjà utilisés par l'équipe (sauf "Hôtel",
// qui n'existait pas encore dans la liste partagée).
export const INFO_MANQUANTE_AUTO_HOTEL = "Hôtel";
export const INFO_MANQUANTE_AUTO_CHAMBRE = "Room number";
export const INFO_MANQUANTE_AUTO_WHATSAPP = "Numéro WhatsApp";
export const INFO_MANQUANTE_AUTO_ACOMPTE = "Acompte PayPal";
export const INFO_MANQUANTE_AUTO_BILLET = "Billets d'avion";
export const INFO_MANQUANTE_AUTO_PASSEPORT = "Passeport";

export function infosManquantesAuto(client: Client, reservations: Reservation[]): string[] {
  const result: string[] = [];
  if (!client.hotel.trim()) result.push(INFO_MANQUANTE_AUTO_HOTEL);
  // Le numéro de chambre n'est quasiment jamais connu avant l'arrivée —
  // le signaler dès la création du dossier créerait une fausse alerte
  // permanente. Ne compte comme vraiment manquant qu'à la veille ou le
  // jour même de l'arrivée, quand il devient urgent de l'avoir.
  if (!client.chambre.trim() && client.date_debut && client.date_debut <= addDays(todayStr(), 1)) {
    result.push(INFO_MANQUANTE_AUTO_CHAMBRE);
  }
  if (!client.telephone.trim()) result.push(INFO_MANQUANTE_AUTO_WHATSAPP);
  // Signalé tant qu'aucun acompte n'est réglé — y compris avant que le mode
  // de paiement soit choisi (paiement_type vide au départ pour presque tous
  // les clients, donc l'exiger empêchait l'alerte de jamais apparaître).
  // Seul un paiement intégral explicitement choisi lève l'alerte.
  if (client.paiement_type !== "integral" && !client.acompte_paye) {
    result.push(INFO_MANQUANTE_AUTO_ACOMPTE);
  }
  if (reservations.some((r) => r.client_id === client.id && r.billet_requis && r.billet_etape !== "termine")) {
    result.push(INFO_MANQUANTE_AUTO_BILLET);
  }
  if (client.passeport_photos.length === 0) result.push(INFO_MANQUANTE_AUTO_PASSEPORT);
  return result;
}

// Fusionne les tags manuels (moins le sentinel "Complet") avec les tags
// auto-détectés, sans doublon — utilisé partout où on affiche/compte les
// infos manquantes d'un client (fiche client, tableau de bord).
export function infosManquantesToutes(client: Client, reservations: Reservation[]): string[] {
  const manuelles = client.infos_manquantes.filter((s) => s !== "Complet");
  const auto = infosManquantesAuto(client, reservations);
  return Array.from(new Set([...auto, ...manuelles]));
}
