"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client, HotelReference, TransfertTaxe } from "@/lib/types";
import { normalizeJoursDisponibles } from "@/lib/resa";
import { PROSPECT_STATUTS } from "@/lib/constants";
import { matchHotel, matchTransfertTaxe } from "@/lib/hotelHelp";
import { useToast } from "@/components/ToastProvider";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDDMonth(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${capitalize(d.toLocaleDateString("fr-FR", { month: "long" }))}`;
}

function moisLabelFromDates(dates: string[]) {
  const mois = Array.from(
    new Set(
      dates
        .filter(Boolean)
        .map((d) => capitalize(new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { month: "long" })))
    )
  );
  return mois.join(" - ");
}

const WEEKDAY_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function datesInRange(debut: string, fin: string): string[] {
  const dates: string[] = [];
  if (!debut || !fin) return dates;
  const d = new Date(debut + "T00:00:00");
  const end = new Date(fin + "T00:00:00");
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Âges libres saisis par l'employée ou déduits de Kommo (ex. "6, 9 et 14
// ans") — on n'en tire que les nombres, jamais de logique métier plus fine
// (aucun champ structuré d'âge minimum n'existe sur le catalogue).
function extractAges(text: string): number[] {
  const matches = text.match(/\d{1,2}/g);
  return matches ? matches.map(Number) : [];
}

// Aucun champ structuré de durée n'existe sur le catalogue ("duree" vaut
// juste "Plusieurs jours") — le nombre de jours est toujours écrit dans le
// nom ("5 jours et 4 nuits", ou "1 jour visites & 1 jour Montgolfière" =
// 2 jours au total). On additionne toutes les mentions "N jour(s)"
// trouvées ; si aucune n'est trouvée, la durée est jugée trop incertaine
// pour être auto-planifiée (l'activité reste ajoutable à la main).
function parseDureeJours(nom: string): number | null {
  const matches = nom.match(/(\d+)\s*jours?/gi);
  if (!matches || matches.length === 0) return null;
  const total = matches.reduce((s, m) => s + (parseInt(m, 10) || 0), 0);
  return total > 0 ? total : null;
}

// "Louxor 1 jour (déjà sur place)" veut dire pour un client déjà logé à
// Louxor — proposer ça à un client côté Hurghada (Makadi, Sahl Hasheesh...)
// n'a aucun sens, il lui faut la version "depuis Hurghada" (en mini-bus, en
// voiture privée...) à la place. Retourne la ville concernée, ou null si
// l'activité n'est pas une variante "déjà sur place".
function dejaSurPlaceVille(nom: string): string | null {
  const m = nom.match(/^(.+?)\s+\d.*\(déjà sur place\)/i);
  return m ? m[1].trim() : null;
}

// Même logique que dejaSurPlaceVille pour l'autre tournure catalogue
// ("Louxor 2 jours Montgolfière (depuis Louxor et transfert vers
// Hurghada)") : le circuit part physiquement de cette ville-là, il ne
// convient qu'à un client déjà sur place. Sans ce filtre, un client basé à
// Hurghada se voyait proposer un aller simple depuis Louxor.
function departDepuisVille(nom: string): string | null {
  const m = nom.match(/\(depuis\s+(.+?)\s+et\s+transfert\s+vers/i);
  return m ? m[1].trim() : null;
}

// Pour varier le programme plutôt que d'enchaîner deux journées "mer"
// (îles, plongée, catamaran...) ou deux journées "désert" (quad, buggy,
// safari...) d'affilée — seuls ces deux tags catalogue sont assez fiables
// pour ranger une activité dans l'une ou l'autre catégorie ; le reste
// (culture, transferts, spa...) n'entre pas dans cette logique.
function categorieMerDesert(item: CatalogueItem): "mer" | "desert" | null {
  const tags = item.tags || [];
  if (tags.includes("Activités en mer")) return "mer";
  if (tags.includes("Activités désert")) return "desert";
  return null;
}

// Tags qui désignent une destination/un grand thème de séjour plutôt qu'un
// simple type d'activité — une fois couverts par une activité choisie (en
// particulier un séjour multi-jours), on ne repropose pas une deuxième
// activité sur la même destination (ex. une croisière Louxor-Assouan couvre
// déjà Louxor, inutile de reproposer du Louxor à côté).
const DESTINATION_TAGS = new Set([
  "Louxor",
  "Assouan",
  "Assouan & Abu Simbel",
  "Le Caire",
  "Siwa",
  "Croisière",
  "Marsa Alam",
  "Circuits",
]);

// "Le Caire et/ou Louxor" dans un résumé Kommo peut vouloir dire deux
// choses très différentes pour le programme : des excursions à la journée
// depuis Hurghada, ou un circuit multi-villes (vol vers Le Caire, tournée
// Caire/Louxor). Rien dans les envies ne permet de trancher, et proposer
// l'un plutôt que l'autre au hasard serait faux une fois sur deux — on
// détecte le cas et on laisse l'employée choisir (cf. popupAmbiguite dans
// le composant) plutôt que de deviner.
function detecterAmbiguiteCircuit(
  catalogue: CatalogueItem[],
  interets: string
): { villes: string[] } | null {
  const texte = interets.toLowerCase();
  if (!/caire/.test(texte) || !/louxor/.test(texte)) return null;
  const circuitExiste = catalogue.some(
    (a) =>
      a.valide &&
      a.categorie === "Séjour multi-jours" &&
      (a.tags || []).includes("Circuits") &&
      /caire/i.test(a.nom) &&
      /louxor/i.test(a.nom)
  );
  return circuitExiste ? { villes: ["Le Caire", "Louxor"] } : null;
}

let ligneSeq = 0;
function nextLigneId() {
  ligneSeq += 1;
  return `l${ligneSeq}`;
}

type Ligne = {
  id: string;
  catalogueItemId: string;
  nom: string;
  date: string;
  prixParPersonne: number;
  nbPersonnes: number;
  remise: number;
  remiseLabel: string;
  taxeTransfert: number;
};

// Construit le message texte envoyé au client tel quel (copié-collé
// WhatsApp) — le format a été fourni par Mélanie et ne doit pas être
// réinterprété : "📍date / nom / prix par personne (N) / [remise] /
// ➡️Total". Un seul bloc par activité, dans l'ordre chronologique.
// Quand la date précise d'une ligne n'est pas connue (pas de dates de
// séjour saisies), "Date à définir" ne dit rien à l'employée sur l'ordre
// ni la contrainte de jour de l'activité — "Jour N" (sa position dans le
// programme) suivi de sa disponibilité catalogue (tous les jours, ou
// seulement certains) est plus exploitable pour caler ensuite les vraies
// dates.
function libelleJourIndefini(item: CatalogueItem | undefined, n: number): string {
  const jours = item ? normalizeJoursDisponibles(item.jours_disponibles) : [];
  // Certaines fiches catalogue listent les 7 jours au lieu de laisser le
  // champ vide — ça veut dire la même chose ("tous les jours"), pas la
  // peine d'énumérer.
  const dispo = jours.length === 0 || jours.length >= 7 ? "tous les jours" : `uniquement ${jours.join(", ")}`;
  return `Jour ${n} (${dispo})`;
}

function buildProgrammeText(
  moisLabel: string,
  nbPersonnes: number,
  hotel: string,
  lignes: Ligne[],
  catalogue: CatalogueItem[]
) {
  const parts: string[] = [];
  parts.push("Voici ce que nous pouvons vous proposer si vous souhaitez réaliser ces activités :");
  parts.push("");
  parts.push(`Séjour ${moisLabel || "—"} :`);
  parts.push(`${nbPersonnes} personnes`);
  if (hotel) parts.push(hotel);

  const sorted = [...lignes]
    .filter((l) => l.nom.trim())
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99"));

  let jourIndefiniCompteur = 0;
  sorted.forEach((l) => {
    const total = Math.max(l.prixParPersonne * l.nbPersonnes - (l.remise || 0) + (l.taxeTransfert || 0), 0);
    parts.push("");
    if (l.date) {
      parts.push(`📍${fmtDDMonth(l.date)}`);
    } else {
      jourIndefiniCompteur += 1;
      const item = catalogue.find((a) => a.id === l.catalogueItemId);
      parts.push(`📍${libelleJourIndefini(item, jourIndefiniCompteur)}`);
    }
    parts.push(l.nom);
    parts.push(`${euros(l.prixParPersonne)} euros par personne (${l.nbPersonnes})`);
    if (l.remise > 0) parts.push(`Remise -${euros(l.remise)} euros (${l.remiseLabel || "geste commercial"})`);
    if (l.taxeTransfert > 0) parts.push(`+ Taxe de transfert : ${euros(l.taxeTransfert)} euros`);
    parts.push(`➡️Total : ${euros(total)} euros`);
  });

  return parts.join("\n");
}

// Le générateur propose un premier jet de programme à la place de
// l'employée — il ne remplace jamais sa décision finale (tout reste
// modifiable/supprimable avant envoi), mais lui évite de rouvrir le
// catalogue entier à chaque prospect.
function suggererProgramme({
  catalogue,
  dateDebut,
  dateFin,
  nbAdultes,
  nbEnfants,
  agesEnfants,
  interets,
  activitesAEviter,
  villeClient,
  taxeTransfertMontant,
  preferenceCircuit,
}: {
  catalogue: CatalogueItem[];
  dateDebut: string;
  dateFin: string;
  nbAdultes: number;
  nbEnfants: number;
  agesEnfants: string;
  interets: string;
  activitesAEviter: string;
  villeClient: string;
  taxeTransfertMontant: number;
  // Résolution de l'ambiguïté Caire/Louxor (cf. detecterAmbiguiteCircuit) —
  // null tant que l'employée n'a pas répondu au popup.
  preferenceCircuit: "excursions" | "circuit" | null;
}): { lignes: Ligne[]; activitesTarifGroupeIgnorees: string[] } {
  const nbPersonnes = nbAdultes + nbEnfants;
  const ages = extractAges(agesEnfants);
  const hasAdos = ages.some((a) => a >= 12 && a <= 17);
  const hasJeunesEnfants = ages.some((a) => a < 12) || (nbEnfants > 0 && ages.length === 0);
  const hasEnfants = nbEnfants > 0;

  // Kommo écrit parfois une envie avec une note entre parenthèses ("Caire en
  // avion (GEM)", "Louxor (hésite)") — exiger que le segment entier
  // apparaisse tel quel dans le nom catalogue ratait tout dès qu'il y avait
  // cette annotation. On compare maintenant mot par mot (mots vides
  // ignorés) : le segment matche si tous ses mots significatifs se
  // retrouvent dans le nom/catégorie/tags de l'activité.
  const MOTS_VIDES = new Set([
    "de", "du", "des", "le", "la", "les", "en", "et", "un", "une", "à", "a", "au",
    "aux", "avec", "sur", "pour", "dans", "ou", "d", "l", "the",
    // "nage" n'existe dans le catalogue que sur la variante bassin ("Nage
    // avec les dauphins (en bassin)") — l'exiger empêchait "Maison des
    // dauphins" (milieu naturel) de matcher "nage avec les dauphins", alors
    // que c'est très majoritairement ce que veut dire un prospect qui
    // écrit ça, sauf s'il précise "bassin"/"captivité" (cf. plus bas).
    "nage",
  ]);
  // Un employé (ou Kommo) tape rarement les accents avec constance
  // ("diner" pour "dîner") — sans ça, une envie comme "safari quad avec
  // diner spectacle" ne matchait jamais "Safari quad & dîner spectacle"
  // (le mot "diner" n'existe littéralement nulle part dans le catalogue,
  // seul "dîner" y figure) et se faisait donc ignorer comme mot inconnu.
  const deaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokenize = (texte: string): string[] =>
    deaccent(texte)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((m) => m.trim())
      // >1 et non >2 : une durée comme "4h" ne fait que 2 caractères mais
      // distingue "Speedboat privé (4h)" de la version journée complète —
      // la perdre revenait à ne plus savoir laquelle des deux proposer.
      .filter((m) => m.length > 1 && !MOTS_VIDES.has(m));
  // Ne plus retirer le contenu entre parenthèses ici : une note Kommo pure
  // ("hésite", "GEM" — déjà traité par ALIAS_ENVIES plus bas) est de toute
  // façon écartée ensuite par le filtre catalogueVocab (mot inconnu du
  // catalogue). Mais une parenthèse peut aussi contenir un vrai nom de
  // lieu précis ("île snorkeling (Ozirea)") — le supprimer aveuglément
  // perdait cette info alors que "Oziréa Island" existe bien au catalogue.
  const motsSignificatifs = (segment: string): string[] => tokenize(segment);

  // Kommo ne sépare pas toujours deux envies distinctes par une virgule
  // (ex. "Speedboat White Island + Hula Hula" — deux activités du catalogue
  // différentes écrites comme un seul segment) — on coupe aussi sur "+",
  // "/" et " et " pour que chaque envie ait une chance d'être isolée.
  const SEPARATEURS_SEGMENTS = /\s*(?:,|\+|\/|&|\bet\b)\s*/gi;

  // Vocabulaire de tous les mots significatifs du catalogue (noms,
  // catégories, tags) — le catalogue ne nomme ses excursions que par ville
  // + moyen de transport ("Le Caire en avion"), jamais par monument. Une
  // envie écrite "Excursion Pyramides du Caire" ne matchera donc jamais mot
  // à mot : "pyramides" n'existe nulle part dans le catalogue. On ignore ces
  // mots hors-catalogue plutôt que de laisser un seul mot inconnu faire
  // échouer tout le groupe alors que "excursion" et "caire" suffisaient.
  // Contrairement à motsSignificatifs (utilisé sur les envies du prospect),
  // on ne retire pas les parenthèses ici : certains noms catalogue précisent
  // l'info distinctive dedans (ex. "Paradise Island (côté Hula Hula)"), et
  // c'est exactement ce texte-là (hay, plus bas) qui sert au matching final.
  const catalogueVocab = new Set<string>();
  catalogue.forEach((item) => {
    tokenize([item.nom, item.categorie, ...(item.tags || [])].join(" ")).forEach((m) =>
      catalogueVocab.add(m)
    );
  });

  // Certains lieux connus des prospects (plage, spot précis...) n'apparaissent
  // jamais tels quels dans le catalogue, qui ne nomme ses activités que par
  // ville/thème générique — "Abu Dabbab" (la plage aux tortues de Marsa Alam)
  // n'existe nulle part dans les noms/tags catalogue, donc le mot ne matche
  // rien. On le réécrit vers le vocabulaire catalogue avant tokenisation.
  // "GEM" (Grand Egyptian Museum) ne doit pas devenir une exigence de mot
  // au même titre que les autres — sinon on écarterait "Le Caire en avion"
  // ou "en voiture privée" quand ce moyen de transport précis est demandé
  // en plus du GEM, alors que ces formules incluent aussi le musée. On
  // retire juste la mention (comme une parenthèse Kommo) et on note à part
  // si le GEM a été demandé, pour orienter par défaut vers la formule qui
  // le nomme explicitement ("Le Caire en mini-bus ViP") — cf. plus bas.
  const demandeGEM = /\bgem\b|grand\s+egyptian\s+museum/i.test(interets);
  const ALIAS_ENVIES: [RegExp, string][] = [
    [/abu\s*dabbab/gi, "tortues Marsa Alam"],
    [/\(?\s*gem\s*\)?/gi, " "],
  ];
  const appliquerAlias = (texte: string) =>
    ALIAS_ENVIES.reduce((acc, [motif, remplacement]) => acc.replace(motif, remplacement), texte);

  const groupesFromText = (texte: string): string[][] =>
    appliquerAlias(texte)
      .split(SEPARATEURS_SEGMENTS)
      .map((seg) => motsSignificatifs(seg).filter((m) => catalogueVocab.has(m)))
      .filter((g) => g.length > 0);

  const groupesInteret = groupesFromText(interets);
  const groupesAEviter = groupesFromText(activitesAEviter);

  const jours = datesInRange(dateDebut, dateFin);
  const joursSemaineDispo = new Set(jours.map((d) => WEEKDAY_FR[new Date(d + "T00:00:00").getDay()]));

  // Sous-chaîne plutôt que mot exact : "privé" comme substring matchait
  // aussi "semi-privé" (qui le contient littéralement), un client demandant
  // un speedboat "privé" se voyait donc proposer une formule "semi-privé"
  // (avec d'autres clients à bord) — pas du tout ce qui était demandé. On
  // compare maintenant aux mots du catalogue tokenisés (le tiret garde les
  // mots composés soudés, "semi-privé" reste un seul token différent de
  // "privé"), avec juste une tolérance de préfixe pour le pluriel français
  // ("île" doit quand même matcher le tag "Les îles").
  const matchGroupes = (item: CatalogueItem, groupes: string[][]) => {
    if (groupes.length === 0) return false;
    const hayMots = tokenize([item.nom, item.categorie, ...(item.tags || [])].join(" "));
    return groupes.some((mots) => mots.every((m) => hayMots.some((h) => h === m || h.startsWith(m))));
  };

  // Certains tags désignent un supplément optionnel qui s'ajoute à une
  // simple visite de destination (montgolfière, croisière) plutôt qu'un
  // type d'activité comme les autres — un intérêt générique pour la
  // destination ("Louxor") ne doit jamais suffire à les proposer, sinon on
  // se retrouve à suggérer une montgolfière (ou une croisière à 800€+) que
  // le prospect n'a jamais demandée juste parce qu'elle couvre la même
  // ville. Il faut que le mot lui-même apparaisse dans ses envies.
  const TAGS_PREMIUM_REQUIS = ["Montgolfière", "Croisière"];
  const motsInteretTous = new Set(groupesInteret.flat());

  // Certaines formules existent en version "déconseillée" à côté d'une
  // version recommandée par l'agence (le bus pour Louxor/Le Caire — moins
  // confortable que le mini-bus ; les dauphins "en bassin"/captivité — la
  // plupart des prospects qui disent "nager avec les dauphins" pensent au
  // milieu naturel). On ne les propose jamais par défaut, seulement si le
  // prospect l'a explicitement demandée.
  // Préfixes plutôt que mots exacts : "certifiés"/"certifiée"/"confirmés"
  // s'accordent en genre/nombre selon la phrase, un Set.has() sur le mot
  // exact ratait "certifies" (pluriel) quand seul "certifie" était listé.
  const contientMotCommencantPar = (mots: Set<string>, prefixes: string[]) =>
    prefixes.some((p) => Array.from(mots).some((m) => m.startsWith(p)));
  const VARIANTES_DECONSEILLEES: { estConcerne: (item: CatalogueItem) => boolean; prefixesRequis: string[] }[] = [
    { estConcerne: (item) => /\ben bus\b/i.test(item.nom), prefixesRequis: ["bus"] },
    {
      estConcerne: (item) => /\(en bassin\)|dolphin world/i.test(item.nom),
      // motsInteretTous est désaccentué (cf. tokenize/deaccent) — inutile
      // d'y lister une forme accentuée, elle ne matcherait jamais.
      prefixesRequis: ["bassin", "captivit", "parc", "piscine"],
    },
    // Par défaut on suppose toujours des débutants — la plongée
    // "professionnels" (déjà certifiés, avec niveau) n'est proposée que si
    // le résumé/les envies indiquent explicitement que ce sont des
    // plongeurs confirmés, sinon c'est systématiquement l'initiation.
    {
      estConcerne: (item) => /professionnels/i.test(item.nom),
      prefixesRequis: ["certifi", "profession", "pro", "niveau", "confirm"],
    },
  ];
  const matchInteret = (item: CatalogueItem) => {
    if (!matchGroupes(item, groupesInteret)) return false;
    const tagsPremium = (item.tags || []).filter((t) => TAGS_PREMIUM_REQUIS.includes(t));
    if (!tagsPremium.every((t) => tokenize(t).every((m) => motsInteretTous.has(m)))) return false;
    const variantesConcernees = VARIANTES_DECONSEILLEES.filter((v) => v.estConcerne(item));
    return variantesConcernees.every((v) => contientMotCommencantPar(motsInteretTous, v.prefixesRequis));
  };
  const matchEviter = (item: CatalogueItem) => matchGroupes(item, groupesAEviter);

  // Une envie peut correspondre à une activité tarifée "au groupe" (bateau
  // privatisé : prix au bateau, pas par personne) — exclue plus bas de la
  // suggestion auto faute de pu_adulte exploitable. Sans ce repérage,
  // l'employée ne sait jamais qu'une correspondance existait et pense que
  // le générateur n'a rien trouvé alors qu'il a juste dû l'écarter.
  const activitesTarifGroupeIgnorees = catalogue
    .filter((a) => a.valide)
    .filter((a) => a.categorie !== "Transfert")
    .filter((a) => a.tarif_mode === "groupe")
    .filter((a) => matchInteret(a))
    .map((a) => a.nom);

  const candidats = catalogue
    .filter((a) => a.valide)
    .filter((a) => a.categorie !== "Transfert")
    // Les activités au tarif "groupe" (bateau privatisé, prix au bateau et
    // non par personne) n'ont pas de pu_adulte exploitable — le message
    // généré est toujours au format "X € par personne", donc on les laisse
    // à l'ajout manuel plutôt que d'afficher un prix à 0€.
    .filter((a) => a.tarif_mode === "personne")
    // Un refus explicite du prospect prime sur tout le reste — jamais
    // proposée, quel que soit le score.
    .filter((a) => !matchEviter(a))
    // "(déjà sur place)" ne concerne que les clients déjà logés dans la
    // ville de l'excursion elle-même — sinon il faut la version "depuis
    // Hurghada" (en mini-bus, en voiture privée...). Exception : un circuit
    // Caire/Louxor (cf. popup d'ambiguïté ci-dessous) amène justement le
    // prospect physiquement dans ces deux villes, "déjà sur place" y
    // redevient donc pertinent même si son hôtel est ailleurs.
    .filter((a) => {
      const ville = dejaSurPlaceVille(a.nom) || departDepuisVille(a.nom);
      if (!ville) return true;
      if (preferenceCircuit === "circuit" && (ville === "Le Caire" || ville === "Louxor")) return true;
      return ville.toLowerCase() === villeClient.trim().toLowerCase();
    })
    // Ambiguïté Caire/Louxor tranchée par l'employée (popup) : soit des
    // excursions payantes à la journée depuis Hurghada, soit un circuit —
    // le prospect est alors déjà sur place, les excursions "depuis
    // Hurghada" (en bus/mini-bus/avion/voiture) n'ont plus lieu d'être,
    // seules les variantes "(déjà sur place)" (débloquées ci-dessus) le
    // remplacent. Sans ce tri les deux itinéraires, incompatibles,
    // pouvaient se mélanger.
    .filter((a) => {
      if (preferenceCircuit !== "circuit") return true;
      const estExcursionDepuisHurghada =
        a.categorie === "Excursion" &&
        ((a.tags || []).includes("Le Caire") || (a.tags || []).includes("Louxor")) &&
        !/déjà sur place/i.test(a.nom);
      return !estExcursionDepuisHurghada;
    })
    .map((item) => {
      const joursItem = normalizeJoursDisponibles(item.jours_disponibles);
      const disponibleSurSejour =
        joursItem.length === 0 || jours.length === 0 || joursItem.some((j) => joursSemaineDispo.has(j));
      const enfantsFriendly = (item.tags || []).includes("Enfants");
      const isMultiJour = item.categorie === "Séjour multi-jours";
      // Durée inconnue (nom sans mention de nombre de jours) : trop risqué
      // de deviner combien de jours bloquer sur le séjour, on laisse ces
      // circuits à l'ajout manuel plutôt que de mal les placer.
      const dureeJours = isMultiJour ? parseDureeJours(item.nom) : 1;

      const interetMatch = matchInteret(item);
      // La marge sert de départage, jamais de critère principal — le
      // programme doit d'abord refléter ce que le prospect a dit vouloir
      // faire, pas ce qui rapporte le plus à l'agence.
      let score = (item.marge_pct || 0) * 0.2;
      if (interetMatch) score += 50;
      if (hasJeunesEnfants && enfantsFriendly) score += 20;
      if (hasJeunesEnfants && !enfantsFriendly && item.pu_enfant === 0 && item.pu_adulte > 0) score -= 15;
      if (hasAdos && (item.categorie === "Excursion" || item.categorie === "Séjour multi-jours")) score += 5;
      // GEM demandé sans moyen de transport précisé : on départage vers la
      // formule qui l'inclut explicitement plutôt que le simple mini-bus.
      if (demandeGEM && item.nom.includes("Grand Egyptian Museum")) score += 8;
      // Kommo sépare parfois en plusieurs segments ce qui est en fait une
      // seule envie précise ("safari quad" + "dîner spectacle" plutôt que
      // "safari quad avec dîner spectacle" en un seul bloc). Une activité
      // qui répond à PLUSIEURS groupes d'un coup est presque toujours la
      // bonne réponse la plus précise — sans ce bonus, "Safari Quad Makadi"
      // (générique) pouvait être choisi pour le groupe "safari quad" avant
      // que "dîner spectacle" n'ait sa chance, et la dédup "un seul désert
      // par séjour" empêchait ensuite "Safari quad & dîner spectacle"
      // d'être proposé du tout.
      const nbGroupesSatisfaits = groupesInteret.filter((g) => matchGroupes(item, [g])).length;
      if (nbGroupesSatisfaits > 1) score += (nbGroupesSatisfaits - 1) * 100;

      const prixParPersonne = item.pu_adulte || 0;
      const destinationTags = (item.tags || []).filter((t) => DESTINATION_TAGS.has(t));
      const categorieMD = categorieMerDesert(item);

      return {
        item,
        score,
        disponibleSurSejour,
        joursItem,
        prixParPersonne,
        dureeJours,
        destinationTags,
        categorieMD,
        interetMatch,
        nbGroupesSatisfaits,
      };
    })
    // Ne jamais suggérer une activité que le prospect n'a pas demandée —
    // le générateur propose, il n'invente pas d'envies à sa place. Sans
    // aucune envie exprimée dans la conversation, il ne propose donc rien
    // automatiquement (l'employée ajoute alors à la main).
    .filter((c) => c.disponibleSurSejour && c.dureeJours !== null && c.interetMatch)
    .sort((a, b) => b.score - a.score);

  const usedDates = new Set<string>();
  const usedCatalogueIds = new Set<string>();
  // Comparaison par inclusion (pas d'égalité stricte) car deux tags
  // désignant la même destination ne s'écrivent pas toujours pareil
  // ("Assouan" vs "Assouan & Abu Simbel") — l'un doit quand même bloquer
  // l'autre.
  const usedDestinationTags: string[] = [];
  const destinationDejaCouverte = (tags: string[]) =>
    tags.some((t) =>
      usedDestinationTags.some(
        (u) => t.toLowerCase().includes(u.toLowerCase()) || u.toLowerCase().includes(t.toLowerCase())
      )
    );
  // Les activités "désert" (quad, buggy, safari jeep...) sont des variantes
  // très proches d'une même expérience — en proposer deux dans le même
  // séjour fait doublon plutôt que varier le programme. Une seule suffit,
  // contrairement à "mer" où deux îles différentes restent deux vraies
  // propositions distinctes.
  let desertDejaPropose = false;
  // Deux excursions culturelles (Louxor, Le Caire, Assouan...) à la suite
  // font une journée de trop dans le bus pour la famille — jamais deux
  // jours consécutifs, contrairement aux autres catégories.
  const usedDatesCulture = new Set<string>();
  // Pour varier le séjour (mer/désert, ou plus largement mer/terre), on
  // retient la catégorie posée à chaque date — sert juste à préférer une
  // date qui alterne avec la veille, jamais à bloquer un placement s'il
  // n'y a pas de meilleure option (contrairement à la règle Culture,
  // stricte celle-là).
  const categorieParDate = new Map<string, "mer" | "desert">();
  const lignes: Ligne[] = [];

  const placer = (c: (typeof candidats)[number], date: string) => {
    if (jours.length > 0) {
      const startIdx = jours.indexOf(date);
      for (let k = 0; k < (c.dureeJours || 1); k++) {
        usedDates.add(jours[startIdx + k]);
        if ((c.item.tags || []).includes("Culture")) usedDatesCulture.add(jours[startIdx + k]);
        if (c.categorieMD) categorieParDate.set(jours[startIdx + k], c.categorieMD);
      }
    }
    c.destinationTags.forEach((t) => usedDestinationTags.push(t));
    usedCatalogueIds.add(c.item.id);
    if (c.categorieMD === "desert") desertDejaPropose = true;
    lignes.push({
      id: nextLigneId(),
      catalogueItemId: c.item.id,
      nom: c.item.nom,
      date,
      prixParPersonne: c.prixParPersonne,
      nbPersonnes: nbPersonnes || 2,
      remise: 0,
      remiseLabel: "",
      taxeTransfert: taxeTransfertMontant,
    });
  };

  // Cherche la première date libre pour ce candidat (bloc de dureeJours
  // jours consécutifs, en respectant ses jours de disponibilité) — ou null
  // si aucune date ne convient. Sans dates de séjour connues, seules les
  // activités d'un jour peuvent être placées (pas de date précise).
  const trouverDateLibre = (c: (typeof candidats)[number]): string | null => {
    const dureeJours = c.dureeJours || 1;
    if (jours.length === 0) return dureeJours === 1 ? "" : null;
    const estCulture = (c.item.tags || []).includes("Culture");
    const datesValides = jours
      .map((d, idx) => ({ d, idx }))
      .filter(({ d, idx }) => {
        if (usedDates.has(d)) return false;
        if (c.joursItem.length > 0 && !c.joursItem.includes(WEEKDAY_FR[new Date(d + "T00:00:00").getDay()])) {
          return false;
        }
        if (idx + dureeJours > jours.length) return false;
        for (let k = 0; k < dureeJours; k++) {
          if (usedDates.has(jours[idx + k])) return false;
        }
        if (estCulture) {
          const veille = jours[idx - 1];
          const lendemain = jours[idx + dureeJours];
          if ((veille && usedDatesCulture.has(veille)) || (lendemain && usedDatesCulture.has(lendemain))) {
            return false;
          }
        }
        return true;
      });
    if (datesValides.length === 0) return null;
    // Parmi les dates valides, on préfère celle qui varie par rapport à la
    // veille (mer après désert, désert après mer) — sans jamais bloquer le
    // placement si aucune ne s'y prête, contrairement à la règle Culture.
    if (c.categorieMD) {
      const alternee = datesValides.find(({ idx }) => categorieParDate.get(jours[idx - 1]) !== c.categorieMD);
      if (alternee) return alternee.d;
    }
    return datesValides[0].d;
  };

  // Une activité par envie distincte exprimée — ni plus (pour ne pas noyer
  // le programme sous plusieurs variantes très proches d'une même envie,
  // ex. quatre îles différentes alors qu'une seule "îles" a été demandée),
  // ni moins (tout ce qui a été demandé doit se retrouver dans le
  // programme écrit, cf. Louxor oublié faute de place quand un plafond
  // arbitraire coupait la liste avant d'y arriver). Les groupes qui
  // matchent en priorité une activité multi-jours (croisière, circuit...)
  // sont traités en premier : ils bloquent plusieurs jours d'un coup, mieux
  // vaut leur laisser le choix de la date avant que les activités d'un
  // jour ne fragmentent le calendrier.
  const groupesOrdonnes = groupesInteret
    .map((groupe, idx) => ({
      idx,
      matches: candidats.filter((c) => matchGroupes(c.item, [groupe])).sort((a, b) => b.score - a.score),
    }))
    .sort((a, b) => {
      const aMulti = (a.matches[0]?.dureeJours || 1) > 1 ? 0 : 1;
      const bMulti = (b.matches[0]?.dureeJours || 1) > 1 ? 0 : 1;
      return aMulti !== bMulti ? aMulti - bMulti : a.idx - b.idx;
    });

  for (const { matches } of groupesOrdonnes) {
    if (matches.length === 0) continue;
    // Si la meilleure réponse à ce groupe répondait déjà à un autre groupe
    // en même temps (score boosté plus haut) et a donc déjà été placée,
    // c'était une seule envie combinée exprimée en deux segments — pas la
    // peine de chercher une deuxième activité de repli pour "compléter"
    // ce groupe, elle n'a pas été demandée séparément.
    if (usedCatalogueIds.has(matches[0].item.id) && matches[0].nbGroupesSatisfaits > 1) continue;
    const disponibles = matches.filter(
      (c) =>
        !usedCatalogueIds.has(c.item.id) &&
        !destinationDejaCouverte(c.destinationTags) &&
        !(desertDejaPropose && c.categorieMD === "desert")
    );
    for (const c of disponibles) {
      const date = trouverDateLibre(c);
      if (date === null) continue;
      placer(c, date);
      break;
    }
  }

  return { lignes, activitesTarifGroupeIgnorees };
}

// Mêmes villes que HelpView (référence hôtels) — Autre en dernier pour la
// saisie libre quand aucune des zones connues ne convient.
const VILLES = [
  "Hurghada",
  "El Gouna",
  "Makadi Bay",
  "Soma Bay",
  "Sahl Hasheesh",
  "Marsa Alam",
  "Le Caire",
  "Louxor",
  "Assouan",
  "Autre",
];

export default function GeneratorView({
  catalogue,
  clients,
}: {
  catalogue: CatalogueItem[];
  clients: Client[];
}) {
  const supabase = createClient();
  const toast = useToast();

  const prospects = clients.filter((c) => PROSPECT_STATUTS.includes(c.statut));

  const [prospectId, setProspectId] = useState("");
  const [moisLabelOverride, setMoisLabelOverride] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [adultes, setAdultes] = useState(2);
  const [enfants, setEnfants] = useState(0);
  const [agesEnfants, setAgesEnfants] = useState("");
  const [interets, setInterets] = useState("");
  const [activitesAEviter, setActivitesAEviter] = useState("");
  const [hotel, setHotel] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [picker, setPicker] = useState("");
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [popupAmbiguiteVilles, setPopupAmbiguiteVilles] = useState<string[] | null>(null);
  const [preferenceCircuit, setPreferenceCircuit] = useState<"excursions" | "circuit" | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hotels, setHotels] = useState<HotelReference[]>([]);
  const [transfertTaxes, setTransfertTaxes] = useState<TransfertTaxe[]>([]);
  const [popupHotelInconnu, setPopupHotelInconnu] = useState(false);
  const [nouvelHotelVille, setNouvelHotelVille] = useState("Hurghada");
  const [nouvelHotelVilleAutre, setNouvelHotelVilleAutre] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: t }] = await Promise.all([
        supabase.from("hotels_reference").select("*"),
        supabase.from("transfert_taxes").select("*"),
      ]);
      setHotels((h as HotelReference[]) || []);
      setTransfertTaxes((t as TransfertTaxe[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nbPersonnes = adultes + enfants;

  // Résumé texte de la conversation Kommo — la seule source qui peut
  // contenir une nuance que les champs structurés (dates, envies...) ne
  // captent pas. Affiché en lecture seule pour que l'employée le voie
  // sans devoir rouvrir la fiche prospect à côté.
  const prospectSelectionne = clients.find((c) => c.id === prospectId);
  const resume = prospectSelectionne?.kommo_resume || "";

  // Zone de l'hôtel du prospect (Makadi, Sahl Hasheesh, El Gouna, Soma Bay,
  // Safaga...) et taxe de transfert correspondante — jamais un montant
  // deviné : soit une tranche précise (voir HELP > Taxes de transfert)
  // correspond, soit rien n'est ajouté automatiquement.
  const villeClient = useMemo(() => matchHotel(hotel, hotels)?.ville || "", [hotel, hotels]);
  const taxeResultat = useMemo(
    () => matchTransfertTaxe(transfertTaxes, villeClient, adultes, enfants),
    [transfertTaxes, villeClient, adultes, enfants]
  );
  const taxeTransfertMontant = taxeResultat.type === "montant" ? taxeResultat.montant : 0;

  // Un hôtel non reconnu (donc absent de hotels_reference) empêche de
  // détecter sa zone — la taxe de transfert éventuelle serait alors
  // oubliée silencieusement (cf. matchHotel). On le signale à l'employée
  // (via un événement explicite — saisie ou choix d'un prospect — jamais
  // depuis un effet, cf. règle react-hooks/set-state-in-effect) plutôt que
  // de laisser passer sans rien dire. Ignoré tant que la référence hôtels
  // n'a pas fini de charger, sinon tout hôtel semblerait inconnu.
  const verifierHotelConnu = (valeur: string = hotel) => {
    if (hotels.length > 0 && valeur.trim() && !matchHotel(valeur, hotels)) {
      setNouvelHotelVille("Hurghada");
      setNouvelHotelVilleAutre("");
      setPopupHotelInconnu(true);
    }
  };

  const ajouterHotelInconnu = async () => {
    const ville = nouvelHotelVille === "Autre" ? nouvelHotelVilleAutre.trim() : nouvelHotelVille;
    if (!hotel.trim() || !ville) return;
    const { data, error } = await supabase
      .from("hotels_reference")
      .insert({ nom: hotel.trim(), ville, sur_hurghada: ville === "Hurghada" })
      .select()
      .single();
    if (error || !data) {
      toast("Impossible d'ajouter cet hôtel (déjà présent ?).");
      return;
    }
    setHotels((prev) => [...prev, data as HotelReference]);
    setPopupHotelInconnu(false);
    toast("Hôtel ajouté à la référence.", "success");
  };

  const applyProspect = (id: string) => {
    setProspectId(id);
    // La réponse au popup Caire/Louxor ne vaut que pour le prospect pour
    // lequel elle a été donnée — un autre dossier repart de zéro.
    setPreferenceCircuit(null);
    const c = clients.find((cl) => cl.id === id);
    if (!c) return;
    setDateDebut(c.kommo_sejour_debut_estime || "");
    setDateFin(c.kommo_sejour_fin_estime || "");
    setAdultes(c.kommo_nb_adultes_estime ?? 2);
    setEnfants(c.kommo_nb_enfants_estime ?? 0);
    setAgesEnfants(c.kommo_ages_enfants_estime || "");
    setInterets(c.kommo_activites_interet || "");
    setActivitesAEviter(c.kommo_activites_a_eviter || "");
    const hotelValue = c.kommo_hotel_estime || c.hotel || "";
    setHotel(hotelValue);
    setPopupHotelInconnu(false);
    verifierHotelConnu(hotelValue);
  };

  const lancerGeneration = (preference: "excursions" | "circuit" | null) => {
    if (taxeResultat.type === "a_demander") {
      toast(`Taxe de transfert (${villeClient}) : ${taxeResultat.note} — non ajoutée automatiquement.`);
    }
    const { lignes: suggestions, activitesTarifGroupeIgnorees } = suggererProgramme({
      catalogue,
      dateDebut,
      dateFin,
      nbAdultes: adultes,
      nbEnfants: enfants,
      agesEnfants,
      interets,
      activitesAEviter,
      villeClient,
      taxeTransfertMontant,
      preferenceCircuit: preference,
    });
    if (activitesTarifGroupeIgnorees.length > 0) {
      toast(
        `Correspond aussi à un tarif de groupe (prix au bateau, pas par personne) — à ajouter à la main : ${activitesTarifGroupeIgnorees.join(", ")}.`
      );
    }
    if (suggestions.length === 0) {
      if (activitesTarifGroupeIgnorees.length === 0) {
        toast("Aucune activité du catalogue ne correspond à ces critères — ajoute-les à la main.");
      }
      return;
    }
    setLignes(suggestions);
  };

  const genererAuto = () => {
    // "Le Caire et/ou Louxor" sans savoir si le prospect part en excursions
    // depuis Hurghada ou en circuit multi-villes change complètement le
    // programme — on ne devine pas, on demande à l'employée avant de
    // générer quoi que ce soit.
    if (!preferenceCircuit) {
      const ambiguite = detecterAmbiguiteCircuit(catalogue, interets);
      if (ambiguite) {
        setPopupAmbiguiteVilles(ambiguite.villes);
        return;
      }
    }
    lancerGeneration(preferenceCircuit);
  };

  const choisirOptionAmbiguite = (option: "excursions" | "circuit" | "demander") => {
    setPopupAmbiguiteVilles(null);
    if (option === "demander") {
      toast("Demande d'abord la précision au client avant de générer.");
      return;
    }
    setPreferenceCircuit(option);
    lancerGeneration(option);
  };

  const addLigne = (catalogueItemId: string) => {
    const item = catalogue.find((a) => a.id === catalogueItemId);
    if (!item) return;
    setLignes((prev) => [
      ...prev,
      {
        id: nextLigneId(),
        catalogueItemId: item.id,
        nom: item.nom,
        date: "",
        prixParPersonne: item.pu_adulte || 0,
        nbPersonnes: nbPersonnes || 2,
        remise: 0,
        remiseLabel: "",
        taxeTransfert: taxeTransfertMontant,
      },
    ]);
    setPicker("");
  };

  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLigne = (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  };

  // Les dates exactes du séjour, quand elles sont connues, sont plus
  // utiles au prospect qu'un simple nom de mois — sauf si l'employée a
  // explicitement tapé quelque chose dans "Mois affiché" (reste prioritaire).
  const moisLabel =
    moisLabelOverride ||
    (dateDebut && dateFin ? `du ${fmtDDMonth(dateDebut)} au ${fmtDDMonth(dateFin)}` : "") ||
    moisLabelFromDates(lignes.map((l) => l.date)) ||
    moisLabelFromDates([dateDebut, dateFin]);
  const texte = useMemo(
    () => buildProgrammeText(moisLabel, nbPersonnes, hotel, lignes, catalogue),
    [moisLabel, nbPersonnes, hotel, lignes, catalogue]
  );

  const totalGeneral = lignes.reduce(
    (s, l) => s + Math.max(l.prixParPersonne * l.nbPersonnes - (l.remise || 0) + (l.taxeTransfert || 0), 0),
    0
  );

  const copyTexte = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };

  const addToProspect = async () => {
    if (!prospectId) {
      toast("Choisis un prospect pour y ajouter ces activités.");
      return;
    }
    if (lignes.length === 0) {
      toast("Ajoute au moins une activité au programme.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let creeParNom = "";
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("prenom, email")
        .eq("id", user.id)
        .single();
      creeParNom = prof?.prenom || (prof?.email || "").split("@")[0] || "";
    }
    for (const l of lignes) {
      const item = catalogue.find((a) => a.id === l.catalogueItemId);
      // La remise éventuelle est répercutée sur le prix unitaire pour que
      // le total de la réservation (toujours calculé, jamais saisi à la
      // main — règle métier) reste cohérent avec le total annoncé au client.
      const puEffectif =
        l.remise > 0 ? Math.max(l.prixParPersonne - l.remise / Math.max(l.nbPersonnes, 1), 0) : l.prixParPersonne;
      const { error } = await supabase.from("reservations").insert({
        client_id: prospectId,
        nom_activite: l.nom,
        catalogue_item_id: l.catalogueItemId || null,
        pu_adulte: puEffectif,
        participants_mode: "custom",
        pax_override: `${l.nbPersonnes} personnes`,
        horaire_approx: item?.horaire_approx || "",
        inclus: (item?.inclus_liste || []).join(", ") || item?.inclus || "",
        non_inclus: (item?.non_inclus_liste || []).join(", ") || item?.non_inclus || "",
        a_prevoir: (item?.a_prevoir_liste || []).join(", ") || item?.a_prevoir || "",
        point_rdv: item?.point_rdv || "",
        photo_path: item?.photo_path || "",
        date_debut: l.date || null,
        transfert_inclus: !(l.taxeTransfert > 0),
        transfert_montant: l.taxeTransfert || 0,
        zone_transfert: villeClient,
        cree_par_id: user?.id || null,
        cree_par_nom: creeParNom,
      });
      if (error) {
        toast("Échec de l'ajout d'une activité.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast(`${lignes.length} activité(s) ajoutée(s) au dossier du prospect.`, "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Générateur de programme</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choisis un prospect : le profil déduit de sa conversation (Kommo) préremplit les critères, puis
          « Générer automatiquement » propose un premier programme selon ses envies, son budget familial
          (enfants/ados) et les jours où chaque activité est disponible — à ajuster avant envoi.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <label className="text-xs text-neutral-500">
          Prospect
          <select value={prospectId} onChange={(e) => applyProspect(e.target.value)} className="input mt-1">
            <option value="">— Choisir un prospect —</option>
            {prospects.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom || "Sans nom"}
              </option>
            ))}
          </select>
        </label>

        {resume && (
          <div className="mt-3 rounded-md bg-[#C9973E]/10 p-3 text-sm text-[#8B4531]">
            <span className="font-medium">Résumé Kommo : </span>
            {resume}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-neutral-500">
            Arrivée
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Départ
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Adultes
            <input
              type="number"
              min={0}
              value={adultes}
              onChange={(e) => setAdultes(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Enfants
            <input
              type="number"
              min={0}
              value={enfants}
              onChange={(e) => setEnfants(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500">
            Âges enfants/ados
            <input
              type="text"
              value={agesEnfants}
              onChange={(e) => setAgesEnfants(e.target.value)}
              placeholder="ex. 6, 9 et 14 ans"
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500">
            Hôtel
            <input
              type="text"
              value={hotel}
              onChange={(e) => setHotel(e.target.value)}
              onBlur={() => verifierHotelConnu()}
              className="input mt-1"
            />
            {villeClient && villeClient.toLowerCase() !== "hurghada" && (
              <span className="mt-1 block text-[11px] text-[#8B4531]">
                {taxeResultat.type === "montant" &&
                  `Zone ${villeClient} — taxe de transfert ${euros(taxeTransfertMontant)}€ ajoutée automatiquement à chaque activité.`}
                {taxeResultat.type === "a_demander" && `Zone ${villeClient} — ${taxeResultat.note}.`}
                {taxeResultat.type === "aucune" &&
                  `Zone ${villeClient} — aucune tranche de taxe connue pour ce groupe (voir HELP).`}
              </span>
            )}
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Envies exprimées dans la conversation (séparées par une virgule)
            <input
              type="text"
              value={interets}
              onChange={(e) => {
                setInterets(e.target.value);
                setPreferenceCircuit(null);
              }}
              placeholder="ex. plongée, îles, culture"
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Activités à éviter (séparées par une virgule)
            <input
              type="text"
              value={activitesAEviter}
              onChange={(e) => setActivitesAEviter(e.target.value)}
              placeholder="ex. désert, plongée"
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Mois affiché
            <input
              type="text"
              value={moisLabelOverride}
              onChange={(e) => setMoisLabelOverride(e.target.value)}
              placeholder={moisLabelFromDates([dateDebut, dateFin]) || "Auto"}
              className="input mt-1"
            />
          </label>
        </div>

        <button
          onClick={genererAuto}
          className="mt-3 rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          ✨ Générer automatiquement
        </button>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <button
          type="button"
          onClick={() => setDetailOuvert((v) => !v)}
          className="flex w-full items-center justify-between text-left text-xs font-medium text-neutral-500"
        >
          <span>Activités du programme{lignes.length > 0 ? ` (${lignes.length})` : ""} — modifier à la main</span>
          <span className="text-neutral-400">{detailOuvert ? "▲" : "▼"}</span>
        </button>

        {detailOuvert && (
        <>
        <label className="mt-3 block text-xs text-neutral-500">
          + Ajouter une activité au programme
          <select value={picker} onChange={(e) => addLigne(e.target.value)} className="input mt-1">
            <option value="">— Choisir dans le catalogue —</option>
            {catalogue
              .filter((a) => a.valide)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
          </select>
        </label>

        {lignes.length > 0 && (
          <div className="mt-3 space-y-2">
            {lignes.map((l) => (
              <div key={l.id} className="rounded-md border border-neutral-200 p-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={l.nom}
                    onChange={(e) => updateLigne(l.id, { nom: e.target.value })}
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLigne(l.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
                {/\ben bus\b/i.test(l.nom) && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Déconseillé — formule mini-bus recommandée par l&apos;agence.
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-[11px] text-neutral-500">
                    Date
                    <input
                      type="date"
                      value={l.date}
                      onChange={(e) => updateLigne(l.id, { date: e.target.value })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Prix / personne (€)
                    <input
                      type="number"
                      min={0}
                      value={l.prixParPersonne}
                      onChange={(e) => updateLigne(l.id, { prixParPersonne: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Nb personnes (ligne)
                    <input
                      type="number"
                      min={0}
                      value={l.nbPersonnes}
                      onChange={(e) => updateLigne(l.id, { nbPersonnes: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Remise (€)
                    <input
                      type="number"
                      min={0}
                      value={l.remise}
                      onChange={(e) => updateLigne(l.id, { remise: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Taxe de transfert (€)
                    <input
                      type="number"
                      min={0}
                      value={l.taxeTransfert}
                      onChange={(e) => updateLigne(l.id, { taxeTransfert: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                </div>
                {l.remise > 0 && (
                  <label className="mt-2 block text-[11px] text-neutral-500">
                    Motif de la remise
                    <input
                      type="text"
                      value={l.remiseLabel}
                      onChange={(e) => updateLigne(l.id, { remiseLabel: e.target.value })}
                      placeholder="geste commercial"
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Message à envoyer au prospect</p>
            <span className="rounded-full bg-[#0F5C56]/10 px-2.5 py-1 text-xs font-medium text-[#0F5C56]">
              Total : {euros(totalGeneral)}€
            </span>
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 font-sans text-sm text-[#171717]">
            {texte}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyTexte}
              className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {copied ? "Copié ✓" : "Copier le message"}
            </button>
            <button
              onClick={addToProspect}
              disabled={saving || !prospectId}
              className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Ajout…" : `Ajouter ${lignes.length} activité(s) au dossier du prospect`}
            </button>
          </div>
        </div>
      )}

      {popupAmbiguiteVilles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
            <h2 className="font-heading text-base font-semibold text-[#171717]">
              Le Caire et Louxor — excursions ou circuit ?
            </h2>
            <p className="mt-3 text-sm text-[#171717]">
              Le prospect a mentionné {popupAmbiguiteVilles.join(" et ")} sans qu&apos;on sache s&apos;il compte
              les visiter en excursions à la journée depuis Hurghada, ou en circuit multi-villes (vol vers Le
              Caire, tournée des deux). Le programme proposé sera très différent selon le cas.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => choisirOptionAmbiguite("excursions")}
                className="rounded-md border border-[#171717]/20 px-3 py-2 text-left text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
              >
                Option 1 — Excursions à la journée depuis Hurghada
              </button>
              <button
                type="button"
                onClick={() => choisirOptionAmbiguite("circuit")}
                className="rounded-md border border-[#171717]/20 px-3 py-2 text-left text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
              >
                Option 2 — Circuit multi-villes
              </button>
              <button
                type="button"
                onClick={() => choisirOptionAmbiguite("demander")}
                className="rounded-md bg-[#171717] px-3 py-2 text-left text-sm font-medium text-white hover:opacity-90"
              >
                Option 3 — Je demande au client
              </button>
            </div>
          </div>
        </div>
      )}

      {popupHotelInconnu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
            <h2 className="font-heading text-base font-semibold text-[#171717]">Hôtel non reconnu</h2>
            <p className="mt-3 text-sm text-[#171717]">
              &laquo;&nbsp;{hotel}&nbsp;&raquo; ne correspond à aucun hôtel de la liste de référence — sa
              zone (et une éventuelle taxe de transfert) ne peut donc pas être détectée automatiquement.
              Vérifie l&apos;orthographe, ou ajoute-le à la référence :
            </p>
            <label className="mt-4 block text-xs font-medium text-neutral-500">
              Localisation de &laquo;&nbsp;{hotel}&nbsp;&raquo;
              <select
                value={nouvelHotelVille}
                onChange={(e) => setNouvelHotelVille(e.target.value)}
                className="input mt-1"
              >
                {VILLES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {nouvelHotelVille === "Autre" && (
              <input
                value={nouvelHotelVilleAutre}
                onChange={(e) => setNouvelHotelVilleAutre(e.target.value)}
                placeholder="Nom de la ville"
                className="input mt-2"
              />
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPopupHotelInconnu(false)}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-[#fafafa]"
              >
                Ignorer
              </button>
              <button
                onClick={ajouterHotelInconnu}
                className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Ajouter à la référence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
