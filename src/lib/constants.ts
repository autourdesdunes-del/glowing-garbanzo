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

export const STATUT_COLORS: Record<string, string> = {
  Prospect: "#8B4531",
  "En négociation": "#C9973E",
  "Client confirmé": "#0F5C56",
  Perdu: "#9CA3AF",
};
