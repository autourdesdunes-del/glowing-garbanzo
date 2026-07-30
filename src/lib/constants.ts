export const STATUTS = ["Prospect", "En négociation", "Client confirmé", "Perdu"] as const;
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
export const INFOS_MANQUANTES_OPTIONS = [
  "Room number",
  "Date de RDV",
  "Numéro WhatsApp",
  "Billets d'avion",
  "Passeport",
  "Acompte PayPal",
  "Localisation",
  "Ticket de train",
  "Autre",
] as const;

export const MODES_PAIEMENT = [
  "PayPal",
  "Espèces EUR",
  "Espèces EGP",
  "Carte bleue",
  "Virement bancaire",
] as const;

export const BILLET_STATUTS = ["En attente", "Validé", "Refusé"] as const;

export const MOMENTS = ["Matin", "Après-midi", "Journée", "Plusieurs jours"] as const;
export const OPTIONS_PRESETS = ["Guide francophone", "Privatif", "Autre"] as const;
export const RAISONS_REMBOURSEMENT = [
  "Annulation",
  "Problème activité",
  "Dédommagement",
  "Autre",
] as const;

export const CATALOGUE_CATEGORIES = [
  "Excursion",
  "Transfert",
  "Séjour multi-jours",
  "Autre",
] as const;

export const STATUT_COLORS: Record<string, string> = {
  Prospect: "#8B4531",
  "En négociation": "#C9973E",
  "Client confirmé": "#5C2A1D",
  Perdu: "#9CA3AF",
};
