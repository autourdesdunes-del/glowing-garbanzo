import jsPDF from "jspdf";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { participantsFor, resaTotalMontant } from "@/lib/resa";
import { todayStr } from "@/lib/dates";

function euros(n: number) {
  return `${(Number(n) || 0).toLocaleString("fr-FR")} €`;
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const MARGIN = 18;
const PAGE_BOTTOM = 280;

export function generateClientDocument(
  docType: "devis" | "facture",
  client: Client,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]> = {}
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // -- Header -----------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(92, 42, 29); // terracotta
  doc.text("Autour des Dunes", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Hurghada, Égypte · autourdesduneshurghada.com · WhatsApp +20 155 622 1115", MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(docType === "devis" ? "DEVIS" : "FACTURE", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Émis le ${fmtDate(todayStr())}`, 210 - MARGIN, y, {
    align: "right",
  });
  y += 8;
  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, 210 - MARGIN, y);
  y += 8;

  // -- Client block -------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(92, 42, 29);
  doc.text(client.nom || "Sans nom", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const infoLines = [
    client.telephone && `Téléphone : ${client.telephone}`,
    client.email && `Email : ${client.email}`,
    client.hotel && `Hôtel : ${client.hotel}${client.chambre ? ` — Chambre ${client.chambre}` : ""}`,
    (client.date_debut || client.date_fin) &&
      // "→" (U+2192) ne s'affiche pas correctement avec la police de base
      // de jsPDF (helvetica) — pas de glyphe, ça sort en mojibake sur le PDF.
      `Séjour : ${fmtDate(client.date_debut)} - ${fmtDate(client.date_fin)}`,
    `Voyageurs : ${client.adultes} adulte(s)${client.enfants ? `, ${client.enfants} enfant(s)` : ""}`,
  ].filter(Boolean) as string[];
  infoLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 5;
  });
  y += 4;

  // -- Activities table ---------------------------------------------------
  const relevantResas =
    docType === "facture" ? reservations.filter((r) => r.statut_resa === "Confirmée") : reservations;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Activités", MARGIN, y);
  y += 6;

  const colX = { nom: MARGIN, total: 210 - MARGIN };

  let sejourTotal = 0;
  if (relevantResas.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("Aucune activité.", MARGIN, y);
    y += 6;
  } else {
    relevantResas.forEach((r, i) => {
      ensureSpace(20);
      const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      sejourTotal += total;
      // Le "bébé" facturable n'existe pas comme catégorie à part sur une
      // réservation — c'est la 3e tranche de prix (pu_enfant_3ans /
      // participants_enfants_3ans) qui joue ce rôle au cas par cas (ex. Le
      // Caire en avion, où les bébés sont bien facturés), donc c'est elle
      // qu'on affiche comme "bébé" sur le document plutôt qu'un champ qui
      // n'existe pas.
      const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(r.nom_activite || "Activité sans nom", colX.nom, y, { maxWidth: 130 });
      doc.text(euros(total), colX.total, y, { align: "right" });
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(120, 110, 100);
      doc.text(fmtDate(r.date_debut), colX.nom, y);
      y += 5;

      if (r.tarif_mode === "groupe") {
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(
          r.pax_override || `Forfait groupe — ${nbAd} ad.${nbEnf ? ` + ${nbEnf} enf.` : ""}`,
          colX.nom,
          y,
          { maxWidth: 174 }
        );
        y += 5.5;
      } else {
        const tranches: { label: string; nb: number; pu: number }[] = [
          { label: "Adulte", nb: nbAd, pu: Number(r.pu_adulte) || 0 },
          { label: "Enfant", nb: nbEnf, pu: Number(r.pu_enfant) || 0 },
          { label: "Bébé", nb: nbEnf3, pu: Number(r.pu_enfant_3ans) || 0 },
          { label: "Accompagnateur", nb: nbAcc, pu: Number(r.pu_accompagnateur) || 0 },
        ].filter((t) => t.nb > 0);

        if (tranches.length > 0) {
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          tranches.forEach((t) => {
            doc.text(`${t.label} (${t.nb})`, colX.nom, y);
            doc.text(t.pu > 0 ? `${euros(t.pu)} / pers.` : "Gratuit", colX.nom + 90, y);
            y += 5;
          });
        }
      }

      const options = resaOptions[r.id] || [];
      if (options.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(120, 110, 100);
        doc.text(`Options : ${options.map((o) => o.nom).join(", ")}`, colX.nom, y, { maxWidth: 174 });
        y += 5;
      }

      y += 2;
      if (i < relevantResas.length - 1) {
        doc.setDrawColor(240, 235, 225);
        doc.line(MARGIN, y, 210 - MARGIN, y);
        y += 5;
      }
    });
  }

  ensureSpace(10);
  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, 210 - MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Total séjour", colX.nom, y);
  doc.text(euros(sejourTotal), colX.total, y, { align: "right" });
  y += 10;

  // -- Payments -------------------------------------------------------
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Paiements", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const totalAcomptes = client.paiement_type === "acompte" && client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  if (client.paiement_type !== "acompte" || !client.acompte_montant) {
    doc.setTextColor(140, 140, 140);
    doc.text("Aucun acompte enregistré.", MARGIN, y);
    y += 5;
  } else {
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Acompte — ${client.acompte_paye ? `encaissé le ${fmtDate(client.acompte_date_encaissement)}` : "à régler"} (${client.acompte_mode})`,
      MARGIN,
      y
    );
    doc.text(euros(client.acompte_montant), colX.total, y, { align: "right" });
    y += 5;
  }

  // Le solde n'est plus un montant saisi à la main : c'est toujours le reste
  // du séjour une fois l'acompte déduit.
  const soldeRestant = Math.max(sejourTotal - totalAcomptes, 0);

  ensureSpace(6);
  doc.text(
    `Solde — ${client.solde_paye ? "encaissé" : "à régler"}${client.solde_date ? `, ${fmtDate(client.solde_date)}` : ""} (${client.solde_mode})`,
    MARGIN,
    y
  );
  doc.text(euros(soldeRestant), colX.total, y, { align: "right" });
  y += 8;

  const totalPaye = totalAcomptes + (client.solde_paye ? soldeRestant : 0);
  const reste = sejourTotal - totalPaye;

  ensureSpace(14);
  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, 210 - MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Payé", MARGIN, y);
  doc.text(euros(totalPaye), colX.total, y, { align: "right" });
  y += 6;
  doc.text("Reste à payer", MARGIN, y);
  doc.text(euros(reste), colX.total, y, { align: "right" });
  y += 12;

  // -- Footer -----------------------------------------------------------
  ensureSpace(10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    docType === "devis"
      ? "Ce devis est indicatif et ne constitue pas une facture. Autour des Dunes — Hurghada, Égypte."
      : "Document récapitulatif — Autour des Dunes, Hurghada, Égypte.",
    MARGIN,
    y
  );

  const filename = `${docType}-${(client.nom || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}
