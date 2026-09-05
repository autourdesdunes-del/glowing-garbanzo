import { Client, ClientHotel, HotelReference, Reservation } from "@/lib/types";
import { addDays, todayStr } from "@/lib/dates";
import { matchHotel } from "@/lib/hotelHelp";
import { senseTransfertAeroport } from "@/lib/resa";

// Le numéro de chambre n'a de sens à demander que pour un hôtel situé à
// Hurghada ou dans sa région (transferts courts, l'équipe locale y va
// facilement) — ailleurs (Caire, Louxor, Siwa, Alexandrie, Assouan...), ce
// n'est jamais l'agence qui gère le logement sur place, donc jamais utile.
const VILLES_CHAMBRE_NON_REQUISE = ["Le Caire", "Louxor", "Siwa", "Alexandrie", "Assouan"];

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
export const INFO_MANQUANTE_AUTO_VOL_TRANSFERT = "Flight ticket info";

export function infosManquantesAuto(
  client: Client,
  reservations: Reservation[],
  hotelsRef: HotelReference[] = [],
  // Circuit multi-hôtels (table client_hotels) — quand il existe, le champ
  // client.hotel (simple, un seul hôtel) reste vide par design, il ne faut
  // donc pas le signaler comme manquant tant qu'un circuit est renseigné.
  clientHotels: ClientHotel[] = []
): string[] {
  const result: string[] = [];
  if (!client.hotel.trim() && clientHotels.length === 0) result.push(INFO_MANQUANTE_AUTO_HOTEL);
  // Le numéro de chambre n'est quasiment jamais connu avant l'arrivée —
  // le signaler dès la création du dossier créerait une fausse alerte
  // permanente. Ne compte comme vraiment manquant qu'à la veille ou le
  // jour même de l'arrivée, quand il devient urgent de l'avoir — et
  // seulement pour un hôtel à Hurghada/région (voir VILLES_CHAMBRE_NON_REQUISE).
  const hotelMatch = matchHotel(client.hotel, hotelsRef);
  const chambreRequisePourCetteVille = !hotelMatch || !VILLES_CHAMBRE_NON_REQUISE.includes(hotelMatch.ville);
  if (
    chambreRequisePourCetteVille &&
    !client.chambre.trim() &&
    client.date_debut &&
    client.date_debut <= addDays(todayStr(), 1)
  ) {
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
  // Un transfert aéroport sans numéro de vol ni horaire ne peut pas être
  // organisé côté équipe Égypte — signalé tant que l'un des deux manque,
  // pour toute réservation active de ce type (le sens du transfert suffit
  // à le détecter, pas besoin de savoir si l'item catalogue l'exige).
  if (
    reservations.some(
      (r) =>
        r.client_id === client.id &&
        r.statut_resa !== "Annulée" &&
        senseTransfertAeroport(r.nom_activite) &&
        (!r.numero_vol.trim() || !r.horaire_vol.trim())
    )
  ) {
    result.push(INFO_MANQUANTE_AUTO_VOL_TRANSFERT);
  }
  return result;
}

// Une info manquante cochée à la main reste cochée tant que personne ne va
// la décocher — si son libellé correspond à une catégorie qu'on sait aussi
// détecter automatiquement, et que la donnée réelle montre que ce n'est
// plus manquant, on ne veut pas qu'elle reste affichée indéfiniment (ex.
// "Room number" coché avant que le numéro soit connu, jamais décoché une
// fois rempli).
const MANUEL_RESOLU: Record<string, (client: Client) => boolean> = {
  [INFO_MANQUANTE_AUTO_HOTEL]: (c) => !!c.hotel.trim(),
  [INFO_MANQUANTE_AUTO_CHAMBRE]: (c) => !!c.chambre.trim(),
  [INFO_MANQUANTE_AUTO_WHATSAPP]: (c) => !!c.telephone.trim(),
  [INFO_MANQUANTE_AUTO_ACOMPTE]: (c) => c.paiement_type === "integral" || c.acompte_paye,
  [INFO_MANQUANTE_AUTO_PASSEPORT]: (c) => c.passeport_photos.length > 0,
};

// Fusionne les tags manuels (moins le sentinel "Complet") avec les tags
// auto-détectés, sans doublon — utilisé partout où on affiche/compte les
// infos manquantes d'un client (fiche client, tableau de bord).
export function infosManquantesToutes(
  client: Client,
  reservations: Reservation[],
  hotelsRef: HotelReference[] = [],
  clientHotels: ClientHotel[] = []
): string[] {
  const manuelles = client.infos_manquantes.filter((s) => {
    if (s === "Complet") return false;
    if (s === INFO_MANQUANTE_AUTO_HOTEL && clientHotels.length > 0) return false;
    const estResolu = MANUEL_RESOLU[s];
    return !estResolu || !estResolu(client);
  });
  const auto = infosManquantesAuto(client, reservations, hotelsRef, clientHotels);
  return Array.from(new Set([...auto, ...manuelles]));
}
