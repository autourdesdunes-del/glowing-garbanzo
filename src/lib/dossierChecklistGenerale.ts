// Checklist générale de l'outil "Vérification de dossier" (Suivis) — une
// liste FIXE de points à cocher à la main, choisie par Mélanie
// (2026-10-16) : "je veux une vraie check liste à gauche avec des trucs à
// cocher, une check liste générale, pas ce que le CRM détecte". Ne
// remplace pas dossierChecklist.ts (toujours utilisé pour le résumé
// affiché sur les cartes de la liste "Dossiers à vérifier"), mais sert de
// contenu au panneau latéral (VerifDossierDrawer).
export type DossierChecklistCategorie =
  | "Contact"
  | "Séjour"
  | "Activités"
  | "Info manquantes"
  | "Paiements"
  | "Documents"
  | "Suivi";

export type DossierChecklistItem = {
  code: string;
  categorie: DossierChecklistCategorie;
  texte: string;
};

export const DOSSIER_CHECKLIST_GENERALE: DossierChecklistItem[] = [
  { code: "contact_moyen", categorie: "Contact", texte: "WhatsApp / moyen de contact correct et actif" },
  { code: "contact_voyageurs", categorie: "Contact", texte: "Nombre de voyageurs correct" },

  { code: "sejour_dates", categorie: "Séjour", texte: "Dates du séjour correctes (arrivée / départ)" },
  { code: "sejour_hotel", categorie: "Séjour", texte: "Hôtel renseigné et correct" },
  { code: "sejour_chambre", categorie: "Séjour", texte: "Numéro de chambre renseigné (si séjour commencé)" },
  { code: "sejour_taxe_transfert", categorie: "Séjour", texte: "Taxe de transfert correcte (absente si ville exclue)" },

  { code: "activites_dates", categorie: "Activités", texte: "Dates correctes, correspondent avec le programme envoyé" },
  { code: "activites_total_pax", categorie: "Activités", texte: "Total de chaque activité correspondant au nombre de personnes" },
  { code: "activites_descriptif", categorie: "Activités", texte: "Descriptif de l'explication du montant cohérent dans la description" },
  { code: "activites_pax", categorie: "Activités", texte: "PAX (adultes/enfants) correct pour chaque activité, ou override cohérent si rempli" },
  { code: "activites_programme_jour", categorie: "Activités", texte: "Journées à plusieurs activités : programme cohérent (pas de chevauchement horaire)" },

  { code: "info_pointure_tortues", categorie: "Info manquantes", texte: "Pointure si Tortues à Marsa Alam" },
  { code: "info_horaire_avion", categorie: "Info manquantes", texte: "Horaire billets d'avion" },
  { code: "info_matin_aprem", categorie: "Info manquantes", texte: "Matin/aprem pour les activités de demi-journée" },
  { code: "info_horaire_spa", categorie: "Info manquantes", texte: "Horaire pour le spa" },
  { code: "info_visites_caire", categorie: "Info manquantes", texte: "Choix des visites (si Le Caire)" },
  { code: "info_programme_sur_mesure", categorie: "Info manquantes", texte: "Programme bien détaillé pour activités/programmes complexes sur mesure" },
  { code: "info_billet_avion", categorie: "Info manquantes", texte: "Billet d'avion reçu/envoyé si requis" },

  { code: "paiement_total", categorie: "Paiements", texte: "Total du séjour cohérent avec les activités réservées" },
  { code: "paiement_acompte", categorie: "Paiements", texte: "Acompte(s) encaissé(s) correspondent au CRM — vérifier avec le montant dans la conversation client" },
  { code: "paiement_solde", categorie: "Paiements", texte: "Solde unique bien rattaché à une activité (date, lieu, mode)" },
  { code: "paiement_reste", categorie: "Paiements", texte: "Reste à payer cohérent" },

  { code: "documents_passeport", categorie: "Documents", texte: "Photos du passeport présentes" },

  { code: "suivi_remboursement", categorie: "Suivi", texte: "Remboursement ou avoir correspondant et justifié" },
  { code: "suivi_paypal", categorie: "Suivi", texte: "Adresse PayPal renseignée" },
  { code: "suivi_doublon", categorie: "Suivi", texte: "Pas de dossier en double pour ce client" },
];
