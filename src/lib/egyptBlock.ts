// Construction du bloc "équipe Égypte" (copié-collé WhatsApp, en anglais) —
// factorisé ici pour que Réservations et la fiche client (onglet Activités)
// produisent EXACTEMENT le même texte, jamais deux versions qui dérivent
// l'une de l'autre au fil des correctifs de traduction.
import {
  Client,
  ClientHotel,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { hotelEgyptLinePourActivite } from "@/lib/hotelHelp";
import {
  activitePaiementWarning,
  chevalChameauBadge,
  isDeuxiemeIleOption,
  momentBadge,
  siteCaireEgyptLine,
} from "@/lib/resa";
import { buildPaxEnglish } from "@/components/client-steps";

export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export function fmtDDMM(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Traduction "au mieux" du vocabulaire métier récurrent (bloc équipe Égypte,
// anglophone) — pas un moteur de traduction, juste les mots qui reviennent
// tout le temps dans les noms d'activités/options. Le reste (noms propres,
// lieux) reste tel quel.
const FR_EN_DICT: [RegExp, string][] = [
  [/déjà sur place/gi, "already on-site"],
  [/aller[- ]retour/gi, "round trip"],
  [/au coucher du soleil/gi, "at sunset"],
  [/au coucher de soleil/gi, "at sunset"],
  [/coucher du soleil/gi, "sunset"],
  [/coucher de soleil/gi, "sunset"],
  [/demi[- ]journée/gi, "half day"],
  [/journée complète/gi, "full day"],
  [/journée/gi, "day"],
  [/jours/gi, "days"],
  [/jour/gi, "day"],
  [/nuits/gi, "nights"],
  [/nuit/gi, "night"],
  [/semi-privé/gi, "semi-private"],
  [/privatif/gi, "private"],
  [/privée?/gi, "private"],
  [/après-midi/gi, "afternoon"],
  [/matin/gi, "morning"],
  [/chevaux/gi, "horses"],
  [/cheval/gi, "horse"],
  [/chameaux/gi, "camels"],
  [/chameau/gi, "camel"],
  [/plongée sous-marine/gi, "scuba diving"],
  [/plongée/gi, "diving"],
  [/randonnée/gi, "hike"],
  [/désert/gi, "desert"],
  [/île/gi, "island"],
  [/maison des dauphins/gi, "dolphin house"],
  [/dauphins/gi, "dolphins"],
  [/nage avec/gi, "swim with"],
  [/bassin/gi, "pool"],
  [/tortues/gi, "turtles"],
  [/visites/gi, "visits"],
  [/balade à/gi, "ride to"],
  [/balade/gi, "ride"],
  [/dîner spectacle/gi, "dinner show"],
  [/dîner/gi, "dinner"],
  [/spectacle/gi, "show"],
  [/bédouin/gi, "bedouin"],
  [/croisière/gi, "cruise"],
  [/montgolfière/gi, "hot air balloon"],
  [/transfert/gi, "transfer"],
  [/\bvers\b/gi, "to"],
  [/aéroport/gi, "airport"],
  [/aléatoire/gi, "random"],
  [/arrêts/gi, "stops"],
  [/voiture/gi, "car"],
  [/avion/gi, "plane"],
  [/mer rouge/gi, "Red Sea"],
  [/\bmer\b/gi, "sea"],
  [/le caire/gi, "Cairo"],
  [/louxor/gi, "Luxor"],
  [/assouan/gi, "Aswan"],
  [/égypte/gi, "Egypt"],
  [/guide francophone/gi, "French-speaking guide"],
  [/guide anglophone/gi, "English-speaking guide"],
  [/\bvol\b/gi, "flight"],
  [/ avec /gi, " with "],
  [/ et /gi, " and "],
  // Filet de sécurité final : les petits mots de liaison français (articles,
  // prépositions) qui traînent encore une fois tout le reste traduit — sans
  // ça un "de"/"des"/"en" isolé restait visible au milieu d'une phrase
  // sinon entièrement en anglais.
  [/\bd'/gi, ""],
  [/\bl'/gi, ""],
  [/\bdes\b/gi, ""],
  [/\bdu\b/gi, ""],
  [/\bde\b/gi, ""],
  [/\ble\b/gi, "the"],
  [/\bla\b/gi, "the"],
  [/\bles\b/gi, "the"],
  [/\ben\b/gi, "in"],
  [/\bau\b/gi, "at"],
  [/\baux\b/gi, "to the"],
  [/\bsur\b/gi, "on"],
  [/\bune\b/gi, "a"],
  [/\bun\b/gi, "a"],
  [/\s{2,}/g, " "],
];

export function translateFr(text: string) {
  let out = text;
  FR_EN_DICT.forEach(([re, repl]) => {
    // Garde la casse du mot d'origine (ex. "Transfert" en début de titre ne
    // doit pas devenir "transfer" en minuscule, ce qui casserait la casse
    // du titre entier).
    out = out.replace(re, (match) =>
      match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()
        ? repl.charAt(0).toUpperCase() + repl.slice(1)
        : repl
    );
  });
  return out;
}

// "Croisière au fil du Nil de X vers Y (N jours et M nuits)" est une
// tournure figée que la traduction mot à mot rendait illisible ("Croisière
// at fil Nil Luxor vers Aswan...") — reconstruite entièrement plutôt que
// rafistolée avec plus d'entrées au dictionnaire.
export function translateCroisiereTitle(nom: string): string | null {
  const m = nom.match(
    /^Croisière au fil du Nil de (.+?) vers (.+?)\s*\((\d+)\s*jours?\s*et\s*(\d+)\s*nuits?\)/i
  );
  if (!m) return null;
  const [, villeA, villeB, jours, nuits] = m;
  return `Nile Cruise from ${translateFr(villeA.trim())} to ${translateFr(villeB.trim())} (${jours} days and ${nuits} nights)`;
}

// "(déjà sur place)" ne veut rien dire pour l'équipe Égypte sans savoir de
// quelle ville il s'agit — "already in Cairo"/"already in Luxor" est plus
// clair que le générique "already on-site" du dictionnaire.
export function translateDejaSurPlace(nom: string): string {
  const traduit = translateFr(nom);
  const villeMatch = nom.match(/^(.+?)\s+\d.*\(déjà sur place\)/i);
  if (!villeMatch) return traduit;
  const ville = translateFr(villeMatch[1].trim());
  return traduit.replace(/\(already on-site\)/i, `(already in ${ville})`);
}

// Le titre stocké peut porter un suffixe " — ..." (île / moment / créneau,
// posé par l'assistant d'ajout) — on ne veut que le nom de base ici, le
// moment/créneau est déjà ajouté séparément par momentBadge.
export function baseActivityName(nom: string) {
  const idx = nom.indexOf(" — ");
  return idx === -1 ? nom : nom.slice(0, idx);
}

export const PAYMENT_MODE_EN: Record<string, string> = {
  "Espèces EUR": "cash",
  "Espèces EGP": "cash",
  "Carte bleue": "card",
  "Virement bancaire": "bank transfer",
  PayPal: "PayPal",
};

// Le bloc complet : date, nom traduit, options/moment/spécificités, puis les
// infos client (nom, pax, hôtel, chambre, whatsapp), et enfin — s'il y a
// quelque chose à régler sur CETTE activité (solde d'origine ou reprise
// après un solde déjà clôturé, voir activitePaiementWarning) — une ligne
// "Payment : ... ⚠️⚠️" bien visible pour l'équipe Égypte.
export function buildEgyptActivityBlock(
  client: Client,
  r: Reservation,
  options: ReservationOption[],
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  etapes: PaiementEtape[],
  clientHotels: ClientHotel[],
  hotelVille?: string
): string {
  const titreBase = baseActivityName(r.nom_activite);
  const titreTraduit =
    translateCroisiereTitle(titreBase) ||
    (titreBase.includes("déjà sur place") ? translateDejaSurPlace(titreBase) : translateFr(titreBase));
  const activiteLines: string[] = [fmtDDMM(r.date_debut || ""), titreTraduit];
  const siteCaireLine = siteCaireEgyptLine(r);
  if (siteCaireLine) activiteLines.push(siteCaireLine);
  // La "2ème île" n'est jamais listée comme option ici — elle est déjà dans
  // le titre (ex. "avec Paradise + Hula Hula"), la répéter en dessous ferait
  // doublon. Format volontairement sans "participants" (tournure française
  // "N participants X") — juste la quantité et le nom, à l'anglaise.
  options
    .filter((o) => !isDeuxiemeIleOption(o.nom))
    .forEach((o) => {
      const qty = Number(o.quantite) || 1;
      const label = translateFr(o.nom);
      const carteLiee = reservations.find(
        (rr) => rr.parent_reservation_id === r.id && rr.nom_activite === o.nom
      );
      const dateSuffixe = carteLiee?.date_debut ? ` (${fmtDDMM(carteLiee.date_debut)})` : "";
      if (o.nom === "Montgolfière") {
        activiteLines.push(`${qty} ${qty > 1 ? "ballons" : "ballon"}${dateSuffixe}`);
      } else if (o.nom.startsWith("Transfert Assouan")) {
        activiteLines.push(`${label} after Nile Cruise${dateSuffixe}`);
      } else {
        activiteLines.push(qty > 1 ? `${qty} ${label}` : label);
      }
    });
  const momentEn = momentBadge(r);
  if (momentEn) activiteLines.push(translateFr(momentEn));
  if (r.horaire_souhaite) activiteLines.push(`Time : ${r.horaire_souhaite}`);
  const chevalBadge = chevalChameauBadge(r, client);
  if (chevalBadge) activiteLines.push(chevalBadge);
  if (r.nb_conducteurs != null) activiteLines.push(`Drivers : ${r.nb_conducteurs}`);
  if (r.nb_passagers != null) activiteLines.push(`Passengers : ${r.nb_passagers}`);
  if (r.pointure) activiteLines.push(`Shoe size : ${r.pointure}`);

  const paiementWarning = activitePaiementWarning(client, r, reservations, resaOptions, resaTarifs, etapes);
  const paymentLine = paiementWarning
    ? `Payment : ${euros(paiementWarning.amount)} ${paiementWarning.devise === "EGP" ? "EGP" : "euros"} ${
        PAYMENT_MODE_EN[client.reprise_montant > 0 ? client.reprise_mode : client.solde_mode] ||
        (client.reprise_montant > 0 ? client.reprise_mode : client.solde_mode)
      } ⚠️⚠️`
    : "";

  return `${activiteLines.join("\n")}\n\nName : ${client.nom || "—"}\n\n${buildPaxEnglish(
    client
  )}\n\nHotel : ${hotelEgyptLinePourActivite(
    clientHotels,
    r.date_debut,
    client.hotel,
    hotelVille
  )}\nRoom Number : ${client.chambre || "—"}\n\nWhat's app : ${client.telephone || "—"}${
    paymentLine ? `\n\n${paymentLine}` : ""
  }`;
}
