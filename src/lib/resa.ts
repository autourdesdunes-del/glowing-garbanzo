import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";

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

export function paiementBadge(client: Client, r: Reservation) {
  // Le bouton "Rendez-vous finalisé" (étape Paiements) marque le solde payé
  // et pose ce drapeau — le badge doit alors le préciser plutôt que le
  // libellé "Payé" générique, sur toutes les activités.
  if (client.solde_paye && client.solde_rdv_finalise) {
    return {
      label: RDV_FINALISE_LABELS[client.solde_mode] || "Payé en € - rendez-vous paiement finalisé",
      className: "bg-green-100 text-green-700",
    };
  }
  const key = paiementStatutKey(client, r);
  const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === key)!;
  return { label: opt.label, className: opt.className };
}

// Un avoir utilisé se rattache toujours à l'activité qui en a bénéficié
// (reservation.avoir_utilise, affiché sur sa carte) — le total consommé sur
// le séjour est simplement la somme de ce champ sur toutes les activités.
export function avoirUtiliseTotal(reservations: Reservation[]) {
  return reservations.reduce((s, rr) => s + (Number(rr.avoir_utilise) || 0), 0);
}

// "Paiement intégral" → "à la première activité" : signale, sur l'activité
// choisie comme point de collecte (la première par défaut, ou une autre si
// l'employée en a sélectionné une autre), le montant qui reste à encaisser.
export function activitePaiementWarning(
  client: Client,
  r: Reservation,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>
): { amount: number; devise: "€" | "EGP" } | null {
  if (client.solde_paye) return null;
  if (client.paiement_integral_mode !== "activite_eur" && client.paiement_integral_mode !== "activite_egp")
    return null;
  if (client.solde_activite_id !== r.id) return null;
  if (client.paiement_integral_mode === "activite_egp") {
    // Montant confirmé (et ajustable) par l'employée via la fenêtre de
    // conversion — jamais recalculé silencieusement à l'affichage.
    return { amount: client.egp_montant, devise: "EGP" };
  }
  const totalSejour = reservations.reduce(
    (s, rr) => s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
    0
  );
  const acompte = client.paiement_type === "acompte" && client.acompte_valide ? Number(client.acompte_montant) || 0 : 0;
  // Un avoir consommé réduit le montant restant dû pour tout le séjour, où
  // qu'il soit collecté (règle du solde unique par séjour) — jamais un
  // deuxième "solde" par activité.
  const amount = Math.max(totalSejour - acompte - avoirUtiliseTotal(reservations), 0);
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

// Les îles proposées pour les formules speedboat privé "journée complète"
// et "demi-journée" — le client doit en choisir une avant de continuer.
export const SPEEDBOAT_ILES = ["Orange Bay", "Paradise", "Hula Hula", "Magawish", "Oziréa"] as const;

export function isSpeedboat(nom: string) {
  return (nom || "").toLowerCase().includes("speedboat");
}

// Seule activité du catalogue avec un billet d'avion intérieur à gérer pour
// l'instant (aller-retour Hurghada ↔ Le Caire, même jour) — le billet_requis
// et les villes se déduisent automatiquement de ce nom, plus besoin de case
// à cocher manuelle. Les circuits et achats de billet secs ne sont pas
// encore dans le catalogue (à activer ici quand ils y seront).
export function isLeCaireEnAvion(nom: string) {
  return (nom || "").trim().toLowerCase() === "le caire en avion";
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

// Quad (Safari quad, Safari quad & dîner spectacle, au coucher du soleil…) —
// même logique que cheval/chameau : avec des enfants ou des ados, un quad
// par participant n'est pas automatique (ex. enfant en passager derrière un
// conducteur), donc on recommande d'écrire le texte affiché à la main.
export function isQuad(nom: string) {
  return (nom || "").toLowerCase().includes("quad");
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

// En dehors du sunset (horaire fixe), des formules "journée" fixes, et du
// semi-privé Maison des dauphins, tous les speedboat doivent préciser
// matin/après-midi.
export function needsMomentSpeedboat(nom: string) {
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
export function groupeExtraCounts(nbAd: number, nbEnf: number, basePax: number) {
  return {
    extra1: Math.max(0, nbAd - (Number(basePax) || 0)),
    extraEnfants: nbEnf,
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

export function participantsFor(r: Reservation, client: Client) {
  const nbAd =
    r.participants_mode === "tous" ? Number(client.adultes) || 0 : Number(r.participants_adultes) || 0;
  const nbEnf =
    r.participants_mode === "tous" ? Number(client.enfants) || 0 : Number(r.participants_enfants) || 0;
  // L'accompagnateur n'existe qu'au niveau d'une réservation précise (ex.
  // plongée) — pas de notion d'accompagnateur au niveau du séjour du
  // client, donc rien à récupérer en mode "tous".
  const nbAcc = r.participants_mode === "tous" ? 0 : Number(r.participants_accompagnateurs) || 0;
  // Même logique que l'accompagnateur : le tarif enfant 3 ans (ex. Le Caire
  // en avion) se saisit au cas par cas sur la réservation, jamais déduit du
  // total d'enfants du séjour.
  const nbEnf3 = r.participants_mode === "tous" ? 0 : Number(r.participants_enfants_3ans) || 0;
  return { nbAd, nbEnf, nbAcc, nbEnf3 };
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
  const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);
  // Forfait groupe (ex. speedboat, yacht) : le prix n'est pas par personne
  // mais un forfait de base pour un nombre de personnes inclus, plus un
  // tarif par personne supplémentaire et par enfant supplémentaire — ces
  // compteurs se saisissent au cas par cas, comme l'accompagnateur ou
  // l'enfant 3 ans, jamais déduits du séjour du client.
  const base =
    r.tarif_mode === "groupe"
      ? (Number(r.prix_groupe_base) || 0) +
        (Number(r.participants_extra1) || 0) * (Number(r.prix_groupe_extra1) || 0) +
        (Number(r.participants_extra_enfants) || 0) * (Number(r.prix_groupe_extra_enfant) || 0)
      : nbAd * (Number(r.pu_adulte) || 0) +
        nbEnf * (Number(r.pu_enfant) || 0) +
        nbAcc * (Number(r.pu_accompagnateur) || 0) +
        nbEnf3 * (Number(r.pu_enfant_3ans) || 0);
  const optionsTotal = options.reduce(
    (s, o) => s + (Number(o.prix) || 0) * (Number(o.quantite) || 1),
    0
  );
  const tarifsTotal = tarifs.reduce((s, t) => s + (Number(t.quantite) || 0) * (Number(t.pu) || 0), 0);
  const transfert = r.transfert_inclus ? 0 : Number(r.transfert_montant) || 0;
  // L'île Oziréa applique un supplément fixe par personne, quel que soit le
  // mode de tarification (forfait groupe pour ces speedboat) — appliqué
  // automatiquement dès que l'île est sélectionnée, jamais à saisir à la main.
  const supplementIle = r.ile_selectionnee === "Oziréa" ? nbAd * 30 + nbEnf * 15 : 0;
  const supplementGEM = isGrandEgyptianMuseum(r.site_caire) ? nbAd * 20 + nbEnf * 10 : 0;
  return base + optionsTotal + tarifsTotal + transfert + supplementIle + supplementGEM;
}

// Le Grand Egyptian Museum (nouveau musée) est en supplément par rapport aux
// autres sites du Caire — appliqué automatiquement dès qu'il est choisi comme
// site visité, jamais à saisir à la main. Gratuit pour les moins de 3 ans
// (déjà exclus de nbEnf, voir participantsFor).
export function isGrandEgyptianMuseum(siteCaire: string) {
  return siteCaire === "Grand Egyptian Museum (nouveau musée)";
}

function fmtEuros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export type ResaBreakdownLine = { label: string; amount: number };

// Détail du calcul du total d'une activité (ex. "25 € x 2 adultes = 50,00 €")
// — même composition que resaTotalMontant, ligne par ligne pour l'affichage.
export function resaBreakdown(
  r: Reservation,
  client: Client,
  options: ReservationOption[] = [],
  tarifs: ReservationTarif[] = []
): ResaBreakdownLine[] {
  const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);
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
    lines.push({ label: "Taxe de transfert", amount: Number(r.transfert_montant) || 0 });
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

  return lines;
}
