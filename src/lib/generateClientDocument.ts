import jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { participantsFor, isGrandEgyptianMuseum } from "@/lib/resa";
import { addDays, todayStr } from "@/lib/dates";

function euros(n: number) {
  return `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const MARGIN = 20;
const PAGE_WIDTH = 210;

// Infos légales de la société (registre du commerce égyptien + ETA, voir
// documents fournis par Mélanie le 31/08/2026) — à corriger ici seulement
// si la société change de forme, d'adresse ou de TRN.
const RAISON_SOCIALE = "Autour Des Dunes Hurghada for Tourism Management and Marketing";
const ADRESSE_LEGALE = "Red Sea – Hurghada, Flat No. 17, 3rd Floor, Aldau Heights, Elmohamady Square, Égypte";
const TRN_EGYPTIEN = "758172326";

// Durée de validité affichée sur un devis (voir retour de Mélanie du
// 31/08/2026) — au-delà, les tarifs/disponibilités ne sont plus garantis.
const DEVIS_VALIDITE_JOURS = 15;

// Numéro de document lisible (ex. F26-08-473) : année-mois + un suffixe basé
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

type LigneMontant = { label: string; quantite: number; puVente: number; montantHT: number };

// Découpe chaque activité en une ligne par tranche de prix (adulte / enfant
// / bébé / accompagnateur, ou une seule ligne "Forfait" pour le tarif
// groupe), puis une ligne par poste additionnel (options, tarifs
// complémentaires, transfert, suppléments île/GEM) — la somme de ces
// lignes reconstitue exactement le total du séjour. La date et le nom de
// l'activité sont gérés à part (voir generateClientDocument) : ce ne sont
// plus des lignes chiffrées mais un en-tête au-dessus de ce bloc.
function lignesPourReservation(
  r: Reservation,
  client: Client,
  options: ReservationOption[],
  tarifs: ReservationTarif[]
): LigneMontant[] {
  const lignes: LigneMontant[] = [];
  const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);

  if (r.tarif_mode === "groupe") {
    const base =
      (Number(r.prix_groupe_base) || 0) +
      (Number(r.participants_extra1) || 0) * (Number(r.prix_groupe_extra1) || 0) +
      (Number(r.participants_extra_enfants) || 0) * (Number(r.prix_groupe_extra_enfant) || 0);
    lignes.push({ label: "Forfait", quantite: 1, puVente: base, montantHT: base });
  } else {
    const tranches = [
      { label: "Adulte", nb: nbAd, pu: Number(r.pu_adulte) || 0 },
      { label: "Enfant", nb: nbEnf, pu: Number(r.pu_enfant) || 0 },
      { label: "Bébé", nb: nbEnf3, pu: Number(r.pu_enfant_3ans) || 0 },
      { label: "Accompagnateur", nb: nbAcc, pu: Number(r.pu_accompagnateur) || 0 },
    ].filter((t) => t.nb > 0);

    if (tranches.length === 0) {
      lignes.push({ label: "Forfait", quantite: 1, puVente: 0, montantHT: 0 });
    } else {
      tranches.forEach((t) => {
        lignes.push({ label: t.label, quantite: t.nb, puVente: t.pu, montantHT: t.nb * t.pu });
      });
    }
  }

  const optionsTotal = options.reduce((s, o) => s + (Number(o.prix) || 0) * (Number(o.quantite) || 1), 0);
  if (optionsTotal > 0) {
    lignes.push({
      label: `Options : ${options.map((o) => o.nom).join(", ")}`,
      quantite: 1,
      puVente: optionsTotal,
      montantHT: optionsTotal,
    });
  }

  tarifs.forEach((t) => {
    if (Number(t.quantite) || 0) {
      lignes.push({
        label: t.label || "Tarif complémentaire",
        quantite: Number(t.quantite) || 0,
        puVente: Number(t.pu) || 0,
        montantHT: (Number(t.quantite) || 0) * (Number(t.pu) || 0),
      });
    }
  });

  const transfert = r.transfert_inclus ? 0 : Number(r.transfert_montant) || 0;
  if (transfert > 0) {
    lignes.push({ label: "Transfert", quantite: 1, puVente: transfert, montantHT: transfert });
  }

  const supplementIle = r.ile_selectionnee === "Oziréa" ? nbAd * 30 + nbEnf * 15 : 0;
  const supplementGEM = isGrandEgyptianMuseum(r.site_caire) ? nbAd * 20 + nbEnf * 10 : 0;
  const supplements = supplementIle + supplementGEM;
  if (supplements > 0) {
    lignes.push({ label: "Suppléments (île / site)", quantite: 1, puVente: supplements, montantHT: supplements });
  }

  return lignes;
}

// Une ligne du tableau final : soit un en-tête d'activité (date, puis nom,
// chacun sur sa propre ligne pleine largeur, sans chiffres), soit une ligne
// de prix normale (tranche, option, transfert...).
type RowKind = "date" | "nom" | "ligne";

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
  doc.setFontSize(17);
  doc.setTextColor(92, 42, 29); // terracotta
  doc.text("AUTOUR DES DUNES", MARGIN, y);

  const rightColX = PAGE_WIDTH - MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(client.nom || "Sans nom", rightColX, y, { align: "right" });
  y += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const legalLines = doc.splitTextToSize(RAISON_SOCIALE, 95);
  legalLines.forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 3.8;
  });
  const adresseLines = doc.splitTextToSize(ADRESSE_LEGALE, 95);
  adresseLines.forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 3.8;
  });
  doc.text(`Tax Registration Number (ETA) : ${TRN_EGYPTIEN}`, MARGIN, y);
  y += 3.8;
  doc.text("autourdesduneshurghada.com · WhatsApp +20 155 622 1115", MARGIN, y);

  // Bloc client, aligné à droite en vis-à-vis du bloc société
  let yRight = MARGIN + 6.5;
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
    yRight += 4.2;
  });

  y = Math.max(y, yRight) + 10;

  // -- Titre + numéro/date -------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(docType === "devis" ? "DEVIS" : "FACTURE", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`N° ${numeroDocument(docType)}`, rightColX, y - 3, { align: "right" });
  doc.text(`Le ${fmtDate(todayStr())}`, rightColX, y + 2, { align: "right" });
  y += 10;

  if (docType === "devis") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 110, 100);
    doc.text(`Valable jusqu'au ${fmtDate(addDays(todayStr(), DEVIS_VALIDITE_JOURS))}`, MARGIN, y);
    y += 7;
  }

  if (docType === "facture") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 110, 100);
    doc.text("e-Invoicing (ETA) — document conforme au système de facturation électronique égyptien.", MARGIN, y);
    y += 7;
  }

  // -- Tableau des activités -----------------------------------------------
  const relevantResas =
    docType === "facture" ? reservations.filter((r) => r.statut_resa === "Confirmée") : reservations;

  const rowKinds: RowKind[] = [];
  const body: (string | { content: string; colSpan: number })[][] = [];
  let totalHT = 0;

  relevantResas.forEach((r) => {
    rowKinds.push("date");
    body.push([{ content: fmtDate(r.date_debut), colSpan: 4 }]);
    rowKinds.push("nom");
    body.push([{ content: r.nom_activite || "Activité sans nom", colSpan: 4 }]);

    const lignes = lignesPourReservation(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    lignes.forEach((l) => {
      totalHT += l.montantHT;
      rowKinds.push("ligne");
      body.push([
        l.label,
        l.quantite.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        euros(l.puVente),
        euros(l.montantHT),
      ]);
    });
  });

  if (body.length === 0) {
    rowKinds.push("ligne");
    body.push(["Aucune activité.", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Désignation", "Quantité", "PU Vente", "Montant HT"]],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.6, textColor: [30, 30, 30], lineColor: [230, 220, 200] },
    headStyles: { fillColor: [245, 240, 230], textColor: [92, 42, 29], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 24, halign: "right" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== "body") return;
      const kind = rowKinds[data.row.index];
      if (kind === "date") {
        data.cell.styles.fontStyle = "italic";
        data.cell.styles.textColor = [140, 130, 120];
        data.cell.styles.fontSize = 8;
        data.cell.styles.lineWidth = 0;
        data.cell.styles.cellPadding = { top: 3, right: 2.6, bottom: 0, left: 2.6 };
      } else if (kind === "nom") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [20, 20, 20];
        data.cell.styles.fontSize = 9.5;
        data.cell.styles.lineWidth = 0;
        data.cell.styles.cellPadding = { top: 0.3, right: 2.6, bottom: 1.8, left: 2.6 };
      } else if (kind === "ligne" && data.column.index === 0) {
        data.cell.styles.cellPadding = { top: 2.6, right: 2.6, bottom: 2.6, left: 7 };
        data.cell.styles.textColor = [70, 70, 70];
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // -- Total HT / TVA / TTC (0 % — activités touristiques hors TVA) --------
  const boxW = 72;
  const boxX = rightColX - boxW;
  doc.setDrawColor(230, 220, 200);
  doc.setFillColor(250, 247, 240);
  doc.rect(boxX, y - 5, boxW, 22, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text("Total HT", boxX + 3.5, y);
  doc.text(euros(totalHT), rightColX - 3.5, y, { align: "right" });
  doc.text("TVA (0 %)", boxX + 3.5, y + 5.5);
  doc.text("0,00 €", rightColX - 3.5, y + 5.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Total TTC", boxX + 3.5, y + 13);
  doc.text(euros(totalHT), rightColX - 3.5, y + 13, { align: "right" });
  y += 28;

  // -- Paiements ------------------------------------------------------------
  // Le montant de l'acompte fait toujours partie du total, encaissé ou pas
  // — sinon "Acompte à régler" + "Solde à payer" additionnent deux fois le
  // même argent. Seul le statut "payé" détermine ce qui compte dans "Payé".
  const acompteMontant = client.paiement_type === "acompte" ? Number(client.acompte_montant) || 0 : 0;
  const soldeMontant = Math.max(totalHT - acompteMontant, 0);
  const totalPaye = (client.acompte_paye ? acompteMontant : 0) + (client.solde_paye ? soldeMontant : 0);
  const reste = totalHT - totalPaye;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text("Conditions de paiement", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const conditions: string[] = [];
  if (acompteMontant > 0) {
    conditions.push(
      `${euros(acompteMontant)} ${client.acompte_paye ? `payé (${client.acompte_mode}) le ${fmtDate(client.acompte_date_encaissement)}` : `à régler (${client.acompte_mode})`}`
    );
  }
  conditions.push(
    `${euros(soldeMontant)} ${client.solde_paye ? "encaissé" : "à payer"}${client.solde_date ? ` (${client.solde_mode}) le ${fmtDate(client.solde_date)}` : ` (${client.solde_mode})`}`
  );
  conditions.forEach((c) => {
    doc.text(`•  ${c}`, MARGIN, y);
    y += 5;
  });
  y += 4;

  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, rightColX, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text("Payé", MARGIN, y);
  doc.text(euros(totalPaye), rightColX, y, { align: "right" });
  y += 5.5;
  doc.text("Reste à payer", MARGIN, y);
  doc.text(euros(reste), rightColX, y, { align: "right" });
  y += 12;

  // -- Pied de page -----------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    docType === "devis"
      ? `Ce devis est indicatif et ne constitue pas une facture. Valable jusqu'au ${fmtDate(addDays(todayStr(), DEVIS_VALIDITE_JOURS))}.`
      : "MERCI DE VOTRE CONFIANCE",
    MARGIN,
    y
  );

  const filename = `${docType}-${(client.nom || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}
