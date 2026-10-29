import { CatalogueItem, Remboursement, Reservation } from "@/lib/types";
import { billetRequisEffectif, needsMomentSpeedboat, reservationsActives } from "@/lib/resa";
import { isSpaMassage } from "@/lib/addActivityWizardHelpers";
import { CHAMP_SITE_VISITE_CAIRE } from "@/lib/constants";

// Checklist générale de l'outil "Vérification de dossier" (Suivis) — une
// liste FIXE de points à cocher à la main, choisie par Mélanie
// (2026-10-16) : "je veux une vraie check liste à gauche avec des trucs à
// cocher, une check liste générale, pas ce que le CRM détecte". Ne
// remplace pas dossierChecklist.ts (toujours utilisé pour le résumé
// affiché sur les cartes de la liste "Dossiers à vérifier"), mais sert de
// contenu au panneau latéral (VerifDossierDrawer).
//
// Certains items ne concernent qu'un type d'activité précis (pointure
// Tortues, horaire spa...) — `condition`, quand renseigné, décide si
// l'item a sa place dans LA checklist DE CE client, à partir de ses
// réservations actives. Pas de détection de "déjà rempli" ici (toujours
// coché à la main) — seulement "est-ce que ça concerne ce dossier"
// (demande de Mélanie, 2026-10-29).
export type DossierChecklistCategorie =
  | "Contact"
  | "Séjour"
  | "Activités"
  | "Info manquantes"
  | "Paiements"
  | "Documents"
  | "Suivi";

export type DossierChecklistContext = {
  reservations: Reservation[];
  catalogue: CatalogueItem[];
  remboursements: Remboursement[];
};

export type DossierChecklistItem = {
  code: string;
  categorie: DossierChecklistCategorie;
  texte: string;
  condition?: (ctx: DossierChecklistContext) => boolean;
};

function catalogueItemFor(r: Reservation, catalogue: CatalogueItem[]) {
  return r.catalogue_item_id ? catalogue.find((a) => a.id === r.catalogue_item_id) : undefined;
}

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

  {
    code: "info_pointure_tortues",
    categorie: "Info manquantes",
    texte: "Pointure si Tortues à Marsa Alam",
    condition: ({ reservations }) =>
      reservationsActives(reservations).some((r) => /tortues/i.test(r.nom_activite || "")),
  },
  {
    code: "info_horaire_avion",
    categorie: "Info manquantes",
    texte: "Horaire billets d'avion",
    condition: ({ reservations }) => reservationsActives(reservations).some((r) => billetRequisEffectif(r)),
  },
  {
    code: "info_matin_aprem",
    categorie: "Info manquantes",
    texte: "Matin/aprem pour les activités de demi-journée",
    condition: ({ reservations, catalogue }) =>
      reservationsActives(reservations).some((r) =>
        needsMomentSpeedboat(catalogueItemFor(r, catalogue)?.nom || r.nom_activite || "")
      ),
  },
  {
    code: "info_horaire_spa",
    categorie: "Info manquantes",
    texte: "Horaire pour le spa",
    condition: ({ reservations }) =>
      reservationsActives(reservations).some((r) => isSpaMassage(r.nom_activite || "")),
  },
  {
    code: "info_visites_caire",
    categorie: "Info manquantes",
    texte: "Choix des visites (si Le Caire)",
    condition: ({ reservations, catalogue }) =>
      reservationsActives(reservations).some((r) => {
        const item = catalogueItemFor(r, catalogue);
        if (item) return (item.champs_requis_liste || []).includes(CHAMP_SITE_VISITE_CAIRE);
        return /caire/i.test(r.nom_activite || "");
      }),
  },
  { code: "info_programme_sur_mesure", categorie: "Info manquantes", texte: "Programme bien détaillé pour activités/programmes complexes sur mesure" },
  {
    code: "info_billet_avion",
    categorie: "Info manquantes",
    texte: "Billet d'avion reçu/envoyé si requis",
    condition: ({ reservations }) => reservationsActives(reservations).some((r) => billetRequisEffectif(r)),
  },

  { code: "paiement_total", categorie: "Paiements", texte: "Total du séjour cohérent avec les activités réservées" },
  { code: "paiement_acompte", categorie: "Paiements", texte: "Acompte(s) encaissé(s) correspondent au CRM — vérifier avec le montant dans la conversation client" },
  { code: "paiement_solde", categorie: "Paiements", texte: "Solde unique bien rattaché à une activité (date, lieu, mode)" },
  { code: "paiement_reste", categorie: "Paiements", texte: "Reste à payer cohérent" },

  { code: "documents_passeport", categorie: "Documents", texte: "Photos du passeport présentes" },

  {
    code: "suivi_remboursement",
    categorie: "Suivi",
    texte: "Remboursement ou avoir correspondant et justifié",
    // Raw `reservations` (pas reservationsActives, qui exclut justement les
    // annulées) : cet item ne concerne que les dossiers avec une activité
    // annulée.
    condition: ({ reservations }) => reservations.some((r) => r.statut_resa === "Annulée"),
  },
  {
    code: "suivi_paypal",
    categorie: "Suivi",
    texte: "Adresse PayPal renseignée",
    condition: ({ remboursements }) => remboursements.length > 0,
  },
  { code: "suivi_doublon", categorie: "Suivi", texte: "Pas de dossier en double pour ce client" },
];
