import {
  AssouanVerification,
  CatalogueItem,
  Client,
  Pack,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { addDays, todayStr, weekdayFr } from "@/lib/dates";
import { CHAMPS_REQUIS_PRESETS } from "@/lib/constants";

// Un client confirmé, séjour proche (dans les 14 jours, ou déjà en cours),
// sans aucune ligne dans "verifications" — utilisé à la fois par le rappel
// personnel (PersonalNudgeAlert) et par Suivis > Vérification de dossier,
// pour que les deux s'accordent sur la même définition de "en attente".
export function estDossierNonVerifie(c: Client, clientsVerifies: Set<string>) {
  if (c.statut !== "Client confirmé" || !c.date_debut) return false;
  if (c.date_debut > addDays(todayStr(), 14)) return false;
  if (c.date_fin && c.date_fin < todayStr()) return false;
  return !clientsVerifies.has(c.id);
}

// Le solde reste unique par séjour (règle métier — jamais un solde par
// activité), mais l'équipe doit pouvoir choisir explicitement son statut de
// paiement depuis n'importe quelle activité (les choses ne se passent pas
// toujours comme prévu). Chaque option ci-dessous correspond à une
// combinaison précise des champs solde_* du client, appliquée d'un coup.
export type StatutPaiementKey =
  | "paye_eur"
  | "paye_egp"
  | "paye_cb"
  | "paye_virement"
  | "paye_paypal"
  | "paye_mixte"
  | "attente"
  | "attente_paypal"
  | "rdv_planifie"
  | "activite_cb"
  | "activite_eur"
  | "activite_egp";

export const STATUT_PAIEMENT_OPTIONS: {
  key: StatutPaiementKey;
  label: string;
  className: string;
  patch: (r: Reservation) => Partial<Client>;
}[] = [
  {
    key: "paye_eur",
    label: "Payé - en espèces en €",
    className: "bg-green-100 text-green-700",
    patch: () => ({ solde_paye: true, solde_mode: "Espèces EUR" }),
  },
  {
    key: "paye_egp",
    label: "Payé - en livres égyptiennes",
    className: "bg-green-100 text-green-700",
    patch: () => ({ solde_paye: true, solde_mode: "Espèces EGP" }),
  },
  {
    key: "paye_cb",
    label: "Payé - carte bleue",
    className: "bg-green-100 text-green-700",
    patch: () => ({ solde_paye: true, solde_mode: "Carte bleue" }),
  },
  {
    key: "paye_virement",
    label: "Payé - virement bancaire",
    className: "bg-green-100 text-green-700",
    patch: () => ({ solde_paye: true, solde_mode: "Virement bancaire" }),
  },
  {
    key: "paye_paypal",
    label: "Payé - PayPal ✅",
    className: "bg-green-100 text-green-700",
    patch: () => ({ solde_paye: true, solde_mode: "PayPal" }),
  },
  {
    key: "paye_mixte",
    label: "Payé - modes différents",
    className: "bg-green-100 text-green-700",
    patch: () => ({ solde_paye: true, solde_mode: "Modes différents" }),
  },
  {
    key: "attente",
    label: "En attente",
    className: "bg-yellow-100 text-yellow-700",
    patch: () => ({
      solde_paye: false,
      solde_mode: "Virement bancaire",
      solde_activite_id: null,
      solde_rdv_heure: "",
      solde_rdv_lieu: "",
    }),
  },
  {
    key: "attente_paypal",
    label: "En attente - PayPal",
    className: "bg-yellow-100 text-yellow-700",
    patch: () => ({
      solde_paye: false,
      solde_mode: "PayPal",
      solde_activite_id: null,
      solde_rdv_heure: "",
      solde_rdv_lieu: "",
    }),
  },
  {
    key: "rdv_planifie",
    label: "RDV paiement planifié",
    className: "bg-blue-100 text-blue-700",
    patch: () => ({
      solde_paye: false,
      solde_activite_id: null,
      solde_rdv_lieu: "À définir",
    }),
  },
  {
    key: "activite_cb",
    label: "Paiement à l'activité - CB",
    className: "bg-orange-100 text-orange-700",
    patch: (r) => ({ solde_paye: false, solde_mode: "Carte bleue", solde_activite_id: r.id }),
  },
  {
    key: "activite_eur",
    label: "Paiement à l'activité - en €",
    className: "bg-orange-100 text-orange-700",
    patch: (r) => ({ solde_paye: false, solde_mode: "Espèces EUR", solde_activite_id: r.id }),
  },
  {
    key: "activite_egp",
    label: "Paiement à l'activité - en EGP",
    className: "bg-orange-100 text-orange-700",
    patch: (r) => ({ solde_paye: false, solde_mode: "Espèces EGP", solde_activite_id: r.id }),
  },
];

export function paiementStatutKey(client: Client, r: Reservation): StatutPaiementKey {
  if (client.solde_paye) {
    if (client.solde_mode === "Modes différents") return "paye_mixte";
    if (client.solde_mode === "Espèces EGP") return "paye_egp";
    if (client.solde_mode === "Carte bleue") return "paye_cb";
    if (client.solde_mode === "Virement bancaire") return "paye_virement";
    if (client.solde_mode === "PayPal") return "paye_paypal";
    return "paye_eur";
  }
  if (client.solde_activite_id === r.id) {
    if (client.solde_mode === "Espèces EGP") return "activite_egp";
    if (client.solde_mode === "Carte bleue") return "activite_cb";
    return "activite_eur";
  }
  if (!client.solde_activite_id && (client.solde_rdv_heure || client.solde_rdv_lieu)) {
    return "rdv_planifie";
  }
  return client.solde_mode === "PayPal" ? "attente_paypal" : "attente";
}

const RDV_FINALISE_LABELS: Record<string, string> = {
  "Carte bleue": "Payé CB - rendez-vous paiement finalisé",
  "Espèces EGP": "Payé en EGP - rendez-vous paiement finalisé",
};

// Marquer le solde payé (badge vert "Payé - ...") déclare tout le séjour
// réglé, acompte compris (règle du solde unique — voir paiementProgress) :
// si l'acompte est encore "en attente" à ce moment-là, il faut le
// signaler avant de continuer, sinon un acompte PayPal jamais réellement
// encaissé se retrouve compté comme payé partout sans que personne ne
// l'ait vérifié.
export function soldeInclutAcompteImpaye(client: Client): boolean {
  return client.paiement_type === "acompte" && client.acompte_valide && !client.acompte_paye;
}

// Même calcul que le récapitulatif "Paiements" de la fiche client (acompte
// + étapes libres + avoir, plus le solde si déjà marqué payé) — factorisé
// ici pour que paiementBadge s'appuie sur exactement la même réalité,
// jamais une version approximative recalculée à part.
export function paiementProgress(
  client: Client,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  etapes: PaiementEtape[] = []
): { totalSejour: number; totalPaye: number; reste: number; soldeRestant: number } {
  const totalSejour = reservationsActives(reservations).reduce(
    (s, rr) => s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
    0
  );
  const acomptePaye =
    client.paiement_type === "acompte" && client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  // Un acompte validé (montant/mode fixés) suit son propre règlement même
  // s'il n'est pas encore physiquement encaissé — jamais compté dans ce qui
  // reste dû À LA DESTINATION, sous peine de fusionner les deux montants
  // (vécu : acompte PayPal de 390€ non encaissé + solde de 2260€ à une
  // activité affichés comme "2650€ en retard" sur cette seule activité).
  const acompteEngage =
    client.paiement_type === "acompte" && client.acompte_valide ? Number(client.acompte_montant) || 0 : 0;
  const avoirUtilise = avoirUtiliseTotal(reservations);
  const etapesSum = etapes.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const soldeRestant = Math.max(totalSejour - acompteEngage - etapesSum - avoirUtilise, 0);
  // Le solde marqué payé couvre le total du séjour TEL QU'IL ÉTAIT au moment
  // de l'encaissement (client.solde_montant, figé alors) — jamais le total
  // recalculé maintenant, sinon une activité ajoutée après coup se
  // retrouverait comptée payée par magie (règle du solde unique : un "payé"
  // du passé ne peut pas s'étendre tout seul à une activité qui n'existait
  // pas encore). On plafonne à soldeRestant pour ne jamais dépasser le
  // besoin réel si le séjour a au contraire diminué depuis.
  const soldePayeMontant = client.solde_paye
    ? Math.min(Number(client.solde_montant) || soldeRestant, soldeRestant)
    : 0;
  const totalPaye = acomptePaye + etapesSum + avoirUtilise + soldePayeMontant;
  return { totalSejour, totalPaye, reste: Math.max(totalSejour - totalPaye, 0), soldeRestant };
}

// Seuil à partir duquel un séjour presque entièrement réglé (ex. Célia
// Nichanian : 1510,8€/1530€) ne doit plus afficher "En attente" sur les
// activités qui ne sont pas le point de collecte du solde — ce libellé
// laisse penser que rien n'a été payé, alors que la quasi-totalité l'est.
const SEUIL_PRESQUE_PAYE = 0.9;

const PAYE_KEYS = new Set([
  "paye_eur",
  "paye_egp",
  "paye_cb",
  "paye_virement",
  "paye_paypal",
  "paye_mixte",
]);

export function paiementBadge(
  client: Client,
  r: Reservation,
  reservations?: Reservation[],
  resaOptions?: Record<string, ReservationOption[]>,
  resaTarifs?: Record<string, ReservationTarif[]>,
  etapes?: PaiementEtape[]
) {
  const key = paiementStatutKey(client, r);
  const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === key)!;

  // Sans le contexte complet (anciens appels à 2 arguments), comportement
  // inchangé — ces affinages ont besoin de connaître le reste à payer réel
  // du séjour entier.
  if (!reservations || !resaOptions || !resaTarifs) {
    if (client.solde_paye && client.solde_rdv_finalise) {
      return {
        label: RDV_FINALISE_LABELS[client.solde_mode] || "Payé en € - rendez-vous paiement finalisé",
        className: "bg-green-100 text-green-700",
      };
    }
    return { label: opt.label, className: opt.className };
  }

  const { totalPaye, totalSejour, reste, soldeRestant } = paiementProgress(
    client,
    reservations,
    resaOptions,
    resaTarifs,
    etapes || []
  );

  // Le solde avait été marqué payé (éventuellement via un RDV finalisé),
  // mais une activité ajoutée depuis a fait grossir le total du séjour
  // au-delà de ce qui a réellement été encaissé (règle du solde unique : un
  // "payé" qui datait d'avant cette activité ne peut pas s'appliquer à elle
  // par magie) — le badge "Payé" redeviendrait mensonger, il faut rouvrir un
  // vrai statut "à régler".
  if ((PAYE_KEYS.has(key) || (client.solde_paye && client.solde_rdv_finalise)) && reste > 0) {
    return {
      label: `⚠️ Nouvelle activité non réglée — ${fmtEuros(reste)} € à encaisser`,
      className: "bg-red-100 text-red-700",
    };
  }

  // Le bouton "Rendez-vous finalisé" (étape Paiements) marque le solde payé
  // et pose ce drapeau — le badge doit alors le préciser plutôt que le
  // libellé "Payé" générique, sur toutes les activités.
  if (client.solde_paye && client.solde_rdv_finalise) {
    return {
      label: RDV_FINALISE_LABELS[client.solde_mode] || "Payé en € - rendez-vous paiement finalisé",
      className: "bg-green-100 text-green-700",
    };
  }

  // Le point de collecte désigné pour le solde, une fois sa date passée
  // sans encaissement : "Paiement à l'activité" devient trompeur, ce n'est
  // plus "à venir" mais du retard non signalé.
  if (
    (key === "activite_eur" || key === "activite_cb" || key === "activite_egp") &&
    r.date_debut &&
    r.date_debut < todayStr()
  ) {
    return {
      label: `⚠️ ${fmtEuros(soldeRestant)} € en retard — non collecté à l'activité prévue`,
      className: "bg-red-100 text-red-700",
    };
  }

  // Activité qui n'est pas le point de collecte du solde : "En attente" est
  // trompeur si la quasi-totalité du séjour est déjà réglée — cette carte
  // précise n'attend rien de particulier.
  if (
    (key === "attente" || key === "attente_paypal") &&
    totalSejour > 0 &&
    totalPaye / totalSejour >= SEUIL_PRESQUE_PAYE
  ) {
    return {
      label: `Presque payé — reste ${fmtEuros(reste)} €`,
      className: "bg-blue-100 text-blue-700",
    };
  }

  return { label: opt.label, className: opt.className };
}

