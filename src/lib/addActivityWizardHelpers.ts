import { CatalogueItem, Client } from "@/lib/types";
import { speedboatIleTitre, speedboatIleType } from "@/lib/resa";
import { todayStr } from "@/lib/dates";

// Petits formateurs/détecteurs propres à AddActivityWizard.tsx — extraits
// pour alléger ce fichier, sans changement de comportement.

export function joursAvant(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.parse(dateStr + "T00:00:00") - Date.parse(todayStr() + "T00:00:00")) / 86400000);
}

export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export function deaccent(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Groupe "Tout voir" par thème (premier tag, ex. "Louxor", "Activités en
// mer", "Aventure"...) plutôt que par categorie (trop grossier — 62 des 85
// activités sont "Excursion", ça n'aide personne à s'y retrouver). Sans
// tag, on retombe sur categorie pour ne perdre aucune activité.
export function groupeCatalogue(item: CatalogueItem) {
  return item.tags[0] || item.categorie || "Autre";
}

// Sous-rubriques demandées par Mélanie à l'intérieur de certaines rubriques
// (ex. dans "Activités désert" : Quad / Buggy / Autre). Mappé par id plutôt
// que par tag pour rester exact — ces regroupements ne correspondent pas
// forcément aux tags existants du catalogue.
export const SOUS_RUBRIQUE_PAR_ID: Record<string, string> = {
  // Activités désert
  "51152dfb-0652-46bf-8d0b-6feb3ea71619": "Quad", // Safari quad
  "cda53fdc-30b9-4509-8d2e-aae721ff3c07": "Quad", // Safari Quad Makadi
  "98a5d197-53a1-432b-95a5-7247d0d6f781": "Quad", // Safari quad & dîner spectacle
  "ea72258d-3199-4fb0-a030-d8e054c7a2a7": "Quad", // Safari quad au coucher du soleil
  "c60a74e1-6f7c-403e-aaa1-2fe86e9e6db4": "Quad", // Safari Mix Quad/Buggy
  "f89aa839-1934-4f1e-82a2-a6275946adda": "Buggy",
  "c9fd89c2-6b6d-4253-8c89-797a26d4584e": "Buggy", // Buggy et dîner spectacle
  "81a88b7a-bc9a-4eb4-95b1-3b54f65636ab": "Buggy", // Buggy Sunset
  "12b2e861-bc74-4c91-9269-7035fb3baac6": "Buggy", // Safari Buggy Famille
  "b878cb73-355e-4bd3-be18-791619f2b0c4": "Autre", // Grand Safari Bédouin
  "1f2a6d5f-c1e3-4a71-8e1e-0eea74cb8801": "Autre", // Safari Jeep & dîner spectacle

  // Activités en mer
  "b72b3dd3-6ffe-4e0f-997d-f7b6b8eda507": "Plongée",
  "3a934dbc-458b-4949-8ff6-423f6e50db98": "Plongée",
  "1f197cf7-a33c-45f3-84e2-f68b1a909448": "Les îles", // Orange Bay
  "a927a778-def3-4796-a189-90ee5f4a1ecd": "Les îles", // Mahmya Island
  "7311cfae-d381-4dd7-9e59-eb9f174e451b": "Les îles", // Bianca Island
  "5801f0a8-7574-44a7-b419-c90c0eb0986c": "Les îles", // Éden Island
  "76167bb7-4b9c-490d-8946-61d425052f2c": "Les îles", // Paradise Island (Hula Hula)
  "1c710f12-1e15-4807-9e2a-2398ad15f3a7": "Les îles", // Oziréa Island
  "83f33ac5-dc90-456c-9cfe-29afd8b1e19c": "Autre", // Parachute ascensionnel
  "f97c6887-9044-48c0-bb43-8ca7ced9ff5d": "Autre", // Seascope
  "4223c21b-ac1a-439a-8cee-91753fa3abcd": "Autre", // Maison des dauphins
  "58698bea-cc10-4be6-84dc-0fec7fa97e1b": "Yatch",
  "797b3379-3a75-4403-aeb1-a19df6ddeaac": "Yatch",
  "7c6591a4-b5ec-4f16-8a3c-0264fc3b0967": "Catamaran",
  "31856fec-6374-490b-a5fc-ab2235c8a3f0": "Catamaran",
  "a92b2022-5338-47e7-951d-044aa0f240f3": "Speedboat",
  "1749782b-a514-4e1f-b2de-7d401345506a": "Speedboat",
  "6e2d3049-680d-493a-b81d-c5159f340e30": "Speedboat",
  "d8fa6831-2c42-4ebe-b2ef-51f9b9f94160": "Speedboat",
  "c7158361-c9ef-4037-86e1-35d411de1c3d": "Speedboat",
  "4086c249-269c-451f-a503-08868c674c4f": "Speedboat",
  "d4a7bc19-77fb-4b92-b407-d211cca45e45": "Speedboat",
  "4cb3927e-2a78-41fd-b87c-15cbb3294e41": "Speedboat",

  // Louxor
  "b27207de-e49a-490a-b63b-5185ca3a6707": "Montgolfière",
  "59188c6f-57ec-4abc-92db-1b0fe4e3e5f9": "Montgolfière",
  "15facdc8-2e95-46eb-8629-379c287dfc7a": "Montgolfière",
  "7f735c8a-030b-470a-b1df-552103f6c4ce": "Montgolfière",
  "092814a3-fedd-454e-9709-ca1f01165170": "Montgolfière", // Vol en Montgolfière (Louxor)

  // Transfert
  "aaffc909-459f-4b0c-a842-48701c875775": "Transfert aéroport",
  "371449c3-89ef-493f-89e4-975c025bd6ab": "Transfert aéroport",
  "9a354338-3cf7-4bc8-b0c6-c249ad257b83": "Transfert aéroport",
  "01e22dd6-0aa1-444a-a245-e33684d892aa": "Transfert entre villes",
  "c67cfc50-475d-4f84-a0c2-ec67a984317f": "Transfert entre villes",
  "ae21a26d-896b-4a75-ac22-e1d255fc47a5": "Transfert entre villes",
  "ebdab078-bec9-44b9-8e7f-88c20ca82922": "Transfert entre villes",
  "6d933bb2-248c-4dda-8ed1-50a623b8c5fd": "Transfert entre villes",
  "67ab0185-c78b-4409-8daa-620837071425": "Transfert entre villes",
  "bc237280-91b9-422b-b85d-29810f9e5cd6": "Transfert entre villes",
};

export type RubriqueCatalogue = {
  rubrique: string;
  direct: CatalogueItem[];
  sous: (readonly [string, CatalogueItem[]])[];
};

export function construireRubriquesCatalogue(items: CatalogueItem[]): RubriqueCatalogue[] {
  const parRubrique = new Map<string, { direct: CatalogueItem[]; sous: Map<string, CatalogueItem[]> }>();
  for (const a of items) {
    const rubrique = groupeCatalogue(a);
    if (!parRubrique.has(rubrique)) parRubrique.set(rubrique, { direct: [], sous: new Map() });
    const entry = parRubrique.get(rubrique)!;
    const sousRubrique = SOUS_RUBRIQUE_PAR_ID[a.id];
    if (sousRubrique) {
      if (!entry.sous.has(sousRubrique)) entry.sous.set(sousRubrique, []);
      entry.sous.get(sousRubrique)!.push(a);
    } else {
      entry.direct.push(a);
    }
  }
  return [...parRubrique.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([rubrique, { direct, sous }]) => ({
      rubrique,
      direct: [...direct].sort((a, b) => a.nom.localeCompare(b.nom)),
      // "Autre" toujours en dernier — le reste par ordre alphabétique.
      sous: [...sous.entries()]
        .sort((a, b) => (a[0] === "Autre" ? 1 : b[0] === "Autre" ? -1 : a[0].localeCompare(b[0])))
        .map(([nom, its]) => [nom, [...its].sort((a, b) => a.nom.localeCompare(b.nom))] as const),
    }));
}

// Pour les activités spa/massage, "moment" (matin/après-midi/journée/plusieurs
// jours) ne veut rien dire — on demande un horaire précis à la place.
export function isSpaMassage(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("spa") || n.includes("massage");
}

// Spa ouvert de 10h à 21h — dernier créneau réservable à 19h (pour laisser
// le temps à la prestation avant la fermeture). Minutes libres par pas de 5.
export const SPA_HEURES = ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19"];
export const SPA_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export const MOMENTS_SPEEDBOAT = ["Matin", "Après-midi"] as const;

export const MAISON_DAUPHINS_TEXT =
  "Les speedboat privé maison des dauphins sont recommandés le matin pour davantage de chances de voir les dauphins.";

// Le Caire/Louxor "en bus" (grand groupe, toutes nationalités mélangées) —
// on pousse à recommander la formule mini-bus à la place avant de laisser
// ajouter cette version, sauf si "mini" est déjà dans le nom.
// (isDiscouragedBusActivity / isFamilySafariBedouin sont exportées depuis
// resa.ts pour être réutilisées par BusEscalationCenter/ManagerView, qui
// doivent afficher le bon texte selon le cas.)

export const MINI_BUS_TEXT =
  "Nous recommandons davantage la formule en mini-bus : c'est beaucoup plus confortable, avec seulement 8 à 9 personnes maximum, contre une cinquantaine de personnes pour la formule en bus. En mini-bus, l'excursion est aussi majoritairement francophone, alors qu'en bus toutes les nationalités sont mélangées. Le tarif pour la formule en mini-bus est de 85 € par personne.";

// "Le Caire en mini-bus" a un champ requis catalogue "Proposer upgrade Le
// Caire en mini-bus VIP" — au lieu de la case à cocher générique, on
// affiche une alerte qui bascule directement l'activité sur le catalogue
// VIP (avec Grand Egyptian Museum) en un clic (voir rendu dans "specifs").
export const CAIRE_MINIBUS_VIP_CHAMP = "Proposer upgrade Le Caire en mini-bus VIP";
export function isCaireMiniBusBase(nom?: string) {
  return (nom || "").trim().toLowerCase() === "le caire en mini-bus";
}
export function isCaireMiniBusVip(nom?: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("caire en mini-bus") && n.includes("vip");
}

export function isAdultsOnly(client: Client) {
  return (client.enfants || 0) === 0 && (client.bebes || 0) === 0;
}

export const SAFARI_ADULTS_TEXT =
  "Le Grand Safari Bédouin est une activité pensée pour les familles avec enfants, avec des temps d'activité très courts (30 min de quad, 15 min de buggy). Pour des adultes, nous recommandons plutôt l'excursion quad classique de 2h : vous en profiterez beaucoup plus, tout en découvrant vous aussi le village bédouin. Vous pouvez même combiner l'excursion quad avec le dîner spectacle, pour le même tarif que le Grand Safari Bédouin.";

// Le titre affiché (nom_activite) se recalcule à chaque étape qui le
// concerne (île / moment / créneau), toujours à partir du nom catalogue de
// base — jamais en concaténant sur le titre déjà modifié, pour rester
// idempotent si l'employée revient en arrière et change sa réponse.
export function baseTitleFor(catalogueItem: CatalogueItem, ileSelectionnee: string, ileSelectionnee2?: string) {
  const iType = speedboatIleType(catalogueItem.nom);
  return iType && ileSelectionnee
    ? speedboatIleTitre(iType, ileSelectionnee, ileSelectionnee2 || undefined)
    : catalogueItem.nom;
}

export function titleWithSuffix(base: string, suffix: string) {
  return suffix ? `${base} — ${suffix}` : base;
}

// Villes proposées pour l'activité générique "Billets d'avion" (vols
// achetés au cas par cas par l'agence, hors trajet fixe Hurghada ↔ Le
// Caire) — "Autre" ouvre un champ libre pour les cas non listés.
export const VILLES_BILLET_AVION = ["Le Caire", "Louxor", "Assouan", "Hurghada", "Autre"] as const;

export function isBilletsAvionGenerique(nom?: string) {
  return (nom || "").trim().toLowerCase() === "billets d'avion";
}

// "Billets d'avion (Hurghada → Le Caire)" — le titre affiché intègre les
// villes choisies pour que l'activité se distingue au premier coup d'œil
// dans l'itinéraire, sans avoir à ouvrir le détail.
export function billetAvionTitle(base: string, villeDepart: string, villeArrivee: string) {
  return villeDepart && villeArrivee ? `${base} (${villeDepart} → ${villeArrivee})` : base;
}
