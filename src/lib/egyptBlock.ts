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
import { hotelEgyptLinePourActivite, hotelPourDate, hotelPourVille } from "@/lib/hotelHelp";
import {
  activitePaiementWarning,
  chevalChameauBadge,
  isDeuxiemeIleOption,
  momentBadge,
  siteCaireEgyptLine,
  transfertPrivatifVilles,
} from "@/lib/resa";
import { dejaSurPlaceVille } from "@/lib/generatorProgram";
import { buildPaxEnglishForReservation } from "@/components/client-steps";

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
  // Vocabulaire du texte PAX personnalisé (pax_override, voir paxLine dans
  // resa.ts et buildPaxEnglishForReservation) — ex. "2 participants, 1
  // accompagnateur", le texte cité en exemple dans le brief business. Cette
  // ligne est retapée à la main par l'employée en français ; sans ces
  // entrées, elle apparaissait telle quelle au milieu d'un bloc équipe
  // Égypte sinon entièrement en anglais. Pluriels avant singuliers, comme
  // "chevaux"/"cheval" plus haut, pour ne jamais laisser un "s" français
  // traîner après un mot déjà traduit.
  [/accompagnateurs/gi, "companions"],
  [/accompagnateur/gi, "companion"],
  [/passagers/gi, "passengers"],
  [/passager/gi, "passenger"],
  [/conducteurs/gi, "drivers"],
  [/conducteur/gi, "driver"],
  [/chauffeurs/gi, "drivers"],
  [/chauffeur/gi, "driver"],
  [/\badultes\b/gi, "adults"],
  [/\badulte\b/gi, "adult"],
  [/\benfants\b/gi, "children"],
  [/\benfant\b/gi, "child"],
  [/bébés/gi, "babies"],
  [/bébé/gi, "baby"],
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
// Étiquettes du client (la petite étoile de la fiche) qui doivent suivre
// son nom dans le bloc équipe Égypte : l'équipe sur place lit ce bloc et
// rien d'autre, donc ce qui change sa façon d'accueillir le client doit y
// figurer. Les autres étiquettes (Urgent, Ancien client) servent au suivi
// interne et n'ont rien à faire dans un message opérationnel.
const ETIQUETTES_BLOC_EGYPTE: [string, string][] = [
  ["VIP", "(VIP)"],
  ["Vigilance", "(DIFFICULT CLIENT)"],
  ["Influenceur/Collaboration", "(Influenceur/Collab)"],
];

