import { Client } from "./types";

export type DuplicateMatch = { client: Client; reasons: string[] };

// Les employées ajoutent parfois un ✅/⚠️/✔️ etc. devant un nom (pour se
// signaler quelque chose à elles-mêmes) — sans ce nettoyage, deux fiches de
// la même personne ("⚠️Cindy Paturaux" vs "Cindy Paturaux") ne sont jamais
// reconnues comme identiques et le détecteur de doublons les laisse passer.
export function normText(s: string | null | undefined): string {
  return (s || "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // "Célia" vs "Celia" doivent être reconnus comme le même nom — sans ça,
    // un simple accent en plus ou en moins laissait passer un vrai doublon
    // (vécu avec Celia/Célia Nichanian, deux fiches distinctes en pratique).
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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
