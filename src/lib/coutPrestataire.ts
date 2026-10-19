import type { SupabaseClient } from "@supabase/supabase-js";
import { Client, Reservation } from "@/lib/types";
import { participantsFor, isGrandEgyptianMuseum } from "@/lib/resa";
import { getEurParEgp } from "@/lib/fxRate";

// Estimation du coût prestataire réel d'une activité, à partir des tarifs
// fournis par Mélanie le 2026-10-19 — sert à pré-remplir "Coût réel"
// (reservation_couts) pour que la marge (CA - coût) se calcule sans tout
// saisir à la main. C'est une SUGGESTION, toujours modifiable : certaines
// règles dépendent de plusieurs réservations à la fois (ex. partage de
// voiture Mahmya entre deux hôtels proches, pooling speedboat Oziréa
// quand 3 résas tombent le même jour) — une fonction qui ne regarde
// qu'UNE réservation ne peut pas le deviner, donc le calcul part toujours
// du cas "non partagé" (le plus défavorable), à corriger à la main quand
// un partage réel a lieu.
//
// Résultat exprimé en deux montants bruts (eur/egp) — la conversion EGP
// vers € (au taux du jour de l'activité) se fait séparément, voir
// src/lib/fxRate.ts, pour ne pas mélanger ici logique de prix et logique
// de change.
export type CoutEstimation = {
  eur: number;
  egp: number;
  // Mise en garde à afficher à côté du montant suggéré quand une partie
  // de la règle est incertaine/non fournie — jamais une erreur bloquante,
  // juste de quoi ajuster à la main en connaissance de cause.
  avertissements: string[];
};

// Coût du transfert partagé Mahmya/Éden (règle identique pour les deux,
// demande de Mélanie) — 1 à 4 personnes : voiture 700 EGP ; 5 à 10
// personnes : van 1200 EGP. Au-delà de 10 (non documenté), on garde le
// tarif van par défaut.
function transfertMahmyaStyle(totalPax: number): { egp: number; avertissement?: string } {
  if (totalPax <= 4) return { egp: 700 };
  if (totalPax <= 10) return { egp: 1200 };
  return {
    egp: 1200,
    avertissement: `${totalPax} personnes — tarif au-delà de 10 pers. non documenté, van à 1200 EGP utilisé par défaut.`,
  };
}

// Prix "pour 2 personnes" qu'il faut mettre à l'échelle du vrai nombre de
// participants (croisières, Abu Simbel, transferts Assouan-Louxor,
// tortues en privatif) — extrapolation linéaire à partir du tarif de
// base, à vérifier à la main pour un nombre impair ou un grand groupe.
function miseAEchellePour2(prixPour2: number, totalPax: number) {
  return { montant: prixPour2 * (totalPax / 2), approxime: totalPax !== 2 };
}