// Un avoir utilisé se rattache toujours à l'activité qui en a bénéficié
// (reservation.avoir_utilise, affiché sur sa carte) — le total consommé sur
// le séjour est simplement la somme de ce champ sur toutes les activités.
export function avoirUtiliseTotal(reservations: Reservation[]) {
  return reservations.reduce((s, rr) => s + (Number(rr.avoir_utilise) || 0), 0);
}

// Une activité annulée sort du total du séjour (et de tout calcul de
// paiement) sans jamais être supprimée — elle reste consultable, juste
// exclue des sommes. Toujours passer les réservations par ici avant de les
// sommer.
export function reservationsActives(reservations: Reservation[]) {
  return reservations.filter((r) => r.statut_resa !== "Annulée");
}

// Point de collecte du solde (acompte + activité désignée, ou paiement
// intégral "à la première activité") : signale, sur cette activité, le
// montant qui reste à encaisser. Une fois la date de cette activité passée
// sans encaissement, le rappel réapparaît aussi sur la prochaine activité
// réelle du client (chronologiquement, à partir d'aujourd'hui) — sinon il
// devient invisible dès que la carte d'origine glisse dans le passé (vécu
// sur Célia Nichanian : solde resté attaché à un speedboat déjà passé,
// personne ne le revoyait). Seul le montant en € est repris sur la
// prochaine activité — le montant EGP intégral est confirmé à la main pour
// l'activité d'origine, pas transposable telle quelle ailleurs.
export function activitePaiementWarning(
  client: Client,
  r: Reservation,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  etapes: PaiementEtape[] = []
): { amount: number; devise: "€" | "EGP" } | null {
  if (client.solde_paye) return null;
  if (!client.solde_activite_id) return null;
  const estCollecte = r.id === client.solde_activite_id;
  if (estCollecte && client.paiement_integral_mode === "activite_egp") {
    // Montant confirmé (et ajustable) par l'employée via la fenêtre de
    // conversion — jamais recalculé silencieusement à l'affichage.
    return { amount: client.egp_montant, devise: "EGP" };
  }
  if (!estCollecte) {
    if (client.paiement_integral_mode === "activite_egp") return null;
    const collecte = reservations.find((rr) => rr.id === client.solde_activite_id);
    const collecteDepassee = !!collecte?.date_debut && collecte.date_debut < todayStr();
    if (!collecteDepassee) return null;
    const prochaine = [...reservationsActives(reservations)]
      .filter((rr) => rr.date_debut && rr.date_debut >= todayStr())
      .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""))[0];
    if (!prochaine || prochaine.id !== r.id) return null;
  }
  const totalSejour = reservationsActives(reservations).reduce(
    (s, rr) => s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
    0
  );
  const acompte = client.paiement_type === "acompte" && client.acompte_valide ? Number(client.acompte_montant) || 0 : 0;
  // Un avoir consommé réduit le montant restant dû pour tout le séjour, où
  // qu'il soit collecté (règle du solde unique par séjour) — jamais un
  // deuxième "solde" par activité. Les étapes de paiement libres (acompte
  // → solde) réduisent ce même montant restant, pour la même raison.
  const etapesSum = etapes.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const amount = Math.max(totalSejour - acompte - etapesSum - avoirUtiliseTotal(reservations), 0);
  return { amount, devise: "€" };
}

// Acompte pas encore encaissé : signalé sur la toute première activité
// (chronologiquement), tant qu'il n'a pas été marqué encaissé.
export function acompteWaitingWarning(
  client: Client,
  r: Reservation,
  reservations: Reservation[]
): { montant: number; mode: string } | null {
  if (client.paiement_type !== "acompte") return null;
  if (!client.acompte_valide || client.acompte_paye) return null;
  const sorted = [...reservations]
    .filter((rr) => rr.date_debut)
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));
  if (sorted.length === 0 || sorted[0].id !== r.id) return null;
  return { montant: client.acompte_montant, mode: client.acompte_mode };
}

// Le "moment" (matin / après-midi / journée) ne veut rien dire pour les
// activités spa/massage (remplacé par un horaire précis, voir
// horaire_souhaite) ni pour le speedboat sunset (l'heure est déjà fixée par
// le nom de l'activité) — dans ces deux cas on ne l'affiche jamais.
export function hideMoment(nomActivite: string, horaireSouhaite: string) {
  if (horaireSouhaite) return true;
  return isSpeedboatSunset(nomActivite);
}

// Le créneau (matin / après-midi / coucher de soleil, cheval-chameau) ou le
// moment (matin / après-midi, speedboat...) affiché à côté du titre de la
// carte — un seul des deux est jamais renseigné selon le type d'activité.
export function momentBadge(r: Reservation) {
  // "Journée" est une formule fixe (jamais un vrai choix laissé à
  // l'employée) — inutile de l'afficher, ça n'apporte aucune info.
  const value =
    r.creneau && r.creneau !== "Journée"
      ? r.creneau
      : r.moment && r.moment !== "Journée" && !hideMoment(r.nom_activite, r.horaire_souhaite)
        ? r.moment
        : "";
  // Déjà répété dans le titre (ex. "Safari quad au coucher du soleil") —
  // pas besoin du badge en plus.
  if (value && (r.nom_activite || "").toLowerCase().includes(value.toLowerCase())) return "";
  return value;
}

// Badge "🎁 Offerte" / "− 20 €" à afficher à côté du titre d'une activité
// réduite/offerte — une seule fonction partagée pour que la fiche client et
// la vue Réservations affichent toujours exactement la même chose.
export function reductionBadge(r: Reservation): string {
  if (r.activite_offerte) return "🎁 Offerte";
  const montant = Number(r.reduction_montant) || 0;
  if (montant > 0) return `− ${fmtEuros(montant)} €`;
  return "";
}

