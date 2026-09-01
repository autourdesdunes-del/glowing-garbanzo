import {
  AssouanVerification,
  CatalogueItem,
  Client,
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

// Une activité annulée sort du total du séjour (et de tout calcul de
// paiement) sans jamais être supprimée — elle reste consultable, juste
// exclue des sommes. Toujours passer les réservations par ici avant de les
// sommer.
export function reservationsActives(reservations: Reservation[]) {
  return reservations.filter((r) => r.statut_resa !== "Annulée");
}

// "Paiement intégral" → "à la première activité" : signale, sur l'activité
// choisie comme point de collecte (la première par défaut, ou une autre si
// l'employée en a sélectionné une autre), le montant qui reste à encaisser.
export function activitePaiementWarning(
  client: Client,
  r: Reservation,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  etapes: PaiementEtape[] = []
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
        titre: `Transfert aéroport ${ville} - hôtel`,
      },
      {
        value: "hotel_aeroport",
        label: "Hôtel → Aéroport",
        titre: `Transfert hôtel ${ville} - aéroport ${ville}`,
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

// Une fois le sens du transfert aéroport posé (voir transfertSensOptions
// ci-dessus), le titre doit aussi refléter le numéro de vol et l'horaire dès
// qu'ils sont connus — visible directement dans Réservations et la fiche
// client, sans ouvrir l'activité. Le sens et la ville sont retrouvés dans le
// titre actuel plutôt que stockés à part, pour rester idempotent d'une
// modif à l'autre. Retourne null si ce n'est pas un transfert aéroport (le
// titre reste alors inchangé).
export function ajusteTitreTransfertAeroport(
  nomActiviteActuel: string,
  numeroVol: string,
  horaireVol: string
): string | null {
  const aeroportHotel = nomActiviteActuel.match(/^Transfert aéroport (.+?) - hôtel\b/);
  if (aeroportHotel) {
    const bits = [
      horaireVol.trim() && `arrivée à ${horaireVol.trim()}`,
      numeroVol.trim() && `vol ${numeroVol.trim()}`,
    ].filter(Boolean);
    return `Transfert aéroport ${aeroportHotel[1]} - hôtel${bits.length ? ` (${bits.join(", ")})` : ""}`;
  }
  const hotelAeroport = nomActiviteActuel.match(/^Transfert hôtel (.+?) - aéroport\b/);
  if (hotelAeroport) {
    const ville = hotelAeroport[1];
    const bits = [
      horaireVol.trim() && `vol départ à ${horaireVol.trim()}`,
      numeroVol.trim() && `vol ${numeroVol.trim()}`,
    ].filter(Boolean);
    return `Transfert hôtel ${ville} - aéroport ${ville}${bits.length ? ` (${bits.join(", ")})` : ""}`;
  }
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

export type ResaBreakdownLine = { label: string; amount: number };

// Détail du calcul du total d'une activité (ex. "25 € x 2 adultes = 50,00 €")
// — même composition que resaTotalMontant, ligne par ligne pour l'affichage.
export function resaBreakdown(
  r: Reservation,
  client: Client,
  options: ReservationOption[] = [],
  tarifs: ReservationTarif[] = []
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
