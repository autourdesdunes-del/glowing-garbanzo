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
  const amount = Math.max(totalSejour - acompte, 0);
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
  const n = (nomActivite || "").toLowerCase();
  return n.includes("speedboat") && n.includes("sunset");
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
  const optionsTotal = options.reduce((s, o) => s + (Number(o.prix) || 0), 0);
  const tarifsTotal = tarifs.reduce((s, t) => s + (Number(t.quantite) || 0) * (Number(t.pu) || 0), 0);
  const transfert = r.transfert_inclus ? 0 : Number(r.transfert_montant) || 0;
  return base + optionsTotal + tarifsTotal + transfert;
}