export function coutPrestataireEstimeBrut(r: Reservation, client: Client): CoutEstimation | null {
  const nomL = (r.nom_activite || "").toLowerCase();
  const { nbAd, nbEnf, nbBebe, nbAcc, nbEnf3 } = participantsFor(r, client);
  const totalPax = nbAd + nbEnf + nbBebe + nbAcc + nbEnf3;
  const match = (...mots: string[]) => mots.every((m) => nomL.includes(m));

  // --- Îles / speedboat avec entrée seule (pas de transfert à part) ---
  if (match("orange bay") && !match("speedboat")) {
    return { eur: 0, egp: nbAd * 1050 + nbEnf * 525, avertissements: [] };
  }
  if (match("paradise") && !match("speedboat")) {
    return { eur: 0, egp: nbAd * 1050 + nbEnf * 525, avertissements: [] };
  }
  if (match("maison des dauphins") && !match("speedboat")) {
    return { eur: 0, egp: nbAd * 900 + nbEnf * 450, avertissements: [] };
  }
  if (match("bianca island")) {
    return { eur: nbAd * 50 + nbEnf * 25, egp: 0, avertissements: [] };
  }

  // --- Éden / Mahmya : prix par personne + transfert partagé (règle Mahmya) ---
  if (match("éden island") || match("eden island")) {
    const transfert = transfertMahmyaStyle(totalPax);
    return {
      eur: nbAd * 45 + nbEnf * 22.5,
      egp: transfert.egp,
      avertissements: transfert.avertissement ? [transfert.avertissement] : [],
    };
  }
  if (match("mahmya")) {
    const transfert = transfertMahmyaStyle(totalPax);
    return {
      // "Moitié prix enfant... payant à partir de 3 ans" → l'enfant 3 ans
      // (nbEnf3) paie aussi demi-tarif, pas seulement l'enfant 4-10 ans.
      eur: nbAd * 67.5 + (nbEnf + nbEnf3) * 33.75,
      egp: transfert.egp,
      avertissements: transfert.avertissement ? [transfert.avertissement] : [],
    };
  }

  // --- Oziréa ---
  if (match("speedboat") && match("oziréa")) {
    return {
      eur: nbAd * 20 + nbEnf * 10,
      egp: 7000 + 700,
      avertissements: [
        "Si plusieurs réservations Oziréa tombent le même jour, le speedboat (7000 EGP) peut être partagé entre elles — à corriger à la main si c'est le cas.",
      ],
    };
  }
  if (match("oziréa")) {
    return { eur: nbAd * 35 + nbEnf * 17.5, egp: 0, avertissements: [] };
  }

  // --- Quad / Buggy / Jeep (par véhicule, pas par personne) ---
  if (match("quad") && match("makadi")) {
    return { eur: 0, egp: (r.nb_quad || nbAd) * 900 + 1000, avertissements: [] };
  }
  if (match("quad") && (match("dîner") || match("diner")) && match("spectacle")) {
    const conducteurs = r.nb_quad || nbAd;
    return { eur: 0, egp: conducteurs * 900 + (nbEnf + nbAcc) * 450, avertissements: [] };
  }
  if (match("quad") && (match("sunset") || match("coucher"))) {
    const conducteurs = r.nb_quad || nbAd;
    return { eur: 0, egp: conducteurs * 900 + (nbEnf + nbAcc) * 450, avertissements: [] };
  }
  if (match("quad")) {
    const conducteurs = r.nb_quad || nbAd;
    return { eur: 0, egp: conducteurs * 800 + (nbEnf + nbAcc) * 400, avertissements: [] };
  }
  if (match("grand safari") && match("bédouin")) {
    return { eur: 0, egp: 0, avertissements: ["Tarif du Grand Safari Bédouin non communiqué — à demander à Mélanie."] };
  }
  if (match("buggy") && (match("famille") || match("family"))) {
    return { eur: 0, egp: (r.nb_buggy_famille || 1) * 5500, avertissements: [] };
  }
  if (match("buggy")) {
    return { eur: 0, egp: (r.nb_buggy_normal || 1) * 4300, avertissements: [] };
  }
  if (match("jeep")) {
    return {
      eur: 0,
      egp: 6000,
      avertissements: ["Suppose 1 seule jeep — à corriger à la main si le groupe en nécessite plusieurs."],
    };
  }

  // --- Cheval / Chameau ---
  if (match("dîner spectacle") && (match("cheval") || match("chameau"))) {
    return { eur: 0, egp: 0, avertissements: ["Tarif \"Cheval/Chameau & dîner spectacle\" pas communiqué (peu vendu) — à demander à Mélanie."] };
  }
  if (match("cheval") || match("chameau")) {
    const cavaliers = nbAd + nbEnf + nbAcc;
    return { eur: 0, egp: cavaliers * 800 + 700, avertissements: [] };
  }

  // --- Louxor / Caire — transport + visite ---
  if (match("louxor") && (match("mini-bus") || match("van"))) {
    return { eur: 0, egp: nbAd * 3400 + nbEnf * 2100, avertissements: [] };
  }
  if (match("louxor") && match("bus") && !match("mini")) {
    return { eur: 0, egp: nbAd * 3000 + nbEnf * 1500, avertissements: [] };
  }
  if (match("le caire") && match("mini-bus") && (match("vip") || match("vip"))) {
    return {
      eur: 0,
      egp: nbAd * 4350 + nbEnf * 2600,
      avertissements:
        r.date_debut && r.date_debut < "2026-11-01"
          ? ["Tarif 4350/2600 EGP annoncé comme valable à partir de début novembre 2026 — le tarif avant cette date n'a pas été communiqué."]
          : [],
    };
  }
  if ((match("le caire") || match("caire")) && (match("mini-bus") || match("van")) && !match("vip")) {
    return { eur: 0, egp: nbAd * 3000 + nbEnf * 1900, avertissements: [] };
  }
  if ((match("le caire") || match("caire")) && match("bus") && !match("mini")) {
    return { eur: 0, egp: nbAd * 2500 + nbEnf * 1250, avertissements: [] };
  }
  if (match("caire") && match("voiture privée")) {
    const gem = isGrandEgyptianMuseum(r.site_caire);
    const avert = gem ? [] : ["Prix des tickets non communiqué pour un site autre que le Grand Egyptian Museum — tickets comptés à 0."];
    return {
      eur: 0,
      egp: 2250 + 7000 + (gem ? nbAd * 2350 + nbEnf * 1175 : 0) + (nbAd + nbEnf) * 300,
      avertissements: avert,
    };
  }
  if (match("louxor") && match("voiture privée")) {
    return {
      eur: 0,
      egp: 2000 + 6000 + nbAd * 1850 + nbEnf * 925 + (nbAd + nbEnf) * 300 + 500,
      avertissements: [],
    };
  }
  if (match("caire") && match("avion")) {
    const gem = isGrandEgyptianMuseum(r.site_caire);
    const avert = gem ? [] : ["Prix des tickets non communiqué pour un site autre que le Grand Egyptian Museum — tickets comptés à 0."];
    return {
      eur: (nbAd + nbEnf) * 135,
      egp: 800 + 2250 + (gem ? nbAd * 2350 + nbEnf * 1175 : 0) + (nbAd + nbEnf) * 300 + 2000,
      avertissements: avert,
    };
  }
  if (match("caire") && match("2 jours") && match("déjà sur place")) {
    return { eur: 0, egp: 4000 + 4000 + nbAd * 3750 + nbEnf * 1875 + (nbAd + nbEnf) * 600, avertissements: [] };
  }
  if (match("caire") && match("déjà sur place")) {
    return { eur: 0, egp: 2000 + 2000 + nbAd * 2350 + nbEnf * 1175 + (nbAd + nbEnf) * 300, avertissements: [] };
  }
  if (match("louxor") && match("2 jours") && match("déjà sur place")) {
    return { eur: 0, egp: 4000 + 3000 + (nbAd + nbEnf) * 600 + nbAd * 2650 + nbEnf * 1325 + 500, avertissements: [] };
  }
  if (match("louxor") && match("déjà sur place")) {
    return { eur: 0, egp: 2000 + 1500 + (nbAd + nbEnf) * 300 + nbAd * 1850 + nbEnf * 925 + 500, avertissements: [] };
  }

  // --- Montgolfière ---
  // Combo "Louxor 1/2 jours + Montgolfière" (quel que soit le sens —
  // aller-retour / depuis Louxor / depuis Hurghada) : coût = visite
  // Louxor "déjà sur place" (1 ou 2 jours) + montgolfière, les deux
  // combinés — PAS seulement la montgolfière seule, sans quoi le guide/
  // voiture/tickets/repas Louxor disparaissaient du coût (bug trouvé en
  // testant le 1er octobre 2026 : Vanessa PUJOL, "bénéfice" de 756€ pour
  // un CA de 960€, alors que la visite Louxor de 2 jours n'était pas
  // comptée du tout).
  if (match("louxor") && match("montgolfi") && match("jour")) {
    const jours2 = nomL.includes("2 jours");
    const louxor = jours2
      ? 4000 + 3000 + (nbAd + nbEnf) * 600 + nbAd * 2650 + nbEnf * 1325 + 500
      : 2000 + 1500 + (nbAd + nbEnf) * 300 + nbAd * 1850 + nbEnf * 925 + 500;
    const montgolfiere = (nbAd + nbEnf) * 3000;
    return {
      eur: 0,
      egp: louxor + montgolfiere,
      avertissements: [
        "Tarif montgolfière annoncé comme amené à changer prochainement — à vérifier avant d'utiliser ce chiffre tel quel.",
        "Coût combiné estimé en additionnant la règle Louxor \"déjà sur place\" (1 ou 2 jours) et la règle montgolfière séparément — à vérifier.",
      ],
    };
  }
  if (match("montgolfi")) {
    return {
      eur: 0,
      egp: (nbAd + nbEnf) * 3000,
      avertissements: ["Tarif annoncé comme amené à changer prochainement — à vérifier avant d'utiliser ce chiffre tel quel."],
    };
  }

  // --- Croisières / Abou Simbel / transferts longue distance (prix pour 2 pers.) ---
  if (match("croisière") && match("louxor vers assouan")) {
    const cruise = miseAEchellePour2(680, totalPax);
    const tickets = miseAEchellePour2(9800, totalPax);
    return {
      eur: 0,
      egp: 7000 + 6000 + cruise.montant + tickets.montant,
      avertissements: cruise.approxime ? [`Tarif prévu pour 2 personnes, mis à l'échelle linéairement pour ${totalPax}.`] : [],
    };
  }
  if (match("croisière") && match("assouan vers louxor")) {
    const cruise = miseAEchellePour2(510, totalPax);
    const tickets = miseAEchellePour2(9800, totalPax);
    return {
      eur: 0,
      egp: 7000 + 6000 + cruise.montant + tickets.montant,
      avertissements: cruise.approxime ? [`Tarif prévu pour 2 personnes, mis à l'échelle linéairement pour ${totalPax}.`] : [],
    };
  }
  if (match("abu simbel") || match("abou simbel")) {
    const tickets = miseAEchellePour2(3000, totalPax);
    const repas = miseAEchellePour2(600, totalPax);
    return {
      eur: 0,
      egp: 6500 + 2500 + tickets.montant + repas.montant,
      avertissements: tickets.approxime ? [`Tarif prévu pour 2 personnes, mis à l'échelle linéairement pour ${totalPax}.`] : [],
    };
  }
  if (match("transfert") && match("assouan") && match("louxor")) {
    const tickets = miseAEchellePour2(2400, totalPax);
    const repas = miseAEchellePour2(600, totalPax);
    return {
      eur: 0,
      egp: 5500 + 2500 + tickets.montant + repas.montant,
      avertissements: tickets.approxime ? [`Tarif prévu pour 2 personnes, mis à l'échelle linéairement pour ${totalPax}.`] : [],
    };
  }

  // --- Transferts longue distance (forfait voiture/van, pas par personne) ---
  if (match("transfert") && match("louxor") && match("hurghada")) {
    return { eur: 0, egp: totalPax >= 4 ? 6500 : 5500, avertissements: [] };
  }
  if (match("transfert") && (match("le caire") || match("caire")) && match("hurghada")) {
    return { eur: 0, egp: totalPax >= 4 ? 8000 : 7000, avertissements: [] };
  }
  if (match("transfert") && match("aéroport")) {
    if (match("hurghada")) return { eur: 0, egp: 550, avertissements: [] };
    if (match("caire")) return { eur: 0, egp: 1000, avertissements: [] };
    if (match("louxor")) return { eur: 0, egp: 1000, avertissements: [] };
  }

  // --- Mer Rouge / spa / plongée ---
  if (match("tortue") && match("privatif")) {
    const m = miseAEchellePour2(10600, totalPax);
    return { eur: 0, egp: m.montant, avertissements: m.approxime ? [`Tarif prévu pour 2 personnes, mis à l'échelle linéairement pour ${totalPax}.`] : [] };
  }
  if (match("tortue")) {
    return { eur: nbAd * 55 + nbEnf * 27.5, egp: 0, avertissements: [] };
  }
  if (match("spa") || match("massage")) {
    return { eur: 0, egp: (nbAd + nbEnf + nbAcc) * 600 + 700, avertissements: [] };
  }
  if (match("plongée") && (match("professionnel") || match("diving"))) {
    return { eur: 0, egp: (nbAd + nbEnf + nbAcc) * 1500, avertissements: [] };
  }
  if (match("plongée")) {
    return { eur: 0, egp: nbAd * 1000 + (nbEnf + nbAcc) * 700, avertissements: [] };
  }
  if (match("seascope")) {
    return { eur: nbAd * 10 + nbEnf * 5, egp: 0, avertissements: [] };
  }
  if (match("parachute")) {
    const participants = nbAd + nbEnf + nbAcc;
    return { eur: 0, egp: Math.ceil(participants / 2) * 600 + 700, avertissements: [] };
  }

  // --- Speedboat (hors Oziréa, traité plus haut) ---
  if (match("speedboat") && (match("dauphins") || match("white island"))) {
    return { eur: 0, egp: 700 + 5000, avertissements: [] };
  }
  if (match("speedboat") && match("journée complète")) {
    const ile = (r.ile_selectionnee || "").toLowerCase();
    let entree = { eur: 0, egp: 0 };
    if (ile.includes("paradise")) entree = { eur: 0, egp: 1000 * (nbAd + nbEnf) };
    else if (ile.includes("magawish")) entree = { eur: 0, egp: 450 * (nbAd + nbEnf) };
    else if (ile.includes("oziréa") || ile.includes("oziréa")) entree = { eur: 20 * (nbAd + nbEnf), egp: 0 };
    else entree = { eur: 0, egp: 800 * (nbAd + nbEnf) }; // Orange Bay par défaut
    return { eur: entree.eur, egp: 700 + 9000 + entree.egp, avertissements: [] };
  }
  if (match("speedboat") && (match("demi-journée") || match("4h"))) {
    const ile = (r.ile_selectionnee || "").toLowerCase();
    const payants = nbAd + nbEnf; // gratuit jusqu'à 5 ans (nbBebe)
    const entree = ile.includes("magawish") ? 150 * payants : 400 * payants;
    return { eur: 0, egp: 700 + 5000 + entree, avertissements: [] };
  }

  return null;
}

