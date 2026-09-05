import { localDateStr } from "@/lib/dates";

// Petits formateurs/détecteurs propres au Catalogue — extraits de
// CatalogueView.tsx pour alléger ce fichier, sans changement de comportement.
export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export function isQuadActivity(a: { nom: string }) {
  return (a.nom || "").toLowerCase().includes("quad");
}

export function isSpaActivity(a: { nom: string }) {
  const n = (a.nom || "").toLowerCase();
  return n.includes("spa") || n.includes("massage");
}

export function isMontgolfiereActivity(a: { nom: string }) {
  return (a.nom || "").toLowerCase().includes("montgolfi");
}

export const JOUR_ABREV: Record<string, string> = {
  Lundi: "L",
  Mardi: "M",
  Mercredi: "M",
  Jeudi: "J",
  Vendredi: "V",
  Samedi: "S",
  Dimanche: "D",
};

export const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
export const WEEKDAY_JS_TO_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export function isoDate(d: Date) {
  return localDateStr(d);
}
