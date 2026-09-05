import { Client } from "@/lib/types";
import { PROSPECT_STATUTS } from "@/lib/constants";
import { localDateStr } from "@/lib/dates";

// Petits helpers propres à la navigation/sidebar d'AppShell.tsx — extraits
// pour alléger ce fichier, sans changement de comportement.
export function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Même seuil que "Relances prospects" (DashboardView.tsx) — dupliqué ici
// (pas exporté) pour la cloche Manager, qui a besoin du total même sans
// jamais avoir ouvert le tableau de bord.
export function daysSinceNav(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
export function prospectStagnantNav(c: Client) {
  if (!PROSPECT_STATUTS.includes(c.statut)) return false;
  const todayStrNav = localDateStr(new Date());
  if (!c.date_debut || c.date_debut < todayStrNav) return false;
  const avant = Math.round((Date.parse(c.date_debut) - Date.parse(todayStrNav)) / 86400000);
  const seuilRelance = avant <= 7 ? 2 : avant <= 30 ? 5 : 10;
  return daysSinceNav(c.dernier_contact_date || c.created_at) >= seuilRelance;
}