export type CoutEstimationFinale = {
  montantEur: number;
  avertissements: string[];
  // Pour afficher le détail "X € + Y EGP (≈ Z €)" plutôt qu'un seul total
  // opaque, utile pour vérifier/ajuster à la main.
  eurBrut: number;
  egpBrut: number;
  tauxUtilise: number;
};

// Point d'entrée complet : calcule le coût brut (€/EGP) puis le convertit
// en un seul montant en euros au taux de change du jour de l'activité
// (demande de Mélanie, 2026-10-19). Retourne null si aucune règle ne
// correspond à cette activité (nom non reconnu) — dans ce cas, pas de
// suggestion à afficher, la saisie reste entièrement manuelle comme avant.
export async function coutPrestataireEstimeEnEuros(
  supabase: SupabaseClient,
  r: Reservation,
  client: Client
): Promise<CoutEstimationFinale | null> {
  const brut = coutPrestataireEstimeBrut(r, client);
  if (!brut) return null;
  const taux = await getEurParEgp(supabase, r.date_debut || "");
  const montantEur = brut.eur + brut.egp * taux;
  return {
    montantEur: Math.round(montantEur * 100) / 100,
    avertissements: brut.avertissements,
    eurBrut: brut.eur,
    egpBrut: brut.egp,
    tauxUtilise: taux,
  };
}
