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
function buildProgrammeText(moisLabel: string, nbPersonnes: number, hotel: string, lignes: Ligne[]) {
  const parts: string[] = [];
  parts.push("Voici ce que nous pouvons vous proposer si vous souhaitez réaliser ces activités :");
  parts.push("");
  parts.push(`Séjour ${moisLabel || "—"} :`);
  parts.push(`${nbPersonnes} personnes`);
  if (hotel) parts.push(hotel);

  const sorted = [...lignes]
    .filter((l) => l.nom.trim())
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99"));

  sorted.forEach((l) => {
    const total = Math.max(l.prixParPersonne * l.nbPersonnes - (l.remise || 0) + (l.taxeTransfert || 0), 0);
    parts.push("");
    parts.push(`📍${fmtDDMonth(l.date) || "Date à définir"}`);
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
}): { lignes: Ligne[]; activitesTarifGroupeIgnorees: string[] } {
  const nbPersonnes = nbAdultes + nbEnfants;
  const ages = extractAges(agesEnfants);
  const hasAdos = ages.some((a) => a >= 12 && a <= 17);
  const hasJeunesEnfants = ages.some((a) => a < 12) || (nbEnfants > 0 && ages.length === 0);
  const hasEnfants = nbEnfants > 0;

  // Kommo écrit parfois une envie avec une note entre parenthèses ("Caire en
  // avion (GEM)", "Louxor (hésite)") — exiger que le segment entier
  // apparaisse tel quel dans le nom catalogue ratait tout dès qu'il y avait
  // cette annotation. On compare maintenant mot par mot (parenthèses et
  // mots vides ignorés) : le segment matche si tous ses mots significatifs
  // se retrouvent dans le nom/catégorie/tags de l'activité.
  const MOTS_VIDES = new Set([
    "de", "du", "des", "le", "la", "les", "en", "et", "un", "une", "à", "a", "au",
    "aux", "avec", "sur", "pour", "dans", "ou", "d", "l", "the",
  ]);
  const tokenize = (texte: string): string[] =>
    texte
      .toLowerCase()
      .replace(/[^a-zà-öø-ÿ0-9\s-]/g, " ")
      .split(/\s+/)
      .map((m) => m.trim())
      .filter((m) => m.length > 2 && !MOTS_VIDES.has(m));
  const motsSignificatifs = (segment: string): string[] => tokenize(segment.replace(/\([^)]*\)/g, " "));

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
  const ALIAS_ENVIES: [RegExp, string][] = [[/abu\s*dabbab/gi, "tortues Marsa Alam"]];
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

  const matchGroupes = (item: CatalogueItem, groupes: string[][]) => {
    if (groupes.length === 0) return false;
    const hay = [item.nom, item.categorie, ...(item.tags || [])].join(" ").toLowerCase();
    return groupes.some((mots) => mots.every((m) => hay.includes(m)));
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
  const matchInteret = (item: CatalogueItem) => {
    if (!matchGroupes(item, groupesInteret)) return false;
    const tagsPremium = (item.tags || []).filter((t) => TAGS_PREMIUM_REQUIS.includes(t));
    return tagsPremium.every((t) => tokenize(t).every((m) => motsInteretTous.has(m)));
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
    // Hurghada" (en mini-bus, en voiture privée...).
    .filter((a) => {
      const ville = dejaSurPlaceVille(a.nom) || departDepuisVille(a.nom);
      return !ville || ville.toLowerCase() === villeClient.trim().toLowerCase();
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
  const lignes: Ligne[] = [];

  const placer = (c: (typeof candidats)[number], date: string) => {
    if (jours.length > 0) {
      const startIdx = jours.indexOf(date);
      for (let k = 0; k < (c.dureeJours || 1); k++) usedDates.add(jours[startIdx + k]);
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
    const jourDepart = jours.find((d, idx) => {
      if (usedDates.has(d)) return false;
      if (c.joursItem.length > 0 && !c.joursItem.includes(WEEKDAY_FR[new Date(d + "T00:00:00").getDay()])) {
        return false;
      }
      if (idx + dureeJours > jours.length) return false;
      for (let k = 0; k < dureeJours; k++) {
        if (usedDates.has(jours[idx + k])) return false;
      }
      return true;
    });
    return jourDepart ?? null;
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
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hotels, setHotels] = useState<HotelReference[]>([]);
  const [transfertTaxes, setTransfertTaxes] = useState<TransfertTaxe[]>([]);

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

  const applyProspect = (id: string) => {
    setProspectId(id);
    const c = clients.find((cl) => cl.id === id);
    if (!c) return;
    setDateDebut(c.kommo_sejour_debut_estime || "");
    setDateFin(c.kommo_sejour_fin_estime || "");
    setAdultes(c.kommo_nb_adultes_estime ?? 2);
    setEnfants(c.kommo_nb_enfants_estime ?? 0);
    setAgesEnfants(c.kommo_ages_enfants_estime || "");
    setInterets(c.kommo_activites_interet || "");
    setActivitesAEviter(c.kommo_activites_a_eviter || "");
    setHotel(c.kommo_hotel_estime || c.hotel || "");
  };

  const genererAuto = () => {
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

  const moisLabel = moisLabelOverride || moisLabelFromDates(lignes.map((l) => l.date)) || moisLabelFromDates([dateDebut, dateFin]);
  const texte = useMemo(
    () => buildProgrammeText(moisLabel, nbPersonnes, hotel, lignes),
    [moisLabel, nbPersonnes, hotel, lignes]
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
            <input type="text" value={hotel} onChange={(e) => setHotel(e.target.value)} className="input mt-1" />
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
              onChange={(e) => setInterets(e.target.value)}
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
        <label className="text-xs text-neutral-500">
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
    </div>
  );
}