// Badge "Option : X" / "Options : X + Y" à côté du titre — reprend
// uniquement le nom court de chaque option choisie (jamais son descriptif),
// partagé entre fiche client et vue Réservations.
// Une option de croisière (Montgolfière, Abu Simbel, transfert) dont la
// carte séparée liée a été annulée reste affichée dans ce badge — sinon
// elle semblerait avoir disparu du tout — mais avec "(annulée)" à côté,
// pour ne pas laisser croire qu'elle est toujours prévue.
export function optionsBadge(
  options: ReservationOption[],
  allReservations: Reservation[] = [],
  parentReservationId?: string
): string {
  const noms = options
    .map((o) => {
      const nom = o.nom.trim();
      if (!nom) return "";
      const carte =
        parentReservationId &&
        allReservations.find(
          (rr) => rr.parent_reservation_id === parentReservationId && rr.nom_activite === nom
        );
      return carte && carte.statut_resa === "Annulée" ? `${nom} (annulée)` : nom;
    })
    .filter(Boolean);
  if (noms.length === 0) return "";
  return `${noms.length > 1 ? "Options" : "Option"} : ${noms.join(" + ")}`;
}

// Une activité sur plusieurs jours (ex. croisière) reste triée/affichée à sa
// date de DÉBUT dans toutes les vues Réservations, même les jours suivants —
// sans ce badge, elle se confond avec une activité qui commencerait
// aujourd'hui alors qu'elle est en réalité déjà en cours depuis un moment.
export function enCoursBadge(r: Reservation): string {
  if (!r.date_debut || !r.date_fin || r.date_fin === r.date_debut) return "";
  const today = todayStr();
  if (today <= r.date_debut || today > r.date_fin) return "";
  return `📍 Toujours en cours (jusqu'au ${fmtDateFr(r.date_fin)})`;
}

// Repère en un coup d'œil, dans la fiche client (section "Activités
// réservées" uniquement — pas les autres vues), où le client se trouve
// aujourd'hui : le jour même d'une activité (simple ou premier jour d'un
// séjour de plusieurs jours). Jamais en double avec enCoursBadge : ce
// dernier prend le relais dès le lendemain et jusqu'à la fin du séjour.
export function activiteEnCoursAujourdhui(r: Reservation): boolean {
  if (enCoursBadge(r)) return false;
  return !!r.date_debut && r.date_debut === todayStr();
}

// Croisières au fil du Nil : seule activité dont certaines options ont lieu
// à une date différente de l'activité elle-même (Montgolfière, Abu Simbel,
// transfert retour) — chacune devient sa propre carte, à la bonne date.
export function isCroisiere(nom: string): boolean {
  return (nom || "").toLowerCase().includes("croisière au fil du nil");
}

// Séjours de plusieurs jours où le client est déjà sur place (Le Caire,
// Louxor, croisière, Siwa) ou n'implique pas de trajet depuis Hurghada
// (Abu Simbel/Assouan) — aucune taxe de transfert ne s'applique, jamais à
// saisir à la main pour ces activités-là.
export function noTaxeTransfert(nom: string): boolean {
  const n = (nom || "").toLowerCase();
  return (
    n.includes("déjà sur place") ||
    isCroisiere(n) ||
    n.includes("siwa") ||
    n.includes("abu simbel") ||
    n.includes("assouan")
  );
}

// Vrai quand l'hôtel du client est hors Hurghada, que l'activité est
// concernée par une taxe de transfert (voir noTaxeTransfert /
// isAeroportTransfertHorsHurghada), que le mode "Taxe de transfert" a bien
// été choisi (transfert_inclus=false) mais que le montant est resté à 0€ —
// c'est-à-dire jamais réellement saisi. Sert à alerter visuellement sur la
// carte plutôt que de laisser un 0€ silencieux (vécu avec un client à Sahl
// Hasheesh où la taxe n'a jamais été ajoutée).
export function taxeTransfertManquante(r: Reservation, hotelHorsHurghada?: boolean): boolean {
  if (!hotelHorsHurghada) return false;
  if (noTaxeTransfert(r.nom_activite)) return false;
  if (isAeroportTransfertHorsHurghada(r.nom_activite)) return false;
  // Ne se fie plus à transfert_inclus seul : cette activité a pu être créée
  // avant que l'hôtel soit répertorié (transfert_inclus vaut alors "true"
  // par défaut faute de savoir que l'hôtel est hors Hurghada) et rester
  // figée à ce mauvais réglage même une fois l'hôtel ajouté — vécu sur un
  // pack ajouté avant que "The V luxury Sahl Hasheesh" soit répertorié. Un
  // montant à 0€ pour un hôtel hors Hurghada est toujours suspect, que
  // "Transfert inclus" ait été coché ou non.
  return (Number(r.transfert_montant) || 0) <= 0;
}

export type CroisiereSens = "louxor_assouan" | "assouan_louxor";

export function croisiereSens(nom: string): CroisiereSens | null {
  const n = (nom || "").toLowerCase();
  if (n.includes("louxor vers assouan")) return "louxor_assouan";
  if (n.includes("assouan vers louxor")) return "assouan_louxor";
  return null;
}

// Jour de croisière (1 = jour de départ) où a lieu chaque option — d'après
// l'itinéraire réel communiqué par l'agence, différent selon le sens.
export const CROISIERE_OPTION_NOMS = ["Montgolfière", "Abu Simbel", "Transfert Assouan - Hurghada", "Transfert Assouan - Louxor"];

const CROISIERE_OPTION_JOURS: Record<CroisiereSens, Record<string, number>> = {
  louxor_assouan: { Montgolfière: 2, "Abu Simbel": 4, "Transfert Assouan - Hurghada": 5 },
  assouan_louxor: {
    Montgolfière: 4,
    "Abu Simbel": 2,
    "Transfert Assouan - Hurghada": 4,
    "Transfert Assouan - Louxor": 4,
  },
};

// Date proposée (à faire valider par la conseillère) pour la carte séparée
// d'une option de croisière — null si le sens ou le jour est inconnu, ou si
// la croisière n'a pas encore de date de début.
export function croisiereOptionDateProposee(croisiereNom: string, dateDebut: string | null, optionNom: string) {
  if (!dateDebut) return null;
  const sens = croisiereSens(croisiereNom);
  if (!sens) return null;
  const jour = CROISIERE_OPTION_JOURS[sens][optionNom];
  if (!jour) return null;
  return addDays(dateDebut, jour - 1);
}

// Tarifs de la carte séparée créée pour chaque option de croisière — repris
// du catalogue (fiches "Vol en Montgolfière (Louxor)", "Abu Simbel –
// Excursion d'une journée en privatif (depuis Assouan)" à 120€/60€, et les
// transferts privatifs, en forfait fixe quel que soit le nombre de
// personnes — jamais multiplié par un nombre de participants).
// catalogue_item_id pointe vers la vraie fiche catalogue correspondante —
// nécessaire pour que la carte séparée hérite correctement de ses propres
// règles (ex. vérification hébergement Assouan pour Abu Simbel/transferts).
export const CROISIERE_OPTION_PRICING: Record<string, Partial<Reservation>> = {
  Montgolfière: {
    tarif_mode: "personne",
    pu_adulte: 80,
    pu_enfant: 80,
    catalogue_item_id: "092814a3-fedd-454e-9709-ca1f01165170",
  },
  "Abu Simbel": {
    tarif_mode: "personne",
    pu_adulte: 120,
    pu_enfant: 60,
    catalogue_item_id: "bc267a50-f40b-40ff-a7b2-633d756e364e",
  },
  "Transfert Assouan - Hurghada": {
    tarif_mode: "groupe",
    prix_groupe_base: 180,
    catalogue_item_id: "ebdab078-bec9-44b9-8e7f-88c20ca82922",
  },
  "Transfert Assouan - Louxor": {
    tarif_mode: "groupe",
    prix_groupe_base: 140,
    catalogue_item_id: "01e22dd6-0aa1-444a-a245-e33684d892aa",
  },
};

// N° de vol / horaire d'arrivée du client (transferts aéroport) — affiché
// juste à côté du titre, pas seulement dans le détail, pour que l'équipe
// voie l'info sans ouvrir la fiche.
export function volBadge(r: Reservation) {
  if (!r.numero_vol.trim() && !r.horaire_vol.trim()) return "";
  return `✈ ${[r.numero_vol.trim(), r.horaire_vol.trim()].filter(Boolean).join(" · ")}`;
}

// Pointure(s) des clients (activités tortues, palmes fournies) — affichée
// juste à côté du titre pour la même raison que volBadge ci-dessus.
export function pointureBadge(r: Reservation) {
  if (!r.pointure.trim()) return "";
  return `👟 ${r.pointure.trim()}`;
}

// Signale qu'une activité fait partie d'un Pack — pour que l'équipe
// comprenne pourquoi son prix est réduit par rapport au tarif catalogue
// normal, même en consultant cette carte isolément.
export function packBadge(r: Reservation) {
  if (!r.pack_id || !r.pack_nom.trim()) return "";
  return `Pack : ${r.pack_nom.trim()}`;
}

