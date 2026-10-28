import jsPDF from "jspdf";
import { todayStr } from "@/lib/dates";

function fmtDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const MARGIN = 18;
const PAGE_BOTTOM = 280;

// Rapport PDF d'une seule catégorie d'activité dans "Récap du mois" — une
// ligne par réservation (date, client, détail adultes/enfants/bébés),
// demande de Mélanie, 2026-10-28.
export function generateRecapActiviteReport(params: {
  activiteNom: string;
  moisLabel: string;
  rows: { date: string; clientNom: string; nbAd: number; nbEnf: number; nbBebe: number }[];
  totalAd: number;
  totalEnf: number;
  totalBebe: number;
}) {
  const { activiteNom, moisLabel, rows, totalAd, totalEnf, totalBebe } = params;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(92, 42, 29);
  doc.text("Autour des Dunes", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Récap du mois — usage interne", MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(activiteNom, MARGIN, y, { maxWidth: 210 - 2 * MARGIN });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(moisLabel, MARGIN, y);
  doc.text(`Émis le ${fmtDate(todayStr())}`, 210 - MARGIN, y, { align: "right" });
  y += 8;
  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, 210 - MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`${rows.length} réservation${rows.length > 1 ? "s" : ""}`, MARGIN, y);
  doc.text(
    `${totalAd} adulte${totalAd > 1 ? "s" : ""} · ${totalEnf} enfant${totalEnf > 1 ? "s" : ""} · ${totalBebe} bébé${totalBebe > 1 ? "s" : ""}`,
    210 - MARGIN,
    y,
    { align: "right" }
  );
  y += 10;

  const colDate = MARGIN;
  const colClient = MARGIN + 25;
  const colDetail = 210 - MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("Date", colDate, y);
  doc.text("Client", colClient, y);
  doc.text("Pax", colDetail, y, { align: "right" });
  y += 5;
  doc.setDrawColor(240, 240, 240);
  doc.line(MARGIN, y, 210 - MARGIN, y);
  y += 5;

  rows.forEach((r) => {
    ensureSpace(7);
    const paxLabel = [
      `${r.nbAd} ad.`,
      r.nbEnf > 0 ? `${r.nbEnf} enf.` : "",
      r.nbBebe > 0 ? `${r.nbBebe} béb.` : "",
    ]
      .filter(Boolean)
      .join(", ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(fmtDate(r.date), colDate, y);
    doc.text(r.clientNom, colClient, y, { maxWidth: colDetail - colClient - 25 });
    doc.text(paxLabel, colDetail, y, { align: "right" });
    y += 6;
  });

  ensureSpace(10);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Rapport figé au moment de l'export — Autour des Dunes, Hurghada, Égypte.", MARGIN, y);

  doc.save(`recap-${activiteNom.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${moisLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
