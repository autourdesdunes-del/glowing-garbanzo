// Coordonnées affichées sur les flyers générés par le CRM (cf.
// CatalogueFlyer.tsx). Même numéro WhatsApp que celui utilisé pour les
// conversations client ailleurs dans l'app (ex. ClientPreviewView.tsx) —
// l'ancien numéro affiché sur les flyers Canva (+201157002473) est
// désormais obsolète (confirmé 2026-08-14).
export const AGENCY_CONTACT = {
  site: "autourdesduneshurghada.com",
  email: "autourdesdunes@gmail.com",
  whatsapp: "+201556221115",
  instagram: "autourdesduneshurghada",
};

// Étapes de la pipeline Prospects, calquées sur le pipeline Kommo (mêmes
// noms d'étape) pour que les deux restent lisibles côte à côte.
export const PROSPECT_STATUTS: string[] = [
  "Prospect",
  "À relancer",
  "Programme envoyé",
  "Demande d'infos envoyée",
];
export const CLIENT_STATUTS: string[] = ["Client confirmé", "Client perdu", "Client annulé"];
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

// Progression du billet d'avion, dans l'ordre réel du processus avec
// Hossam : acompte en attente -> acompte payé, demande à envoyer -> demande
// envoyée, en attente du billet -> billet reçu, à envoyer au client ->
// terminé. Une seule étape à la fois, jamais de cases indépendantes.
export const BILLET_ETAPES = [
  { key: "attente_acompte", label: "① Acompte en attente" },
  { key: "a_envoyer_hossam", label: "② Acompte payé — à envoyer à Hossam" },
  { key: "attente_hossam", label: "③ Envoyé à Hossam — en attente du billet" },
  { key: "a_envoyer_client", label: "④ Billet reçu — à envoyer au client" },
  { key: "termine", label: "⑤ Envoyé au client" },
] as const;

export const VILLES_VOL = [
  "Hurghada",
  "Le Caire",
  "Marsa Alam",
  "Louxor",
  "Assouan",
  "Charm el-Cheikh",
] as const;

export const ASSIGNE_A_OPTIONS = ["Bode", "Sylvie", "Autre"] as const;

// Email du compte Hossam (rôle Direction) — sert à distinguer, dans
// BilletRappels, les rappels billet d'avion qu'il reçoit (en anglais,
// "achetez le billet") de ceux que reçoit le reste de l'équipe (en
// français, "relancez Hossam"). À corriger une fois son compte créé si
// l'adresse réelle diffère.
export const HOSSAM_EMAIL = "neno_hossam@yahoo.com";

export const MOMENTS = ["Matin", "Après-midi", "Journée", "Plusieurs jours"] as const;
export const OPTIONS_PRESETS = ["Guide francophone", "Privatif", "Parachute", "2ème île", "Autre"] as const;
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

export const DUREE_OPTIONS = ["1h", "2h/2h30", "Demi-journée", "Journée", "Plusieurs jours"] as const;

// Pour un transfert, "Demi-journée"/"Journée" n'ont pas de sens et la durée
// n'est pas toujours pertinente à préciser — on autorise donc de ne rien
// mettre, en plus d'un sous-ensemble des durées courtes.
export const DUREE_OPTIONS_TRANSFERT = ["", "1h", "2h/2h30", "Plusieurs jours"] as const;

// Zones d'hôtel desservies par les transferts aéroport — le tarif d'un
// transfert dépend de la zone (plus ou moins loin de l'aéroport) ET du
// véhicule utilisé (voiture ou van selon le nombre de personnes), jamais
// d'un prix par personne unique.
export const ZONES_TRANSFERT = [
  "Hurghada",
  "Sahl Hasheesh",
  "Makadi",
  "El Gouna",
  "Safaga",
  "Louxor",
  "Assouan",
  "Le Caire",
  "Marsa Alam",
  "Autre",
] as const;

export const VEHICULES_TRANSFERT = ["Voiture (jusqu'à 3 pers.)", "Van (4 pers. et +)"] as const;

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
  "Site visité au Caire (musée / Saqqarah / citadelle / Grand Egyptian Museum)",
] as const;

export const CRENEAUX_ACTIVITE = ["Matin", "Après-midi", "Coucher de soleil"] as const;

// Choix impératif du site visité pour les activités Le Caire (musée,
// Saqqarah, citadelle, ou le nouveau Grand Egyptian Museum, qui applique un
// supplément — voir GRAND_EGYPTIAN_MUSEUM_SUPPLEMENT dans resa.ts).
export const SITES_CAIRE = [
  "Musée du Caire (ancien musée)",
  "Saqqarah",
  "Citadelle Mohamed Ali",
  "Grand Egyptian Museum (nouveau musée)",
] as const;

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
  "Client confirmé": "#059669",
  "Client perdu": "#9CA3AF",
  "Client annulé": "#C4453A",
};

// Options de règle d'annulation par activité (Catalogue) — voir
// resa.ts:reglementAnnulation pour le calcul remboursable/non remboursable
// qui en découle.
export const REGLES_ANNULATION = [
  { key: "hurghada_24h", label: "Hurghada — remboursable jusqu'à 24h avant" },
  { key: "culturelle_48h", label: "Excursion culturelle (hors Hurghada) — 48h avant" },
  { key: "siwa_desert_10j", label: "Siwa / Désert Blanc — 10 jours avant" },
  { key: "non_remboursable", label: "Non remboursable (billet d'avion, croisière, hôtel...)" },
] as const;

export const RAISONS_ANNULATION = [
  "Météo",
  "Client ne veut plus",
  "Changement de programme",
  "Non-présentation",
  "Autre",
] as const;