// Répartit le prix du pack (prix_adulte/prix_enfant) sur chaque activité
// choisie, au prorata de son prix catalogue normal — jamais un prix à 0€
// caché sur certaines cartes : si le client annule une des activités, seule
// sa part disparaît du total, exactement comme une réservation normale.
// Repli en parts égales si la somme des prix catalogue normaux est nulle
// (ex. items sans prix catalogue renseigné).
export function packSlotPrix(
  pack: Pack,
  itemsChoisis: CatalogueItem[]
): { itemId: string; pu_adulte: number; pu_enfant: number }[] {
  const sommeAdulte = itemsChoisis.reduce((s, i) => s + (Number(i.pu_adulte) || 0), 0);
  const sommeEnfant = itemsChoisis.reduce((s, i) => s + (Number(i.pu_enfant) || 0), 0);
  const n = itemsChoisis.length || 1;
  return itemsChoisis.map((item) => {
    const pu_adulte =
      sommeAdulte > 0
        ? (pack.prix_adulte * (Number(item.pu_adulte) || 0)) / sommeAdulte
        : pack.prix_adulte / n;
    const pu_enfant =
      sommeEnfant > 0
        ? (pack.prix_enfant * (Number(item.pu_enfant) || 0)) / sommeEnfant
        : pack.prix_enfant / n;
    return {
      itemId: item.id,
      pu_adulte: Math.round(pu_adulte * 100) / 100,
      pu_enfant: Math.round(pu_enfant * 100) / 100,
    };
  });
}

// Champs requis pas encore remplis pour cette activité — logique partagée
// entre ReservationCard (bloque "Valider") et le tableau de bord/Suivis
// (liste "Activités en attente de validation"), pour ne jamais diverger.
export function missingChampsFor(
  r: Reservation,
  catalogueItem: CatalogueItem | undefined,
  assouanVerification?: AssouanVerification | null
): string[] {
  const champsRequis = catalogueItem?.champs_requis_liste || [];
  const nomPourDetection = catalogueItem?.nom || r.nom_activite;
  const ileType = speedboatIleType(nomPourDetection);
  const needsMoment = needsMomentSpeedboat(nomPourDetection);
  const missingChamps: string[] = [];
  if (ileType && !r.ile_selectionnee) missingChamps.push("Île");
  if (needsMoment && !r.moment) missingChamps.push("Moment (matin / après-midi)");
  if (champsRequis.includes("Pointure") && !r.pointure.trim()) missingChamps.push("Pointure");
  if (champsRequis.includes("Créneau (matin / après-midi / coucher de soleil)") && !r.creneau) {
    missingChamps.push("Créneau");
  }
  if (
    champsRequis.includes("Conducteurs & passagers") &&
    (r.nb_conducteurs == null || r.nb_passagers == null)
  ) {
    missingChamps.push("Conducteurs & passagers");
  }
  if (
    champsRequis.includes("Vol & horaire") &&
    (!r.numero_vol.trim() || !r.horaire_vol.trim() || !r.photo_vol_path)
  ) {
    missingChamps.push("Vol & horaire");
  }
  if (
    champsRequis.includes(
      "Site visité au Caire (musée / Saqqarah / citadelle / Grand Egyptian Museum)"
    ) &&
    !r.site_caire
  ) {
    missingChamps.push("Site visité");
  }
  const champsRequisPersonnalises = champsRequis.filter(
    (c) => !(CHAMPS_REQUIS_PRESETS as readonly string[]).includes(c)
  );
  champsRequisPersonnalises.forEach((c) => {
    if (!(r.champs_requis_coches || []).includes(c)) missingChamps.push(c);
  });
  if (catalogueItem?.necessite_verif_hebergement_assouan && assouanVerification?.statut !== "validee") {
    missingChamps.push("Vérification hébergement Assouan (Sylvie)");
  }
  return missingChamps;
}

// Comme missingChampsFor, mais élargi pour la liste "Activités en attente
// de validation" du Manager : une activité peut rester en Brouillon même
// sans aucun champ requis manquant (ex. date jamais choisie, tarif resté à
// 0€) — Sylvie doit voir la vraie raison plutôt qu'un message générique
// dans le plus de cas possible.
export function activiteEnAttenteRaisons(
  r: Reservation,
  catalogueItem: CatalogueItem | undefined,
  assouanVerification?: AssouanVerification | null
): string[] {
  const raisons = missingChampsFor(r, catalogueItem, assouanVerification);
  if (!r.date_debut) raisons.push("Date pas encore choisie");
  const tarifVide =
    r.tarif_mode === "groupe"
      ? r.prix_groupe_base === 0
      : r.pu_adulte === 0 && r.pu_enfant === 0;
  if (tarifVide) raisons.push("Tarif pas encore renseigné");
  return raisons;
}

// Les deux cas qui déclenchent une escalade "bus_escalations" (même table
// pour les deux, distingués seulement par le nom de l'activité — voir
// AddActivityWizard.tsx) : le client insiste pour le bus au lieu du
// mini-bus recommandé, ou pour le Grand Safari Bédouin malgré un groupe
// 100% adultes (pensé pour les familles). Exportées ici pour que
// BusEscalationCenter/ManagerView affichent le bon texte selon le cas.
export function isDiscouragedBusActivity(nom: string) {
  const n = (nom || "").toLowerCase();
  return (n.includes("caire") || n.includes("louxor")) && n.includes("bus") && !n.includes("mini");
}

// Le Caire : on ne vend normalement plus ce transfert (voir HELP) — avant
// de laisser l'ajouter, on avertit et on demande de vérifier avec Hossam ou
// de le vendre à 30€ minimum au lieu des 20€ catalogue.
export function isCaireAeroportTransfert(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("transfert") && n.includes("aéroport") && n.includes("caire");
}

export function isPlongee(nom: string) {
  return (nom || "").toLowerCase().includes("plongée");
}

export function isFamilySafariBedouin(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("safari") && n.includes("bédouin");
}

// Villes utilisées dans les noms catalogue de transferts privatifs (ex.
// "Transfert privatif Hurghada - Louxor") — sert à retrouver la 2e ville
// même quand le nom continue après (ex. "... Louxor avec arrêts Edfou et
// Kom Ombo") : on prend la ville connue la plus longue en préfixe du reste,
// jamais tout ce qui suit le tiret.
const VILLES_TRANSFERT_CONNUES = [
  "Le Caire",
  "Hurghada",
  "Louxor",
  "Assouan",
  "Marsa Alam",
  "Sahl Hasheesh",
  "Makadi",
  "El Gouna",
  "Safaga",
].sort((a, b) => b.length - a.length);

export type SensTransfertOption = { value: string; label: string; titre: string };

// Les transferts aéroport et privatifs peuvent se faire dans les deux sens
// (ex. aéroport → hôtel ou hôtel → aéroport ; Hurghada → Louxor ou l'inverse)
// — on demande le sens dès la sélection dans le catalogue et le titre
// affiché est mis à jour en conséquence. Retourne un tableau vide si le nom
// ne correspond à aucun des deux formats.
export function transfertSensOptions(nomCatalogue: string): SensTransfertOption[] {
  const aeroport = nomCatalogue.match(/^Transfert aéroport - (.+)$/);
  if (aeroport) {
    const ville = aeroport[1];
    return [
      {
        value: "aeroport_hotel",
        label: "Aéroport → Hôtel",
        titre: `Transfert aéroport ${ville} - hôtel (Aéroport → Hôtel)`,
      },
      {
        value: "hotel_aeroport",
        label: "Hôtel → Aéroport",
        titre: `Transfert hôtel ${ville} - aéroport (Hôtel → Aéroport)`,
      },
    ];
  }

  const privatif = nomCatalogue.match(/^Transfert privatif (.+)$/);
  if (privatif) {
    const reste = privatif[1];
    const dashIdx = reste.indexOf(" - ");
    if (dashIdx === -1) return [];
    const villeA = reste.slice(0, dashIdx).trim();
    const apres = reste.slice(dashIdx + 3);
    const villeB = VILLES_TRANSFERT_CONNUES.find((v) => apres.startsWith(v));
    if (!villeA || !villeB) return [];
    const suffixe = apres.slice(villeB.length).trim();
    const suffixeStr = suffixe ? ` ${suffixe}` : "";
    return [
      {
        value: "direct",
        label: `${villeA} → ${villeB}`,
        titre: `Transfert privatif ${villeA} - ${villeB}${suffixeStr}`,
      },
      {
        value: "inverse",
        label: `${villeB} → ${villeA}`,
        titre: `Transfert privatif ${villeB} - ${villeA}${suffixeStr}`,
      },
    ];
  }

  return [];
}

// Le Caire, Louxor et Assouan sont hors de la région Hurghada — un transfert
// aéroport vers l'une de ces villes ne peut donc jamais avoir de "taxe de
// transfert région Hurghada" (concept lié à l'hôtel du CLIENT, sans rapport
// avec l'activité elle-même) : le message "cet hôtel est bien/n'est pas sur
// Hurghada" n'a pas de sens pour ces 3 activités et induit en erreur.
export function isAeroportTransfertHorsHurghada(nomActivite: string) {
  const n = (nomActivite || "").toLowerCase();
  if (!n.startsWith("transfert aéroport") && !n.startsWith("transfert hôtel")) return false;
  return n.includes("caire") || n.includes("louxor") || n.includes("assouan");
}

// Certaines activités catalogue durent plusieurs jours consécutifs (Le
// Caire/Louxor 2 jours, Montgolfière 2 jours, Siwa 2 ou 3 jours, croisières
// 4 ou 5 jours...) — le nom catalogue suffit à déduire le nombre de jours,
// pour présélectionner automatiquement la date de fin dès la date de début
// choisie (le jour de début reste, lui, validé par jours_disponibles/
// JourIndisponibleAlert comme pour toute activité). Les circuits ne sont
// volontairement pas couverts ici (plus complexes — plusieurs villes/étapes).
export function dureeJoursActivite(nom: string): number | null {
  const n = (nom || "").toLowerCase();
  const match = n.match(/(\d+)\s*jours?\b/);
  if (match && Number(match[1]) >= 2) return Number(match[1]);
  // Ex. "Louxor 1 jour visites & 1 jour Montgolfière" — 2 jours au total
  // sans que "2 jours" apparaisse littéralement dans le nom.
  if (n.includes("1 jour") && n.includes("montgolfi")) return 2;
  return null;
}

