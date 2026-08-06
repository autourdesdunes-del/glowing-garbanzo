import jsPDF from "jspdf";
import { todayStr } from "@/lib/dates";

function euros(n: number) {
  return `${(Number(n) || 0).toLocaleString("fr-FR")} €`;
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const MARGIN = 18;
const PAGE_BOTTOM = 280;

export function generateMonthlyReport(params: {
  periodeLabel: string;
  caTotal: number;
  margeTotal: number;
  margePct: number;
  topVentes: { nom: string; count: number; total: number }[];
  topRentables: { nom: string; marge: number }[];
  topClients: { nom: string; total: number }[];
}) {
  const { periodeLabel, caTotal, margeTotal, margePct, topVentes, topRentables, topClients } = params;
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
  doc.text("Rapport direction — usage interne", MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(`Rapport — ${periodeLabel}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Émis le ${fmtDate(todayStr())}`, 210 - MARGIN, y, { align: "right" });
  y += 8;
  doc.setDrawColor(230, 220, 200);
  doc.line(MARGIN, y, 210 - MARGIN, y);
  y += 10;

  const colTotal = 210 - MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Chiffre d'affaires total", MARGIN, y);
  doc.text(euros(caTotal), colTotal, y, { align: "right" });
  y += 7;
  doc.text("Marge totale", MARGIN, y);
  doc.text(`${euros(margeTotal)} (${margePct}%)`, colTotal, y, { align: "right" });
  y += 12;

  const section = (title: string, rows: string[][], emptyLabel: string) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(title, MARGIN, y);
    y += 6;
    if (rows.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(140, 140, 140);
      doc.text(emptyLabel, MARGIN, y);
      y += 6;
      return;
    }
    rows.forEach(([label, value]) => {
      ensureSpace(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(label, MARGIN, y, { maxWidth: 140 });
      doc.text(value, colTotal, y, { align: "right" });
      y += 6;
    });
    y += 4;
  };

  section(
    "Activités les plus vendues",
    topVentes.map((d) => [`${d.nom} — ${d.count} vente(s)`, euros(d.total)]),
    "Pas encore d'activités vendues sur cette période."
  );
  section(
    "Activités les plus rentables",
    topRentables.map((d) => [d.nom, `${euros(d.marge)} de marge`]),
    "Pas encore de données de coût sur cette période."
  );
  section(
    "Plus gros clients",
    topClients.map((d) => [d.nom, euros(d.total)]),
    "Pas encore de clients avec activités sur cette période."
  );

  ensureSpace(10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Rapport figé au moment de l'export — Autour des Dunes, Hurghada, Égypte.", MARGIN, y);

  doc.save(`rapport-direction-${periodeLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
