// Petits helpers propres à la navigation/sidebar d'AppShell.tsx — extraits
// pour alléger ce fichier, sans changement de comportement.
export function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
