import {
  CatalogueItem,
  Client,
  PaiementEtape,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { findDuplicateClients } from "@/lib/duplicates";
import { euros } from "@/lib/suivisFormat";
import {
  billetRequisEffectif,
  findMomentConflict,
  missingChampsFor,
  paiementProgress,
  reservationsActives,
} from "@/lib/resa";

// Moteur de détection d'erreurs pour l'outil "Vérification de dossier"
// (Suivis) — chaque règle est une fonction pure, jamais stockée en base
// (toujours recalculée à la volée à partir des données réelles), pour
// qu'une erreur corrigée ailleurs dans le CRM disparaisse d'elle-même ici
// sans action supplémentaire. Conçu pour grandir au fil du temps : ajouter
// une règle = ajouter un bloc ci-dessous avec un nouveau code stable.
export type DossierErreur = {
  code: string;
  categorie: "Programme" | "Paiement" | "Remboursement" | "Documents" | "Doublon";
  message: string;
};

export function erreursDossier(
  client: Client,
  reservations: Reservation[],
  remboursements: Remboursement[],
  catalogue: CatalogueItem[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  paiementsEtapes: PaiementEtape[],
  allClients: Client[]
): DossierErreur[] {
  const erreurs: DossierErreur[] = [];
  const resasClient = reservationsActives(reservations).filter((r) => r.client_id === client.id);

  // --- Programme : deux activités au même moment le même jour -----------
  // Un conflit est symétrique (A en conflit avec B = B en conflit avec A) —
  // on ne garde qu'une seule erreur par paire, jamais une par activité.
  const dejaSignale = new Set<string>();
  for (const r of resasClient) {
    const conflit = findMomentConflict(reservations, r.id);
    if (!conflit) continue;
    const paire = [r.id, conflit.id].sort().join("_");
    if (dejaSignale.has(paire)) continue;
    dejaSignale.add(paire);
    erreurs.push({
      code: "programme_conflit",
      categorie: "Programme",
      message: `« ${r.nom_activite} » et « ${conflit.nom_activite} » sont prévues le même jour (${r.date_debut}) sur le même créneau.`,
    });
  }

  // --- Programme : champs spécifiques à l'activité manquants ------------
  // Réutilise exactement la règle déjà appliquée pour "Activités en attente
  // de validation" (pointure, île, créneau, vol & horaire...).
  for (const r of resasClient) {
    const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
    const manquants = missingChampsFor(r, catalogueItem);
    manquants.forEach((champ) => {
      erreurs.push({
        code: "champ_manquant",
        categorie: "Programme",
        message: `« ${r.nom_activite} » : ${champ} manquant.`,
      });
    });
  }

  // --- Documents : billet d'avion / vol / passeport ----------------------
  if (resasClient.some((r) => billetRequisEffectif(r) && r.billet_etape !== "termine")) {
    erreurs.push({
      code: "billet_avion_manquant",
      categorie: "Documents",
      message: "Billet d'avion pas encore reçu/envoyé alors qu'il est requis.",
    });
  }
  if (client.passeport_photos.length === 0) {
    erreurs.push({
      code: "passeport_manquant",
      categorie: "Documents",
      message: "Aucune photo de passeport dans le dossier.",
    });
  }

  // --- Paiement : reste à payer non nul -----------------------------------
  // paiementProgress attend des listes déjà filtrées sur CE client (comme
  // partout ailleurs dans le CRM, ex. AppShell.tsx avant ClientDetail) —
  // sans ce filtre, reservations/paiementsEtapes contiennent tous les
  // clients et totalSejour explose (vécu : "reste à payer" à 200 000€+).
  const resaEtapesClient = paiementsEtapes.filter((e) => e.client_id === client.id);
  const progress = paiementProgress(client, reservations.filter((r) => r.client_id === client.id), resaOptions, resaTarifs, resaEtapesClient);
  if (progress.reste > 0.5) {
    erreurs.push({
      code: "reste_a_payer",
      categorie: "Paiement",
      message: `Reste à payer détecté : ${euros(progress.reste)} — vérifier si c'est normal (séjour pas encore réglé) ou un oubli.`,
    });
  }

  // --- Remboursements : champs mal renseignés -----------------------------
  const remboursementsClient = remboursements.filter((r) => r.client_id === client.id);
  for (const r of remboursementsClient) {
    const raisonLabel = r.raison === "Autre" ? r.raison_autre : r.raison;
    const identifiant = r.date_remboursement || r.date_probleme || "date inconnue";
    if (!(Number(r.montant) > 0)) {
      erreurs.push({
        code: "remboursement_montant_manquant",
        categorie: "Remboursement",
        message: `Remboursement (${identifiant}) : montant manquant ou à 0€.`,
      });
    }
    if (!raisonLabel || !raisonLabel.trim()) {
      erreurs.push({
        code: "remboursement_raison_manquante",
        categorie: "Remboursement",
        message: `Remboursement (${identifiant}) : raison manquante.`,
      });
    }
    if (!r.mode.trim()) {
      erreurs.push({
        code: "remboursement_mode_manquant",
        categorie: "Remboursement",
        message: `Remboursement (${identifiant}) : mode de règlement manquant.`,
      });
    }
    // Toujours en PayPal quel que soit le mode de paiement d'origine (règle
    // Mélanie) — l'adresse doit donc toujours être renseignée sur CHAQUE
    // remboursement, pas seulement récupérée une fois sur le client.
    if (!r.paypal_email.trim()) {
      erreurs.push({
        code: "remboursement_paypal_manquant",
        categorie: "Remboursement",
        message: `Remboursement (${identifiant}) : adresse PayPal manquante (les remboursements partent toujours en PayPal).`,
      });
    }
    if (r.statut === "Effectué" && !r.preuve_photo_path) {
      erreurs.push({
        code: "remboursement_preuve_manquante",
        categorie: "Remboursement",
        message: `Remboursement (${identifiant}) : marqué "Effectué" sans preuve jointe.`,
      });
    }
  }

  // --- Doublon -------------------------------------------------------------
  const doublons = findDuplicateClients(client, allClients, client.id);
  doublons.forEach((d) => {
    erreurs.push({
      code: "doublon_client",
      categorie: "Doublon",
      message: `Dossier potentiellement en double avec « ${d.client.nom} » (${d.reasons.join(", ")}).`,
    });
  });

  return erreurs;
}

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
