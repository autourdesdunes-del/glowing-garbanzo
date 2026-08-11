// Étapes de la pipeline Prospects, calquées sur le pipeline Kommo (mêmes
// noms d'étape) pour que les deux restent lisibles côte à côte.
export const PROSPECT_STATUTS: string[] = [
  "Prospect",
  "À relancer",
  "Programme envoyé",
  "Demande d'infos envoyée",
];
export const CLIENT_STATUTS: string[] = ["Client confirmé", "Client perdu"];
export const STATUTS: string[] = [...PROSPECT_STATUTS, ...CLIENT_STATUTS];
export const CANAUX = ["Instagram", "WhatsApp", "TikTok", "Email", "Autre"] as const;
export const RELATIONS = [
  "Bouche à oreille",
  "Instagram",
  "TikTok",
  "Influenceurs",
  "Google",
  "Site internet",
  "Le Petit Futé",
  "Élodie Gossuin",
  "VIP Mélanie",
  "Agence de voyage",
  "TripAdvisor",
  "ChatGPT",
  "GetYourGuide",
  "Autre",
] as const;
// La liste des "infos manquantes" est maintenant partagée en base
// (table infos_manquantes_options) pour que le "+" d'une personne
// enrichisse le menu déroulant de toute l'équipe. Voir ContactStep.

export const MODES_PAIEMENT = [
  "PayPal",
  "Espèces EUR",
  "Espèces EGP",
  "Carte bleue",
  "Virement bancaire",
] as const;

export const BILLET_STATUTS = ["En attente", "Validé", "Refusé"] as const;

export const ASSIGNE_A_OPTIONS = ["Bode", "Sylvie", "Autre"] as const;

export const MOMENTS = ["Matin", "Après-midi", "Journée", "Plusieurs jours"] as const;
export const OPTIONS_PRESETS = ["Guide francophone", "Privatif", "Parachute", "Autre"] as const;
export const RAISONS_REMBOURSEMENT = [
  "Annulation",
  "Problème activité",
  "Dédommagement",
  "Autre",
] as const;

export const TYPE_MODIFICATION_OPTIONS = ["Tarif", "Horaire", "Programme", "Autre"] as const;

export const JOURS_SEMAINE = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export const GUIDE_OPTIONS = [
  "Aucun",
  "Guide francophone",
  "Guide anglophone",
  "Guide germanophone",
  "Guide russophone",
  "Autre",
] as const;

export const INCLUS_PRESETS = [
  "Transfert hôtel",
  "Repas du midi",
  "Boissons",
  "Eau",
  "Matériel snorkeling",
  "Équipement de plongée",
  "Entrées / droits d'accès",
  "Assurance",
  "Pourboires guide",
] as const;

export const DUREE_OPTIONS = ["2h/2h30", "Demi-journée", "Journée", "Plusieurs jours"] as const;

export const NON_INCLUS_PRESETS = [
  "Boissons alcoolisées",
  "Pourboires",
  "Dépenses personnelles",
  "Assurance annulation",
  "Transfert hôtel",
  "Location de matériel",
  "Photos / vidéos",
  "Déjeuner",
] as const;

export const A_PREVOIR_PRESETS = [
  "Maillot de bain",
  "Serviette",
  "Crème solaire",
  "Chaussures fermées",
  "Copie du passeport",
  "Espèces sur place",
  "Vêtements légers",
  "Casquette / chapeau",
] as const;

export const CATALOGUE_TAGS_PRESETS = [
  "Activités en mer",
  "Activités désert",
  "Culture",
  "Aventure",
  "Détente",
] as const;

// Champs additionnels que le Catalogue peut rendre obligatoires sur une
// réservation, selon le type d'activité (brief section réservations).
// Liste fermée : chaque valeur a un champ de saisie dédié dans
// ReservationCard, contrairement aux presets "inclus/non-inclus" qui
// acceptent du texte libre.
export const CHAMPS_REQUIS_PRESETS = [
  "Pointure",
  "Créneau (matin / après-midi / coucher de soleil)",
  "Conducteurs & passagers",
  "Vol & horaire",
] as const;

export const CRENEAUX_ACTIVITE = ["Matin", "Après-midi", "Coucher de soleil"] as const;

export const CATALOGUE_CATEGORIES = [
  "Excursion",
  "Transfert",
  "Séjour multi-jours",
  "Autre",
] as const;

export const STATUT_COLORS: Record<string, string> = {
  Prospect: "#8FB8F6",
  "À relancer": "#E8D96B",
  "Programme envoyé": "#F0C368",
  "Demande d'infos envoyée": "#F3B8BE",
  "Client confirmé": "#171717",
  "Client perdu": "#9CA3AF",
};
