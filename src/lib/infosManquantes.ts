import { Client, ClientHotel, HotelReference, Reservation } from "@/lib/types";
import { addDays, todayStr } from "@/lib/dates";
import { matchHotel } from "@/lib/hotelHelp";
import { billetRequisEffectif, senseTransfertAeroport } from "@/lib/resa";

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
export const INFO_MANQUANTE_AUTO_RELATION = "Relation grâce à";

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
  // Le numéro de chambre se demande à J-1 de la toute première activité du
  // client, pas de son arrivée à l'hôtel (client.date_debut) — même règle
  // que Suivis > Numéros de chambre (SuivisView.tsx) et le badge du
  // tableau de bord (DashboardView.tsx). Avant ce correctif, cette
  // fonction-ci utilisait encore client.date_debut : un client pouvait donc
  // être signalé "Room number manquant" ici (Dossiers incomplets, File
  // d'attente prioritaire) alors qu'il n'apparaissait jamais dans la liste
  // réelle Suivis > Numéros de chambre, ni dans son badge — 3 règles
  // différentes pour la même chose (Mélanie, 2026-09-19).
  const premiereActiviteDate = reservations
    .filter((r) => r.client_id === client.id && r.date_debut && r.statut_resa !== "Annulée")
    .reduce((min: string | null, r) => (!min || (r.date_debut as string) < min ? r.date_debut : min), null);
  // Le numéro de chambre n'est quasiment jamais connu avant l'arrivée —
  // le signaler dès la création du dossier créerait une fausse alerte
  // permanente. Ne compte comme vraiment manquant qu'à la veille ou le
  // jour même de la première activité, quand il devient urgent de l'avoir —
  // et seulement pour un hôtel à Hurghada/région (voir VILLES_CHAMBRE_NON_REQUISE).
  if (clientHotels.length > 0) {
    // Circuit multi-hôtels : client.hotel/client.chambre restent vides par
    // design (voir plus haut) — sans ce cas à part, chaque étape retombait
    // sur matchHotel("", ...) => null => "chambre requise", et le numéro
    // renseigné par étape (client_hotels.chambre) n'était jamais regardé,
    // signalant "Room number" manquant en permanence dès qu'un circuit
    // était en place, même une fois tout renseigné.
    const seuil = addDays(todayStr(), 1);
    const etapeSansChambre = clientHotels.some(
      (h) =>
        !VILLES_CHAMBRE_NON_REQUISE.some((v) => v.trim().toLowerCase() === h.ville.trim().toLowerCase()) &&
        !h.chambre.trim() &&
        h.date_arrivee &&
        h.date_arrivee <= seuil
    );
    if (etapeSansChambre) result.push(INFO_MANQUANTE_AUTO_CHAMBRE);
  } else {
    const hotelMatch = matchHotel(client.hotel, hotelsRef);
    const chambreRequisePourCetteVille = !hotelMatch || !VILLES_CHAMBRE_NON_REQUISE.includes(hotelMatch.ville);
    // Pour un Airbnb, le numéro de chambre n'existe pas — c'est le numéro
    // d'appartement (airbnb_appartement) qui joue ce rôle. Sans ce cas
    // particulier, "Room number" restait signalé manquant indéfiniment dès
    // qu'un client passait en Airbnb, même une fois l'appartement renseigné.
    const numeroLogementRempli =
      client.type_hebergement === "airbnb" ? !!client.airbnb_appartement.trim() : !!client.chambre.trim();
    if (
      chambreRequisePourCetteVille &&
      !numeroLogementRempli &&
      premiereActiviteDate &&
      premiereActiviteDate <= addDays(todayStr(), 1)
    ) {
      result.push(INFO_MANQUANTE_AUTO_CHAMBRE);
    }
  }
  if (!client.telephone.trim()) result.push(INFO_MANQUANTE_AUTO_WHATSAPP);
  // Signalé tant qu'aucun acompte n'est réglé — y compris avant que le mode
  // de paiement soit choisi (paiement_type vide au départ pour presque tous
  // les clients, donc l'exiger empêchait l'alerte de jamais apparaître).
  // Seul un paiement intégral explicitement choisi lève l'alerte.
  if (client.paiement_type !== "integral" && !client.acompte_paye) {
    result.push(INFO_MANQUANTE_AUTO_ACOMPTE);
  }
  // Une activité annulée après coup gardait billet_requis à true et
  // continuait de marquer le dossier "incomplet" indéfiniment (voir le même
  // correctif dans SuivisView.tsx > onglet Billets d'avion).
  if (
    reservations.some(
      (r) =>
        r.client_id === client.id &&
        r.statut_resa !== "Annulée" &&
        billetRequisEffectif(r) &&
        r.billet_etape !== "termine"
    )
  ) {
    result.push(INFO_MANQUANTE_AUTO_BILLET);
  }
  if (client.passeport_photos.length === 0) result.push(INFO_MANQUANTE_AUTO_PASSEPORT);
  // Jamais deviné/laissé à une valeur par défaut (voir EMPTY_CLIENT dans
  // types.ts) — une employée qui oublie de le renseigner fausserait les
  // statistiques d'acquisition pour tout le monde plutôt que de simplement
  // laisser un dossier incomplet, visible et corrigible.
  if (!client.relation_grace_a.trim()) result.push(INFO_MANQUANTE_AUTO_RELATION);
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
  [INFO_MANQUANTE_AUTO_CHAMBRE]: (c) =>
    c.type_hebergement === "airbnb" ? !!c.airbnb_appartement.trim() : !!c.chambre.trim(),
  [INFO_MANQUANTE_AUTO_WHATSAPP]: (c) => !!c.telephone.trim(),
  [INFO_MANQUANTE_AUTO_ACOMPTE]: (c) => c.paiement_type === "integral" || c.acompte_paye,
  [INFO_MANQUANTE_AUTO_PASSEPORT]: (c) => c.passeport_photos.length > 0,
  [INFO_MANQUANTE_AUTO_RELATION]: (c) => !!c.relation_grace_a.trim(),
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
