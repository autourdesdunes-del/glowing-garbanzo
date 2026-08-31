import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { participantsFor, isGrandEgyptianMuseum } from "@/lib/resa";
import { todayStr } from "@/lib/dates";

function euros(n: number) {
  return `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const MARGIN = 14;
const PAGE_WIDTH = 210;

// Infos légales de la société (registre du commerce égyptien + ETA, voir
// documents fournis par Mélanie le 31/08/2026) — à corriger ici seulement
// si la société change de forme, d'adresse ou de TRN.
const RAISON_SOCIALE = "Autour Des Dunes Hurghada for Tourism Management and Marketing";
const ADRESSE_LEGALE = "Red Sea – Hurghada, Flat No. 17, 3rd Floor, Dow Heights, Elmohamady Square, Égypte";
const TRN_EGYPTIEN = "758172326";

// Numéro de document lisible (ex. 26-08-473) : année-mois + un suffixe basé
// sur l'heure de génération. Pas de compteur séquentiel en base aujourd'hui
// (voir brief section 6) — ce numéro sert d'identifiant à peu près unique
// et daté, pas d'un vrai numéro de facturation comptable.
function numeroDocument(docType: "devis" | "facture") {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const suffixe = String((now.getHours() * 60 + now.getMinutes()) % 1000).padStart(3, "0");
  return `${docType === "devis" ? "D" : "F"}${yy}-${mm}-${suffixe}`;
}

type Ligne = {
  designation: string;
  quantite: number;
  puVente: number;
  montantHT: number;
};

// Découpe chaque activité en une ligne par tranche de prix (adulte / enfant
// / bébé / accompagnateur, ou une seule ligne forfait pour le tarif groupe),
// puis une ligne par poste additionnel (options, tarifs complémentaires,
// transfert, suppléments île/GEM) — la somme de ces lignes reconstitue
// exactement resaTotalMontant, pour que le total du tableau et "Total
// séjour" ne divergent jamais.
function lignesPourReservation(
  r: Reservation,
  client: Client,
  options: ReservationOption[],
  tarifs: ReservationTarif[]
): Ligne[] {
  const lignes: Ligne[] = [];
  const dateLabel = fmtDate(r.date_debut);
  let premiereLigne = true;
  const designation = (suffixe?: string) => {
    const nom = suffixe ? `${r.nom_activite || "Activité sans nom"} (${suffixe})` : r.nom_activite || "Activité sans nom";
    const label = premiereLigne ? `${nom}\n${dateLabel}` : nom;
    premiereLigne = false;
    return label;
  };

  const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);

  if (r.tarif_mode === "groupe") {
    const base =
      (Number(r.prix_groupe_base) || 0) +
      (Number(r.participants_extra1) || 0) * (Number(r.prix_groupe_extra1) || 0) +
      (Number(r.participants_extra_enfants) || 0) * (Number(r.prix_groupe_extra_enfant) || 0);
    lignes.push({ designation: designation(), quantite: 1, puVente: base, montantHT: base });
  } else {
    const tranches = [
      { suffixe: undefined as string | undefined, nb: nbAd, pu: Number(r.pu_adulte) || 0 },
      { suffixe: "Enfant", nb: nbEnf, pu: Number(r.pu_enfant) || 0 },
      { suffixe: "Bébé", nb: nbEnf3, pu: Number(r.pu_enfant_3ans) || 0 },
      { suffixe: "Accompagnateur", nb: nbAcc, pu: Number(r.pu_accompagnateur) || 0 },
    ].filter((t) => t.nb > 0);

    if (tranches.length === 0) {
      lignes.push({ designation: designation(), quantite: 1, puVente: 0, montantHT: 0 });
    } else {
      tranches.forEach((t) => {
        lignes.push({ designation: designation(t.suffixe), quantite: t.nb, puVente: t.pu, montantHT: t.nb * t.pu });
      });
    }
  }

  const optionsTotal = options.reduce((s, o) => s + (Number(o.prix) || 0) * (Number(o.quantite) || 1), 0);
  if (optionsTotal > 0) {
    lignes.push({
      designation: `Options : ${options.map((o) => o.nom).join(", ")}`,
      quantite: 1,
      puVente: optionsTotal,
      montantHT: optionsTotal,
    });
  }

  tarifs.forEach((t) => {
    const montant = (Number(t.quantite) || 0) * (Number(t.pu) || 0);
    if (Number(t.quantite) || 0) {
      lignes.push({
        designation: t.label || "Tarif complémentaire",
        quantite: Number(t.quantite) || 0,
        puVente: Number(t.pu) || 0,
        montantHT: montant,
      });
    }
  });

  const transfert = r.transfert_inclus ? 0 : Number(r.transfert_montant) || 0;
  if (transfert > 0) {
    lignes.push({ designation: "Transfert", quantite: 1, puVente: transfert, montantHT: transfert });
  }

  const supplementIle = r.ile_selectionnee === "Oziréa" ? nbAd * 30 + nbEnf * 15 : 0;
  const supplementGEM = isGrandEgyptianMuseum(r.site_caire) ? nbAd * 20 + nbEnf * 10 : 0;
  const supplements = supplementIle + supplementGEM;
  if (supplements > 0) {
    lignes.push({ designation: "Suppléments (île / site)", quantite: 1, puVente: supplements, montantHT: supplements });
  }

  return lignes;
}

export function generateClientDocument(
  docType: "devis" | "facture",
  client: Client,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]> = {}
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // -- En-tête : société (gauche) / client (droite) ----------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(92, 42, 29); // terracotta
  doc.text("AUTOUR DES DUNES", MARGIN, y);

  const rightColX = PAGE_WIDTH - MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(client.nom || "Sans nom", rightColX, y, { align: "right" });
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const legalLines = doc.splitTextToSize(RAISON_SOCIALE, 95);
  legalLines.forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 3.6;
  });
  const adresseLines = doc.splitTextToSize(ADRESSE_LEGALE, 95);
  adresseLines.forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 3.6;
  });
  doc.text(`Tax Registration Number (ETA) : ${TRN_EGYPTIEN}`, MARGIN, y);
  y += 3.6;
  doc.text("autourdesduneshurghada.com · WhatsApp +20 155 622 1115", MARGIN, y);

  // Bloc client, aligné à droite en vis-à-vis du bloc société
  let yRight = MARGIN + 5.5;
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const infoLinesClient = [
    client.telephone && `Tél. : ${client.telephone}`,
    client.email && `Email : ${client.email}`,
    (client.date_debut || client.date_fin) && `Séjour : ${fmtDate(client.date_debut)} - ${fmtDate(client.date_fin)}`,
    client.hotel && `Hôtel : ${client.hotel}${client.chambre ? ` — Ch. ${client.chambre}` : ""}`,
    `Voyageurs : ${client.adultes} adulte(s)${client.enfants ? `, ${client.enfants} enfant(s)` : ""}`,
  ].filter(Boolean) as string[];
  infoLinesClient.forEach((line) => {
    doc.text(line, rightColX, yRight, { align: "right" });
    yRight += 4;
  });

  y = Math.max(y, yRight) + 6;

  // -- Titre + numéro/date -------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(docType === "devis" ? "DEVIS" : "FACTURE", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`N° ${numeroDocument(docType)}`, rightColX, y - 3, { align: "right" });
  doc.text(`Le ${fmtDate(todayStr())}`, rightColX, y + 2, { align: "right" });
  y += 8;

  if (docType === "facture") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 110, 100);
    doc.text("e-Invoicing (ETA) — document conforme au système de facturation électronique égyptien.", MARGIN, y);
    y += 5;
  }

  // -- Tableau des activités -----------------------------------------------
  const relevantResas =
    docType === "facture" ? reservations.filter((r) => r.statut_resa === "Confirmée") : reservations;

  const lignes: Ligne[] = relevantResas.flatMap((r) =>
    lignesPourReservation(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || [])
  );
  const totalHT = lignes.reduce((s, l) => s + l.montantHT, 0);

  const body =
    lignes.length > 0
      ? lignes.map((l) => [
          l.designation,
          l.quantite.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          euros(l.puVente),
          "0,00 %",
          euros(l.montantHT),
        ])
      : [["Aucune activité.", "", "", "", ""]];

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Désignation", "Quantité", "PU Vente", "TVA", "Montant HT"]],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.2, textColor: [30, 30, 30], lineColor: [230, 220, 200] },
    headStyles: { fillColor: [245, 240, 230], textColor: [92, 42, 29], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // -- Total HT / TVA / TTC (0% — activités touristiques hors TVA) --------
  const boxW = 70;
  const boxX = rightColX - boxW;
  doc.setDrawColor(230, 220, 200);
  doc.setFillColor(250, 247, 240);
  doc.rect(boxX, y - 4.5, boxW, 20, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text("Total HT", boxX + 3, y);
  doc.text(euros(totalHT), rightColX - 3, y, { align: "right" });
  doc.text("TVA (0 %)", boxX + 3, y + 5);
  doc.text("0,00 €", rightColX - 3, y + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Total TTC", boxX + 3, y + 12);
  doc.text(euros(totalHT), rightColX - 3, y + 12, { align: "right" });
  y += 24;

  // -- Paiements ------------------------------------------------------------
  const totalAcomptes =
    client.paiement_type === "acompte" && client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  const soldeRestant = Math.max(totalHT - totalAcomptes, 0);
  const totalPaye = totalAcomptes + (client.solde_paye ? soldeRestant : 0);
  const reste = totalHT - totalPaye;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Conditions de paiement", MARGIN, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const conditions: string[] = [];
  if (client.paiement_type === "acompte" && client.acompte_montant) {
    conditions.push(
      `${euros(client.acompte_montant)} ${client.acompte_paye ? `payé (${client.acompte_mode}) le ${fmtDate(client.acompte_date_encaissement)}` : `à régler (${client.acompte_mode})`}`
    );
  }
  conditions.push(
    `${euros(soldeRestant)} ${client.solde_paye ? "encaissé" : "à payer"}${client.solde_date ? ` (${client.solde_mode}) le ${fmtDate(client.solde_date)}` : ` (${client.solde_mode})`}`
  );
  conditions.forEach((c) => {
    doc.text(`•  ${c}`, MARGIN, y);
    y += 4.5;
  });
  y += 3;

  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, rightColX, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Payé", MARGIN, y);
  doc.text(euros(totalPaye), rightColX, y, { align: "right" });
  y += 5;
  doc.text("Reste à payer", MARGIN, y);
  doc.text(euros(reste), rightColX, y, { align: "right" });
  y += 10;

  // -- Pied de page -----------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    docType === "devis"
      ? "Ce devis est indicatif et ne constitue pas une facture."
      : "MERCI DE VOTRE CONFIANCE",
    MARGIN,
    y
  );

  const filename = `${docType}-${(client.nom || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}
