import { Client } from "./types";

export type DuplicateMatch = { client: Client; reasons: string[] };

function normText(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}
function normPhone(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

// Détecte les doublons probables sur nom, téléphone ou pseudo Instagram/TikTok
// — les trois signaux que l'équipe utilise pour repérer "c'est déjà ce
// client-là". Le téléphone n'est comparé qu'à partir de 6 chiffres pour
// éviter les faux positifs sur des numéros tronqués/vides.
export function findDuplicateClients(
  candidate: { nom?: string | null; telephone?: string | null; pseudo_contact?: string | null },
  existing: Client[],
  excludeId?: string | null
): DuplicateMatch[] {
  const nom = normText(candidate.nom);
  const tel = normPhone(candidate.telephone);
  const pseudo = normText(candidate.pseudo_contact);
  const matches: DuplicateMatch[] = [];
  for (const c of existing) {
    if (excludeId && c.id === excludeId) continue;
    const reasons: string[] = [];
    if (nom && normText(c.nom) === nom) reasons.push("même nom");
    if (tel && tel.length >= 6 && normPhone(c.telephone) === tel) reasons.push("même numéro");
    if (pseudo && normText(c.pseudo_contact) === pseudo) reasons.push("même pseudo");
    if (reasons.length) matches.push({ client: c, reasons });
  }
  return matches;
}