// Distingue le sens à partir du titre actuel — utilisé pour adapter le
// libellé du champ horaire ("arrivée" vs "départ") au bon moment du trajet.
export function senseTransfertAeroport(
  nomActiviteActuel: string
): "aeroport_hotel" | "hotel_aeroport" | null {
  if (/^Transfert aéroport .+? - hôtel\b/.test(nomActiviteActuel)) return "aeroport_hotel";
  if (/^Transfert hôtel .+? - aéroport\b/.test(nomActiviteActuel)) return "hotel_aeroport";
  return null;
}

// Les îles proposées pour les formules speedboat privé "journée complète"
// et "demi-journée" — le client doit en choisir une avant de continuer.
export const SPEEDBOAT_ILES = ["Orange Bay", "Paradise", "Hula Hula", "Magawish", "Oziréa"] as const;

export function isSpeedboat(nom: string) {
  return (nom || "").toLowerCase().includes("speedboat");
}

// Trajet fixe aller-retour Hurghada ↔ Le Caire, même jour — le billet_requis
// et les villes s'en déduisent automatiquement, plus besoin de case à cocher
// manuelle.
export function isLeCaireEnAvion(nom: string) {
  return (nom || "").trim().toLowerCase() === "le caire en avion";
}

// Autres cas où l'agence achète elle-même un billet d'avion intérieur pour
// le client — l'activité générique "Billets d'avion" (vols achetés au cas
// par cas, hors trajet fixe du Caire) et tous les circuits multi-jours.
// Contrairement au Caire en avion, pas de trajet connu à l'avance : les
// villes restent à remplir à la main dans le tableau des billets d'avion.
export function needsBilletInterneGenerique(nom: string) {
  const n = (nom || "").trim().toLowerCase();
  return n === "billets d'avion" || n.includes("circuit");
}

// Item catalogue générique dont le titre n'est pas fixe : au lieu du nom du
// catalogue, on demande à l'employé de le taper lui-même dès la sélection
// (ex. "Transfert marina aller / retour") — voir AddActivityWizard.tsx.
export function isTitreLibreActivity(nom: string) {
  return (nom || "").trim().toLowerCase() === "transfert aléatoire";
}

export type ReglementAnnulation = {
  remboursable: boolean;
  raison: string;
  prevenirHossam: boolean;
};

// Calcule si une activité annulée maintenant serait remboursable — jamais
// deviné depuis le nom de l'activité en texte libre (trop risqué sur une
// histoire d'argent), toujours à partir de billet_requis et de la règle
// d'annulation réglée une fois pour toutes sur l'activité du Catalogue.
// Règles validées avec Mélanie (2026-08) : billet d'avion et croisière/
// hôtel jamais remboursables sauf exception Hossam ; Siwa/Désert Blanc non
// remboursables sous 10 jours ; le reste (Hurghada) sous 24h, les
// excursions culturelles hors Hurghada sous 48h ; une annulation après la
// date de l'activité compte comme non-présentation, jamais remboursée.
export function reglementAnnulation(
  r: Reservation,
  catalogueItem: CatalogueItem | undefined,
  now: Date
): ReglementAnnulation {
  if (r.date_debut) {
    const heuresAvant = (Date.parse(r.date_debut + "T00:00:00") - now.getTime()) / 3600000;
    if (heuresAvant < 0) {
      return { remboursable: false, raison: "Non-présentation (date déjà passée)", prevenirHossam: false };
    }
    if (r.billet_requis) {
      return {
        remboursable: false,
        raison: "Billet d'avion requis — non remboursable sauf exception Hossam",
        prevenirHossam: true,
      };
    }
    const regle = catalogueItem?.regle_annulation || "hurghada_24h";
    if (regle === "non_remboursable") {
      return {
        remboursable: false,
        raison: "Activité non remboursable (croisière, hôtel...) sauf exception Hossam",
        prevenirHossam: true,
      };
    }
    if (regle === "siwa_desert_10j") {
      const joursAvant = heuresAvant / 24;
      return joursAvant >= 10
        ? { remboursable: true, raison: "Annulé à 10 jours ou plus — remboursable", prevenirHossam: false }
        : { remboursable: false, raison: "Annulé à moins de 10 jours — non remboursable", prevenirHossam: false };
    }
    const seuilHeures = regle === "culturelle_48h" ? 48 : 24;
    return heuresAvant >= seuilHeures
      ? { remboursable: true, raison: `Annulé à ${seuilHeures}h ou plus — remboursable`, prevenirHossam: false }
      : {
          remboursable: false,
          raison: `Annulé à moins de ${seuilHeures}h — non remboursable`,
          prevenirHossam: false,
        };
  }
  // Pas de date : on ne peut pas calculer de délai, on part du principe le
  // plus prudent pour l'agence.
  return { remboursable: false, raison: "Date d'activité inconnue", prevenirHossam: false };
}

// Le solde/acompte est unique par séjour (jamais par activité) — proposer un
// remboursement n'a de sens que si de l'argent a réellement été encaissé
// (acompte encaissé ou solde payé). Sans ça, "rembourser" rendrait de
// l'argent que l'agence n'a jamais reçu.
export function clientAPayeQuelqueChose(client: Client) {
  return !!((client.paiement_type === "acompte" && client.acompte_valide && client.acompte_paye) || client.solde_paye);
}

const BILLET_ETAPE_SHORT_LABELS: Record<string, string> = {
  attente_acompte: "Acompte en attente",
  a_envoyer_hossam: "À envoyer à Hossam",
  attente_hossam: "En attente du billet",
  a_envoyer_client: "Reçu — à envoyer au client",
  termine: "Envoyé au client",
};

export function billetEtapeShortLabel(etape: string) {
  return BILLET_ETAPE_SHORT_LABELS[etape] || etape;
}

// Patch à appliquer quand la photo/le fichier du billet est ajouté (ou
// retiré) à la réservation — factorisé pour que ReservationCard et la fiche
// détail de Suivis > Billets d'avion avancent l'étape et horodatent la
// réception exactement de la même façon (nécessaire pour que les rappels
// "pensez à l'envoyer au client" démarrent au bon moment, peu importe où le
// fichier a été déposé).
export function billetUploadPatch(r: Reservation, path: string | null): Partial<Reservation> {
  const patch: Partial<Reservation> = { billet_lien: path || "" };
  if (path && (r.billet_etape === "attente_hossam" || r.billet_etape === "a_envoyer_hossam")) {
    patch.billet_etape = "a_envoyer_client";
    patch.billet_recu_le = new Date().toISOString();
  }
  return patch;
}