// "Sophie Durand (VIP)" — plusieurs étiquettes se cumulent dans l'ordre
// ci-dessus, pour que deux clients étiquetés pareil s'affichent pareil.
export function nomClientPourEgypte(client: Client) {
  const nom = client.nom || "—";
  const tags = client.tags || [];
  const suffixes = ETIQUETTES_BLOC_EGYPTE.filter(([tag]) => tags.includes(tag)).map(([, libelle]) => libelle);
  return suffixes.length > 0 ? `${nom} ${suffixes.join(" ")}` : nom;
}

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
  // Solde réglé en mixte €+EGP (client.solde_mixte_eur/solde_mixte_egp) —
  // sans cette entrée, "Modes différents" passait tel quel, en français, au
  // milieu d'un message sinon entièrement en anglais.
  "Modes différents": "cash (mixed EUR + EGP)",
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
  if (r.nb_quad) activiteLines.push(`Quad : ${r.nb_quad}`);
  if (r.nb_buggy_normal) activiteLines.push(`Buggy : ${r.nb_buggy_normal}`);
  if (r.nb_buggy_famille) activiteLines.push(`Buggy family : ${r.nb_buggy_famille}`);
  if (r.pointure) activiteLines.push(`Shoe size : ${r.pointure}`);
  // Info importante (bouton "+" bleu de l'étape Options du wizard, ex.
  // "Allergie fruits de mer") — visible en badge rouge sur la carte côté
  // Réservations (ItineraryView) mais jusqu'ici absente de ce bloc, alors
  // que c'est justement l'équipe Égypte sur le terrain qui doit la voir.
  // Jamais traduite (texte libre saisi à la main) — préfixée pour rester
  // repérable même si le reste du bloc est en anglais.
  if (r.info_importante.trim()) activiteLines.push(`IMPORTANT : ${r.info_importante.trim()}`);

  const paiementWarning = activitePaiementWarning(client, r, reservations, resaOptions, resaTarifs, etapes);
  // Même condition que la branche "reprise" tout en haut de
  // activitePaiementWarning (resa.ts) — sinon le mode affiché ici peut venir
  // d'une reprise réglée sur une TOUTE AUTRE activité (ou en PayPal/
  // Virement, exclus de cette branche) alors que paiementWarning est en
  // réalité retombé sur le solde classique pour cette activité précise.
  const repriseIci =
    Number(client.reprise_montant) > 0 &&
    client.reprise_mode !== "PayPal" &&
    client.reprise_mode !== "Virement bancaire" &&
    client.reprise_activite_id === r.id;
  const modePaiement = repriseIci ? client.reprise_mode : client.solde_mode;
  // Règlement mixte €+EGP (solde ou reprise) : paiementWarning.amount2 porte
  // la part EGP — sans ce cas, cette ligne (construite à part, pas via
  // paiementWarningLabel qui utilise le symbole "€" plutôt que le mot
  // "euros" utilisé ici) ignorait complètement la part EGP due, comme
  // c'était déjà le cas pour "reste à payer" avant d'être corrigé ailleurs.
  const paymentLine = paiementWarning
    ? `Payment : ${euros(paiementWarning.amount)} ${paiementWarning.devise === "EGP" ? "EGP" : "euros"}${
        paiementWarning.amount2 != null
          ? ` + ${euros(paiementWarning.amount2)} ${paiementWarning.devise2 === "EGP" ? "EGP" : "euros"}`
          : ""
      } ${PAYMENT_MODE_EN[modePaiement] || modePaiement} ⚠️⚠️`
    : "";

  // Même étape que celle utilisée juste au-dessus pour le nom de l'hôtel
  // (hotelEgyptLinePourActivite) — sans ça, un circuit multi-hôtels affiche
  // toujours le numéro de chambre global du client (souvent vide, ou celui
  // d'une autre étape) au lieu de celui de l'hôtel réellement affiché pour
  // cette date.
  const etapeChambre = clientHotels.length > 0 ? hotelPourDate(clientHotels, r.date_debut) : null;
  const chambre = etapeChambre ? etapeChambre.chambre : client.chambre;

  // translateFr() : buildPaxEnglishForReservation renvoie pax_override tel
  // quel quand il est rempli (paxLine, côté fiche client français, fait
  // pareil) — sans cette passe, un texte comme "1 participant, 1
  // accompagnateur" retapé à la main par l'employée en français
  // apparaissait tel quel au milieu d'un bloc sinon entièrement en anglais.
  // Sans effet sur le texte déjà calculé en anglais (aucun mot français à
  // traduire dedans).
  // Transfert privatif entre deux villes (ex. Louxor - Hurghada) : l'hôtel
  // résolu par date (hotelEgyptLinePourActivite) retombe sur l'hôtel
  // d'ARRIVÉE seul, la date du transfert étant aussi le jour de check-in du
  // nouvel hôtel (convention "déjà arrivé" de hotelPourDate) — l'équipe
  // Égypte a pourtant besoin des deux pour organiser le trajet.
  //
  // Même souci pour un circuit de plusieurs jours qui change d'hôtel en
  // cours de route (ex. "Louxor 2 jours & Montgolfière (depuis Hurghada),
  // reste à Louxor", vécu sur Vanessa PUJOL) : le titre est souvent retapé
  // à la main par l'équipe (mots, ordre, tournure changent d'un dossier à
  // l'autre), donc on ne se fie pas au texte mais au circuit réel —
  // l'étape résolue au premier jour de l'activité diffère de celle résolue
  // au dernier jour, peu importe comment l'activité est nommée.
  const etapeDebutActivite = clientHotels.length > 0 ? hotelPourDate(clientHotels, r.date_debut) : null;
  const etapeFinActivite =
    clientHotels.length > 0 ? hotelPourDate(clientHotels, r.date_fin || r.date_debut) : null;
  const villesDebutFin =
    etapeDebutActivite &&
    etapeFinActivite &&
    etapeDebutActivite.ville.trim().toLowerCase() !== etapeFinActivite.ville.trim().toLowerCase()
      ? { depart: etapeDebutActivite.ville, arrivee: etapeFinActivite.ville }
      : null;

  // Même souci pour une excursion "(déjà sur place)" qui inclut elle-même
  // le retour vers une autre ville du circuit (ex. "Louxor 1 jour visites &
  // Montgolfière (déjà sur place) - avec retour Marsa Alam inclus", vécu
  // sur Sharlen MICIELI) : ce n'est pas un "Transfert privatif" catalogue,
  // mais la ville où se déroule concrètement l'activité (dejaSurPlaceVille)
  // diffère de l'étape résolue par date (etapeChambre, déjà "déjà arrivée"
  // à la ville suivante) — même signal qu'un transfert entre deux hôtels,
  // peu importe le libellé exact tapé pour le retour. Sans date de fin
  // distincte (activité d'un seul jour), villesDebutFin ci-dessus ne peut
  // rien détecter — d'où ce deuxième filet, basé sur le titre cette fois.
  const villeDejaSurPlace = dejaSurPlaceVille(titreBase);
  const villesTransfert =
    transfertPrivatifVilles(titreBase) ||
    villesDebutFin ||
    (villeDejaSurPlace &&
    etapeChambre &&
    etapeChambre.ville.trim().toLowerCase() !== villeDejaSurPlace.trim().toLowerCase()
      ? { depart: villeDejaSurPlace, arrivee: etapeChambre.ville }
      : null);
  const hotelLines = villesTransfert
    ? `Hotel departure : ${hotelPourVille(clientHotels, villesTransfert.depart, client.hotel, hotelVille)}\nHotel arrival : ${hotelPourVille(
        clientHotels,
        villesTransfert.arrivee,
        client.hotel,
        hotelVille
      )}`
    : `Hotel : ${hotelEgyptLinePourActivite(clientHotels, r.date_debut, client.hotel, hotelVille)}`;

  return `${activiteLines.join("\n")}\n\nName : ${nomClientPourEgypte(client)}\n\n${translateFr(
    buildPaxEnglishForReservation(r, client)
  )}\n\n${hotelLines}\nRoom Number : ${chambre || "—"}\n\nWhat's app : ${client.telephone || "—"}${
    paymentLine ? `\n\n${paymentLine}` : ""
  }`;
}
