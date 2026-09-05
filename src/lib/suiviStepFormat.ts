// Petits formateurs/libellés propres à SuiviStep (client-steps.tsx) —
// extraits pour alléger ce fichier, sans changement de comportement.
export function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function actionLabel(action: string) {
  return { insert: "a créé", update: "a modifié", delete: "a supprimé" }[action] || action;
}

export function tableLabel(table: string) {
  return (
    {
      clients: "la fiche client",
      reservations: "une activité",
      paiements: "un acompte",
      paiements_etapes: "un paiement",
      remboursements: "un remboursement",
    }[table] || table
  );
}

export const ANNULATION_TYPE_PAR: Record<string, string> = {
  client: "par le client",
  agence: "par l'agence",
  gouvernement: "par le gouvernement",
};

export const ACTION_STYLES: Record<string, string> = {
  insert: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
};
export const ACTION_ICONS: Record<string, string> = {
  insert: "+",
  update: "✎",
  delete: "✕",
};