// Message prêt à coller dans le groupe WhatsApp "only flight ticket" avec
// Hossam — dateLabel est déjà formatée par l'appelant (chaque écran a sa
// propre fonction de format de date locale).
// Message prêt à coller tel quel dans le groupe WhatsApp "only flight
// ticket" avec Hossam — un nom par ligne (extraits des passeports dans
// billet_nom_complet, séparés par une virgule ou un retour à la ligne selon
// comment l'employée les a saisis), format jj/mm sans année.
export function hossamBilletMessage(r: Reservation, client: Client) {
  const dateLabel = r.billet_date
    ? (() => {
        const d = new Date(r.billet_date + "T00:00:00");
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      })()
    : "?";
  const noms = (r.billet_nom_complet || "")
    .split(/[\n,]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  const listeNoms = (noms.length > 0 ? noms : [client.nom || "Nom ?"]).map((n) => `- ${n}`).join("\n");
  return `Can you please book Cairo plane tickets for ${dateLabel} :\n${listeNoms}\nThey sent deposit ✅`;
}

// Balade à cheval / chameau — un enfant peut monter seul (son propre animal,
// tarif enfant plein) ou derrière un adulte (tarif accompagnateur) : la
// réponse se demande par enfant, avant l'étape des tarifs.
export function isChevalOuChameau(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("cheval") || n.includes("chameau");
}

// Le tarif adulte/enfant d'une balade à cheval/chameau est un tarif "par
// animal", pas "par personne" : un enfant seul sur son propre cheval/chameau
// paie plein tarif adulte, ce qui ne va pas de soi si le prix est juste
// affiché "Adulte X€" comme pour les autres activités.
export function chevalOuChameauMot(nom: string): "cheval" | "chameau" | "" {
  const n = (nom || "").toLowerCase();
  if (n.includes("chameau")) return "chameau";
  if (n.includes("cheval")) return "cheval";
  return "";
}

// Quad (Safari quad, Safari quad & dîner spectacle, au coucher du soleil…) —
// même logique que cheval/chameau : avec des enfants ou des ados, un quad
// par participant n'est pas automatique (ex. enfant en passager derrière un
// conducteur), donc on recommande d'écrire le texte affiché à la main.
export function isQuad(nom: string) {
  return (nom || "").toLowerCase().includes("quad");
}

// Montgolfière (Louxor) — interdite aux moins de 7 ans. Les 0-3 ans ne
// paient rien et ne montent pas ; les 4-7 ans ne montent pas non plus mais
// peuvent être du voyage (visites), au tarif "enfant 3 ans" du catalogue —
// champ réutilisé pour cette tranche d'âge précisément sur ces activités.
export function isMontgolfiereActivity(nom: string) {
  return (nom || "").toLowerCase().includes("montgolfi");
}

// Période haute saison récurrente chaque année (ex. croisières Nil : 20
// décembre au 7 janvier), définie en jour/mois "MM-DD" sur le catalogue —
// peut chevaucher le 31 décembre (ex. "12-20" à "01-07").
export function isDateInSaisonRange(
  dateStr: string | null,
  debutMMDD: string,
  finMMDD: string
): boolean {
  if (!dateStr || !debutMMDD || !finMMDD) return false;
  const md = dateStr.slice(5, 10);
  if (debutMMDD <= finMMDD) return md >= debutMMDD && md <= finMMDD;
  return md >= debutMMDD || md <= finMMDD;
}

// Tarif attendu pour une date donnée si l'activité a une haute saison
// configurée et que la date choisie tombe dedans — null sinon (pas de
// haute saison définie, ou date hors période).
export function hauteSaisonAttendu(
  dateStr: string | null,
  item: Pick<
    CatalogueItem,
    "haute_saison_debut" | "haute_saison_fin" | "haute_saison_pu_adulte" | "haute_saison_pu_enfant"
  >
): { pu_adulte: number; pu_enfant: number } | null {
  if (!isDateInSaisonRange(dateStr, item.haute_saison_debut, item.haute_saison_fin)) return null;
  return { pu_adulte: item.haute_saison_pu_adulte, pu_enfant: item.haute_saison_pu_enfant };
}

// Moment de la journée effectif d'une réservation, tous champs confondus —
// "creneau" (cheval/quad) et "moment" (speedboat…) désignent la même notion
// sous deux noms différents selon le type d'activité. "Journée" et "Plusieurs
// jours" ne sont pas un moment précis, donc ignorés pour la détection de
// chevauchement ci-dessous.
export function momentDeLaJournee(r: Reservation) {
  if (r.creneau) return r.creneau;
  if (r.moment && r.moment !== "Journée" && r.moment !== "Plusieurs jours") return r.moment;
  return "";
}

// Deux activités du même client à la même date et au même moment de la
// journée sont probablement une erreur de saisie (l'équipe ne peut pas être
// à deux endroits en même temps) — on renvoie la première réservation en
// conflit avec celle qui vient d'être modifiée, pour prévenir tout de suite.
export function findMomentConflict(
  reservations: Reservation[],
  reservationId: string
): Reservation | null {
  const current = reservations.find((r) => r.id === reservationId);
  if (!current || !current.date_debut) return null;
  const moment = momentDeLaJournee(current);
  if (!moment) return null;
  return (
    reservations.find(
      (r) =>
        r.id !== reservationId &&
        r.date_debut === current.date_debut &&
        momentDeLaJournee(r).toLowerCase() === moment.toLowerCase()
    ) || null
  );
}

// Nombre d'animaux à réserver, affiché en anglais à côté du titre (équipe
// côté Égypte) avec une icône "important" — calculé à l'affichage plutôt
// que figé dans le titre au moment de la création, pour rester juste même
// si les participants sont modifiés ensuite depuis la fiche complète.
export function chevalChameauBadge(r: Reservation, client: Client) {
  if (!isChevalOuChameau(r.nom_activite)) return "";
  const { nbAd } = participantsFor(r, client);
  if (nbAd <= 0) return "";
  const estChameau = r.nom_activite.toLowerCase().includes("chameau");
  const animalLabel = estChameau ? `camel${nbAd > 1 ? "s" : ""}` : `horse${nbAd > 1 ? "s" : ""}`;
  return `❗ ${nbAd} ${animalLabel}`;
}

// D'anciennes activités ont pu se retrouver avec ce même texte figé "en
// dur" dans le titre (avant que ça devienne un badge calculé à part) — on
// le retire à l'affichage pour ne jamais le montrer en double.
export function cleanActivityTitle(nom: string) {
  return (nom || "").replace(/\s*—\s*❗\s*\d+\s*(horses?|camels?)\s*$/i, "");
}

export function isSpeedboatSunset(nom: string) {
  const n = (nom || "").toLowerCase();
  return isSpeedboat(n) && n.includes("sunset");
}

// 'complete' | 'demi' | null — les deux formules speedboat où le client doit
// choisir son île (catalogue : "... journée complète avec 1 île" / "...
// demi-journée avec 1 île").
export function speedboatIleType(nom: string): "complete" | "demi" | null {
  const n = (nom || "").toLowerCase();
  if (!isSpeedboat(n) || !n.includes("île")) return null;
  if (n.includes("journée complète")) return "complete";
  if (n.includes("demi-journée") || n.includes("demi journée")) return "demi";
  return null;
}

// Le titre affiché une fois l'île choisie — remplace le nom générique du
// catalogue ("... avec 1 île") par l'île réellement sélectionnée. L'option
// "2ème île" (voir OPTIONS_PRESETS) ajoute une seconde île au titre.
export function speedboatIleTitre(iType: "complete" | "demi", ile: string, ile2?: string) {
  const iles = ile2 ? `${ile} + ${ile2}` : ile;
  return iType === "demi" ? `Speedboat privé 4h avec ${iles}` : `Speedboat privé journée complète avec ${iles}`;
}

// "Journée" s'applique automatiquement, sans jamais le demander : le
// speedboat privé journée complète avec île, et les semi-privés Magawish et
// Oziréa n'ont qu'une seule formule horaire possible.
export function isSpeedboatFixedJournee(nom: string) {
  const n = (nom || "").toLowerCase();
  if (speedboatIleType(nom) === "complete") return true;
  return isSpeedboat(n) && n.includes("semi-privé") && (n.includes("magawish") || n.includes("oziréa"));
}

export function isSpeedboatPriveMaisonDauphins(nom: string) {
  const n = (nom || "").toLowerCase();
  return isSpeedboat(n) && n.includes("maison des dauphins") && !n.includes("semi");
}

export function isSpeedboatSemiPriveMaisonDauphins(nom: string) {
  const n = (nom || "").toLowerCase();
  return isSpeedboat(n) && n.includes("semi-privé") && n.includes("maison des dauphins");
}

export function isSeascope(nom: string) {
  return (nom || "").toLowerCase().includes("seascope");
}

// En dehors du sunset (horaire fixe), des formules "journée" fixes, et du
// semi-privé Maison des dauphins, tous les speedboat doivent préciser
// matin/après-midi — comme Seascope, qui utilisait jusqu'ici une case à
// cocher générique "Matin / Après-midi" sans que le choix ne se retrouve
// nulle part (ni dans le titre, ni utilisable pour filtrer/trier).
export function needsMomentSpeedboat(nom: string) {
  if (isSeascope(nom)) return true;
  if (!isSpeedboat(nom)) return false;
  if (isSpeedboatSunset(nom)) return false;
  if (isSpeedboatSemiPriveMaisonDauphins(nom)) return false;
  if (isSpeedboatFixedJournee(nom)) return false;
  return true;
}

// Choisir "Coucher de soleil" sur un Safari quad classique le transforme en
// la formule dédiée du catalogue — pas de simple suffixe sur le titre.
export function isSafariQuadBase(nom: string) {
  return (nom || "").toLowerCase().trim() === "safari quad";
}

// Pré-remplissage du forfait groupe : le forfait de base couvre déjà
// prix_groupe_base_pax personnes (des adultes en priorité) — seuls les
// adultes au-delà de ce nombre sont "en supplément". Les enfants ne sont
// jamais inclus dans le forfait de base, donc comptent tous en supplément.
export function groupeExtraCounts(nbAd: number, nbEnf: number, basePax: number, nbBebe: number = 0) {
  return {
    extra1: Math.max(0, nbAd - (Number(basePax) || 0)),
    extraEnfants: nbEnf,
    extraBebes: nbBebe,
  };
}

// Détecte l'intention "2ème île" sur le nom d'une option de manière souple
// (pas une égalité stricte avec le preset "2ème île") — certains catalogues
// ont déjà leur propre libellé pour cette option (ex. "Ajout d'une 2è île
// (=2 pax)"), créé avant l'ajout du preset ou reformulé à la main.
export function isDeuxiemeIleOption(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("île") && (n.includes("2") || n.includes("deux"));
}

// Affichage d'une option sur les cartes — les options vendues par
// participant (ex. Parachute, quantite > 1) doivent montrer le nombre
// dessus ("+5 participants Parachute"), les autres restent un simple nom.
export function formatOptionLabel(o: ReservationOption) {
  const quantite = Number(o.quantite) || 1;
  return quantite > 1 ? `+${quantite} participants ${o.nom}` : o.nom;
}

// Le champ ages_enfants/ages_bebes contient parfois juste des nombres
// ("4, 10", saisis via l'éditeur d'âges) et parfois déjà une phrase complète
// ("4 et 10 ans", copiée depuis Kommo) — sans ce garde-fou, l'affichage
// ajoutait systématiquement " ans" et doublait le mot pour le second cas.
export function agesLabel(ages: string) {
  const clean = (ages || "").trim();
  if (!clean) return "";
  return /\bans?\b/i.test(clean) ? ` (${clean})` : ` (${clean} ans)`;
}

export function participantsFor(r: Reservation, client: Client) {
  const nbAd =
    r.participants_mode === "tous" ? Number(client.adultes) || 0 : Number(r.participants_adultes) || 0;
  const nbEnf =
    r.participants_mode === "tous" ? Number(client.enfants) || 0 : Number(r.participants_enfants) || 0;
  // Le bébé se déduit du séjour du client comme adulte/enfant en mode
  // "tous" (c'est un vrai trait du séjour, pas propre à une activité).
  const nbBebe =
    r.participants_mode === "tous" ? Number(client.bebes) || 0 : Number(r.participants_bebes) || 0;
  // L'accompagnateur n'existe qu'au niveau d'une réservation précise (ex.
  // plongée) — pas de notion d'accompagnateur au niveau du séjour du
  // client, donc rien à récupérer en mode "tous".
  const nbAcc = r.participants_mode === "tous" ? 0 : Number(r.participants_accompagnateurs) || 0;
  // Même logique que l'accompagnateur : le tarif enfant 3 ans (ex. Le Caire
  // en avion) se saisit au cas par cas sur la réservation, jamais déduit du
  // total d'enfants du séjour.
  const nbEnf3 = r.participants_mode === "tous" ? 0 : Number(r.participants_enfants_3ans) || 0;
  return { nbAd, nbEnf, nbBebe, nbAcc, nbEnf3 };
}

// Résumé PAX partagé par la fiche client et la vue Réservations — l'ancienne
// version dupliquée dans chacune des deux vues avait fini par diverger (le
// bébé manquait dans l'une des deux), d'où ce point d'entrée unique.
export function paxLine(r: Reservation, client: Client) {
  if (r.pax_override) return r.pax_override;
  const { nbAd, nbEnf, nbBebe } = participantsFor(r, client);
  const showAges = r.participants_mode === "tous";
  const parts: string[] = [];
  let adLabel = `${nbAd} adulte${nbAd > 1 ? "s" : ""}`;
  if (showAges && client.ados_presents && client.ages_ados) {
    adLabel += ` (dont ados ${client.ages_ados})`;
  }
  parts.push(adLabel);
  if (nbEnf > 0) {
    let s = `${nbEnf} enfant${nbEnf > 1 ? "s" : ""}`;
    if (showAges && client.ages_enfants) s += ` (${client.ages_enfants} ans)`;
    parts.push(s);
  }
  if (nbBebe > 0) {
    let s = `${nbBebe} bébé${nbBebe > 1 ? "s" : ""}`;
    if (showAges && client.ages_bebes) s += ` (${client.ages_bebes} ans)`;
    parts.push(s);
  }
  return parts.join(", ");
}

// "encaissé le 31-08-2026 à 16h22" quand on a l'heure précise (rattachement
// automatique d'un paiement PayPal) — sinon juste la date (saisie manuelle,
// qui n'a pas d'heure fiable).
export function fmtEncaisseLe(dateEncaissement: string | null, encaisseTs: string | null) {
  if (!dateEncaissement) return "";
  const [y, m, d] = dateEncaissement.split("-");
  const dateLabel = `${d}-${m}-${y}`;
  if (!encaisseTs) return dateLabel;
  const dt = new Date(encaisseTs);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${dateLabel} à ${hh}h${mm}`;
}

// Activités "partagées" (un même véhicule/bateau pour plusieurs clients) où
// on veut pousser les ventes pour remplir un groupe plutôt que d'en ouvrir
// un second à moitié vide. La capacité sert à calculer le reste (voir
// sharedActivityAlerts) — jamais à comparer le total brut au seuil, sinon
// un groupe qui dépasse la capacité (nouveau véhicule entamé) arrête d'être
// signalé alors qu'il a justement besoin d'être rempli à son tour.
export type SharedActivityInfo = { label: string; capacite: number };

export function sharedActivityCapacity(nom: string): SharedActivityInfo | null {
  const n = (nom || "").toLowerCase();
  if (n.includes("speedboat") && n.includes("semi") && n.includes("dauphins")) {
    return { label: "Speedboat semi-privé maison des dauphins", capacite: 6 };
  }
  if (n.includes("speedboat") && n.includes("semi") && n.includes("oziréa")) {
    return { label: "Speedboat semi-privé Oziréa", capacite: 6 };
  }
  if (n.includes("speedboat") && n.includes("semi") && n.includes("magawish")) {
    return { label: "Speedboat semi-privé Magawish", capacite: 6 };
  }
  if (n.includes("caire") && n.includes("mini-bus") && n.includes("vip")) {
    return { label: "Le Caire en mini-bus VIP", capacite: 8 };
  }
  if (n.includes("caire") && n.includes("mini-bus")) {
    return { label: "Le Caire en mini-bus", capacite: 8 };
  }
  if (n.includes("louxor") && n.includes("mini-bus")) {
    return { label: "Louxor en mini-bus", capacite: 8 };
  }
  return null;
}

export type SharedActivityAlert = {
  label: string;
  date: string;
  capacite: number;
  reste: number;
};

// Une alerte par (activité, date) dès qu'un groupe est entamé mais pas
// complet — le reste de la division par la capacité, pas le seuil brut :
// 2 pers. → reste 2 (à remplir) ; 6 pers. (bateau plein) → reste 0, silence ;
// 8 pers. → reste 2, un DEUXIÈME bateau vient de s'ouvrir avec 2 personnes,
// l'alerte revient donc automatiquement au lieu de rester éteinte.
export function sharedActivityAlerts(
  clients: Client[],
  reservations: Reservation[],
  todayStr: string,
  endStr: string
): SharedActivityAlert[] {
  const totals = new Map<string, number>();
  reservations.forEach((r) => {
    if (!r.date_debut || r.date_debut < todayStr || r.date_debut > endStr) return;
    const info = sharedActivityCapacity(r.nom_activite);
    if (!info) return;
    const client = clients.find((c) => c.id === r.client_id);
    if (!client) return;
    const { nbAd, nbEnf } = participantsFor(r, client);
    const key = `${info.label}|${r.date_debut}|${info.capacite}`;
    totals.set(key, (totals.get(key) || 0) + nbAd + nbEnf);
  });
  const alerts: SharedActivityAlert[] = [];
  totals.forEach((total, key) => {
    const [label, date, capaciteStr] = key.split("|");
    const capacite = Number(capaciteStr);
    const reste = total % capacite;
    if (reste > 0) alerts.push({ label, date, capacite, reste });
  });
  return alerts.sort((a, b) => a.date.localeCompare(b.date));
}

export function resaTotalMontant(
  r: Reservation,
  client: Client,
  options: ReservationOption[] = [],
  tarifs: ReservationTarif[] = []
) {
  const { nbAd, nbEnf, nbBebe, nbAcc, nbEnf3 } = participantsFor(r, client);
  // Forfait groupe (ex. speedboat, yacht) : le prix n'est pas par personne
  // mais un forfait de base pour un nombre de personnes inclus, plus un
  // tarif par personne supplémentaire et par enfant supplémentaire — ces
  // compteurs se saisissent au cas par cas, comme l'accompagnateur ou
  // l'enfant 3 ans, jamais déduits du séjour du client. pu_bebe est
  // réutilisé comme "PU bébé supp." en forfait groupe (comme le catalogue).
  const base =
    r.tarif_mode === "groupe"
      ? (Number(r.prix_groupe_base) || 0) +
        (Number(r.participants_extra1) || 0) * (Number(r.prix_groupe_extra1) || 0) +
        (Number(r.participants_extra_enfants) || 0) * (Number(r.prix_groupe_extra_enfant) || 0) +
        (Number(r.participants_extra_bebes) || 0) * (Number(r.pu_bebe) || 0)
      : nbAd * (Number(r.pu_adulte) || 0) +
        nbEnf * (Number(r.pu_enfant) || 0) +
        nbBebe * (Number(r.pu_bebe) || 0) +
        nbAcc * (Number(r.pu_accompagnateur) || 0) +
        nbEnf3 * (Number(r.pu_enfant_3ans) || 0);
  // Une option de croisière avec carte séparée (Montgolfière, Abu Simbel,
  // transfert) ne compte jamais ici — son prix est déjà sur sa propre carte.
  const optionsTotal = options.reduce(
    (s, o) => s + (o.prix_compte_ailleurs ? 0 : (Number(o.prix) || 0) * (Number(o.quantite) || 1)),
    0
  );
  const tarifsTotal = tarifs.reduce((s, t) => s + (Number(t.quantite) || 0) * (Number(t.pu) || 0), 0);
  const transfert = r.transfert_inclus ? 0 : Number(r.transfert_montant) || 0;
  // L'île Oziréa applique un supplément fixe par personne, quel que soit le
  // mode de tarification (forfait groupe pour ces speedboat) — appliqué
  // automatiquement dès que l'île est sélectionnée, jamais à saisir à la main.
  const supplementIle = r.ile_selectionnee === "Oziréa" ? nbAd * 30 + nbEnf * 15 : 0;
  const supplementGEM = isGrandEgyptianMuseum(r.site_caire) ? nbAd * 20 + nbEnf * 10 : 0;
  const brut = base + optionsTotal + tarifsTotal + transfert + supplementIle + supplementGEM;
  // Activité offerte : le client ne paie rien, quel que soit le montant
  // enregistré (mis à jour pour suivre le total au moment où c'est décidé,
  // mais toujours plafonné au total réel pour ne jamais passer en négatif).
  const reduction = r.activite_offerte ? brut : Math.min(Math.max(Number(r.reduction_montant) || 0, 0), brut);
  return brut - reduction;
}

// Le Grand Egyptian Museum (nouveau musée) est en supplément par rapport aux
// autres sites du Caire — appliqué automatiquement dès qu'il est choisi comme
// site visité, jamais à saisir à la main. Gratuit pour les moins de 3 ans
// (déjà exclus de nbEnf, voir participantsFor).
export function isGrandEgyptianMuseum(siteCaire: string) {
  return siteCaire === "Grand Egyptian Museum (nouveau musée)";
}

// Libellé court en anglais du site du Caire choisi (pour l'équipe Égypte),
// affiché à côté du titre — les pyramides sont toujours visitées, seul le
// deuxième site varie selon le choix fait dans le pas-à-pas.
const SITE_CAIRE_EN: Record<string, string> = {
  "Musée du Caire (ancien musée)": "old museum",
  Saqqarah: "saqqarah",
  "Citadelle Mohamed Ali": "citadel",
  "Grand Egyptian Museum (nouveau musée)": "new museum",
};

export function siteCaireBadge(r: Reservation): string {
  if (!r.site_caire) return "";
  return `(pyramids + ${SITE_CAIRE_EN[r.site_caire] || r.site_caire})`;
}

// Même info que siteCaireBadge, mais au format attendu par le bloc équipe
// Égypte (Title Case, "New Museum GEM" plutôt que "new museum" pour éviter
// toute confusion avec l'ancien musée).
const SITE_CAIRE_EGYPT: Record<string, string> = {
  "Musée du Caire (ancien musée)": "Old Museum",
  Saqqarah: "Saqqarah",
  "Citadelle Mohamed Ali": "Citadel",
  "Grand Egyptian Museum (nouveau musée)": "New Museum GEM",
};

export function siteCaireEgyptLine(r: Reservation): string {
  if (!r.site_caire) return "";
  return `(Pyramids + ${SITE_CAIRE_EGYPT[r.site_caire] || r.site_caire})`;
}

// Certaines activités du catalogue n'ont lieu que certains jours de la
// semaine (ex. Louxor en mini-bus : mardi/jeudi/dimanche seulement) — un
// jours_disponibles vide veut dire "tous les jours", jamais "aucun jour".
export function joursDisponiblesMismatch(dateStr: string | null, joursDisponibles: string[]) {
  if (!dateStr || !joursDisponibles || joursDisponibles.length === 0) return false;
  return !normalizeJoursDisponibles(joursDisponibles).includes(weekdayFr(dateStr));
}

// Certaines fiches catalogue ont accumulé le même jour en double casse
// ("lundi" et "Lundi") au fil des ressaisies — on ne veut jamais l'afficher
// deux fois ni comparer les jours en étant sensible à la casse.
export function normalizeJoursDisponibles(joursDisponibles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (joursDisponibles || []).forEach((j) => {
    const key = j.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key.charAt(0).toUpperCase() + key.slice(1));
  });
  return out;
}

export function joursDisponiblesLabel(joursDisponibles: string[]) {
  return normalizeJoursDisponibles(joursDisponibles).join(", ");
}

function fmtEuros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function fmtDateFr(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export type ResaBreakdownLine = { label: string; amount: number };

// Détail du calcul du total d'une activité (ex. "25 € x 2 adultes = 50,00 €")
// — même composition que resaTotalMontant, ligne par ligne pour l'affichage.
export function resaBreakdown(
  r: Reservation,
  client: Client,
  options: ReservationOption[] = [],
  tarifs: ReservationTarif[] = [],
  allReservations: Reservation[] = [],
  hotelVille?: string
): ResaBreakdownLine[] {
  const { nbAd, nbEnf, nbBebe, nbAcc, nbEnf3 } = participantsFor(r, client);
  const lines: ResaBreakdownLine[] = [];

  if (r.tarif_mode === "groupe") {
    if (Number(r.prix_groupe_base) || 0) {
      lines.push({ label: "Forfait de base", amount: Number(r.prix_groupe_base) || 0 });
    }
    if (Number(r.participants_extra1) || 0) {
      lines.push({
        label: `${fmtEuros(r.prix_groupe_extra1)} € x ${r.participants_extra1} pers. supp.`,
        amount: (Number(r.participants_extra1) || 0) * (Number(r.prix_groupe_extra1) || 0),
      });
    }
    if (Number(r.participants_extra_enfants) || 0) {
      lines.push({
        label: `${fmtEuros(r.prix_groupe_extra_enfant)} € x ${r.participants_extra_enfants} enfant(s) supp.`,
        amount: (Number(r.participants_extra_enfants) || 0) * (Number(r.prix_groupe_extra_enfant) || 0),
      });
    }
    // pu_bebe est réutilisé comme "PU bébé supp." en forfait groupe (comme
    // le fait déjà le catalogue) — pas toujours 0€ (ex. Le Caire en avion).
    if (Number(r.participants_extra_bebes) || 0) {
      lines.push({
        label: `${fmtEuros(r.pu_bebe)} € x ${r.participants_extra_bebes} bébé(s) supp.`,
        amount: (Number(r.participants_extra_bebes) || 0) * (Number(r.pu_bebe) || 0),
      });
    }
  } else {
    if (nbAd > 0) {
      lines.push({
        label: `${fmtEuros(r.pu_adulte)} € x ${nbAd} adulte${nbAd > 1 ? "s" : ""}`,
        amount: nbAd * (Number(r.pu_adulte) || 0),
      });
    }
    if (nbEnf > 0) {
      lines.push({
        label: `${fmtEuros(r.pu_enfant)} € x ${nbEnf} enfant${nbEnf > 1 ? "s" : ""}`,
        amount: nbEnf * (Number(r.pu_enfant) || 0),
      });
    }
    if (nbBebe > 0) {
      lines.push({
        label: `${fmtEuros(r.pu_bebe)} € x ${nbBebe} bébé${nbBebe > 1 ? "s" : ""}`,
        amount: nbBebe * (Number(r.pu_bebe) || 0),
      });
    }
    if (nbAcc > 0) {
      lines.push({
        label: `${fmtEuros(r.pu_accompagnateur)} € x ${nbAcc} accompagnateur${nbAcc > 1 ? "s" : ""}`,
        amount: nbAcc * (Number(r.pu_accompagnateur) || 0),
      });
    }
    if (nbEnf3 > 0) {
      lines.push({
        label: `${fmtEuros(r.pu_enfant_3ans)} € x ${nbEnf3} enfant(s) 3 ans`,
        amount: nbEnf3 * (Number(r.pu_enfant_3ans) || 0),
      });
    }
  }

  options.forEach((o) => {
    const qty = Number(o.quantite) || 1;
    if (o.prix_compte_ailleurs) {
      const carte = allReservations.find(
        (rr) => rr.parent_reservation_id === r.id && rr.nom_activite === o.nom
      );
      lines.push({
        label: carte?.date_debut
          ? `Option ${o.nom} — prix compté sur sa carte du ${fmtDateFr(carte.date_debut)}`
          : `Option ${o.nom} — prix compté sur sa carte séparée`,
        amount: 0,
      });
      return;
    }
    lines.push({
      label: qty > 1 ? `Option ${o.nom} (${fmtEuros(o.prix)} € x ${qty})` : `Option ${o.nom}`,
      amount: (Number(o.prix) || 0) * qty,
    });
  });

  tarifs.forEach((t) => {
    if (!Number(t.quantite)) return;
    lines.push({
      label: `${t.label || "PU supplémentaire"} (${fmtEuros(t.pu)} € x ${t.quantite})`,
      amount: (Number(t.quantite) || 0) * (Number(t.pu) || 0),
    });
  });

  if (!r.transfert_inclus && Number(r.transfert_montant)) {
    lines.push({
      label: hotelVille ? `Taxe de transfert (${hotelVille})` : "Taxe de transfert",
      amount: Number(r.transfert_montant) || 0,
    });
  }

  const supplementIle = r.ile_selectionnee === "Oziréa" ? nbAd * 30 + nbEnf * 15 : 0;
  if (supplementIle) {
    lines.push({
      label: `Supplément Oziréa (30 € x ${nbAd} ad. + 15 € x ${nbEnf} enf.)`,
      amount: supplementIle,
    });
  }

  const supplementGEM = isGrandEgyptianMuseum(r.site_caire) ? nbAd * 20 + nbEnf * 10 : 0;
  if (supplementGEM) {
    lines.push({
      label: `Supplément Grand Egyptian Museum (20 € x ${nbAd} ad. + 10 € x ${nbEnf} enf.)`,
      amount: supplementGEM,
    });
  }

  const brut = lines.reduce((s, l) => s + l.amount, 0);
  const reduction = r.activite_offerte ? brut : Math.min(Math.max(Number(r.reduction_montant) || 0, 0), brut);
  if (reduction > 0) {
    const motif = r.reduction_motif ? ` (${r.reduction_motif})` : "";
    lines.push({
      label: `${r.activite_offerte ? "Activité offerte" : "Réduction"}${motif}`,
      amount: -reduction,
    });
  }

  return lines;
}
