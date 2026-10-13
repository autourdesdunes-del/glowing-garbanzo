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
  missingChampsFor,
  momentDeLaJournee,
  paiementProgress,
  participantsFor,
  paxLine,
  reservationsActives,
  resaTotalMontant,
} from "@/lib/resa";

// Checklist pour l'outil "Vérification de dossier" (Suivis) — INVITE à
// vérifier une liste de points (montants, programme, documents...) sans
// jamais prétendre savoir ce qui est juste ou faux : pas de verdict
// vert/rouge, juste les faits bruts à relire (demande explicite de
// Mélanie, 2026-10-13 : "je veux pas que le crm détecte si y a une
// faute"). Toujours recalculé à la volée, jamais stocké.
export type DossierCheckItem = {
  code: string;
  categorie: "Paiement" | "Programme" | "Documents" | "Remboursement" | "Doublon";
  message: string;
  // Présent pour un point lié à une activité précise — permet de sauter
  // directement dessus plutôt que de rouvrir toute la fiche.
  reservationId?: string;
};

// Champs qu'une activité comme "City tour Hurghada — Après-midi" ou "City
// Tour – El Gouna — Matin" porte déjà dans son propre titre (catalogue
// séparé par créneau) — les redemander ici n'apporterait rien, la réponse
// est déjà sous les yeux (retour de Mélanie, 2026-10-13).
const CHAMPS_DEJA_DANS_LE_TITRE = ["Moment (matin / après-midi)", "Créneau"];

export function pointsAVerifier(
  client: Client,
  reservations: Reservation[],
  remboursements: Remboursement[],
  catalogue: CatalogueItem[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  paiementsEtapes: PaiementEtape[],
  allClients: Client[]
): DossierCheckItem[] {
  const items: DossierCheckItem[] = [];
  const resasClient = reservationsActives(reservations).filter((r) => r.client_id === client.id);
  // paiementProgress attend des listes déjà filtrées sur CE client (comme
  // partout ailleurs dans le CRM) — sinon le total explose en sommant tous
  // les clients.
  const reservationsClientToutes = reservations.filter((r) => r.client_id === client.id);
  const etapesClient = paiementsEtapes.filter((e) => e.client_id === client.id);

  // --- Paiement : toujours un rappel des montants, jamais un verdict -----
  const progress = paiementProgress(client, reservationsClientToutes, resaOptions, resaTarifs, etapesClient);
  items.push({
    code: "paiement_resume",
    categorie: "Paiement",
    message: `Total du séjour : ${euros(progress.totalSejour)}€ — payé : ${euros(progress.totalPaye)}€ — reste : ${euros(progress.reste)}€.`,
  });
  // Montant de chaque activité en face du nombre de participants, pour
  // vérifier à l'œil que le prix colle bien au monde présent.
  for (const r of resasClient) {
    const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    const { nbAcc, nbEnf3 } = participantsFor(r, client);
    let pax = paxLine(r, client);
    if (nbAcc > 0) pax += `, ${nbAcc} accompagnateur${nbAcc > 1 ? "s" : ""}`;
    if (nbEnf3 > 0) pax += `, ${nbEnf3} enfant${nbEnf3 > 1 ? "s" : ""} 3 ans`;
    items.push({
      code: "montant_activite",
      categorie: "Paiement",
      message: `« ${r.nom_activite} » — ${pax} — ${euros(total)}€.`,
      reservationId: r.id,
    });
  }

  // --- Programme : journées avec plusieurs activités, à relire ----------
  const parDate = new Map<string, Reservation[]>();
  for (const r of resasClient) {
    if (!r.date_debut) continue;
    parDate.set(r.date_debut, [...(parDate.get(r.date_debut) || []), r]);
  }
  for (const [date, resasJour] of parDate) {
    if (resasJour.length < 2) continue;
    const detail = resasJour
      .map((r) => {
        const moment = momentDeLaJournee(r);
        return `« ${r.nom_activite} »${moment ? ` (${moment})` : ""}`;
      })
      .join(", ");
    items.push({
      code: "programme_meme_jour",
      categorie: "Programme",
      message: `${date} — ${resasJour.length} activités ce jour-là : ${detail}.`,
    });
  }

  // --- Programme : champs propres à l'activité (pointure, île...) -------
  for (const r of resasClient) {
    const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
    const manquants = missingChampsFor(r, catalogueItem).filter(
      (champ) => !CHAMPS_DEJA_DANS_LE_TITRE.includes(champ)
    );
    manquants.forEach((champ) => {
      items.push({
        code: "champ_a_verifier",
        categorie: "Programme",
        message: `« ${r.nom_activite} » : ${champ} à renseigner.`,
        reservationId: r.id,
      });
    });
  }

  // --- Documents -----------------------------------------------------------
  if (resasClient.some((r) => billetRequisEffectif(r) && r.billet_etape !== "termine")) {
    items.push({
      code: "billet_avion",
      categorie: "Documents",
      message: "Billet d'avion : pas encore marqué reçu/envoyé, à vérifier.",
    });
  }
  if (client.passeport_photos.length === 0) {
    items.push({
      code: "passeport",
      categorie: "Documents",
      message: "Passeport : aucune photo dans le dossier, à vérifier.",
    });
  }

  // --- Remboursements : un rappel groupé par remboursement, pas un verdict
  const remboursementsClient = remboursements.filter((r) => r.client_id === client.id);
  for (const r of remboursementsClient) {
    const raisonLabel = r.raison === "Autre" ? r.raison_autre : r.raison;
    const identifiant = r.date_remboursement || r.date_probleme || "date inconnue";
    const preuve = r.statut === "Effectué" ? (r.preuve_photo_path ? ", preuve jointe" : ", sans preuve jointe") : "";
    items.push({
      code: "remboursement_a_verifier",
      categorie: "Remboursement",
      message: `Remboursement (${identifiant}) — montant : ${
        Number(r.montant) > 0 ? `${euros(r.montant)}€` : "non renseigné"
      }, raison : ${raisonLabel || "non renseignée"}, mode : ${r.mode || "non renseigné"}, PayPal : ${
        r.paypal_email || "non renseignée"
      } (toujours en PayPal, quel que soit le mode d'origine), statut : ${r.statut}${preuve}.`,
    });
  }

  // --- Doublon -------------------------------------------------------------
  const doublons = findDuplicateClients(client, allClients, client.id);
  doublons.forEach((d) => {
    items.push({
      code: "doublon_client",
      categorie: "Doublon",
      message: `À vérifier : dossier proche de « ${d.client.nom} » (${d.reasons.join(", ")}).`,
    });
  });

  return items;
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
