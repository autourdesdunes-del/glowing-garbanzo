import { CatalogueItem, Client, Reservation } from "@/lib/types";
import { hideMoment } from "@/lib/resa";
import { TRANSFERT_PHONE } from "@/lib/constants";

// Petits formateurs propres aux vues Suivis — extraits de SuivisView.tsx
// pour alléger ce fichier, sans changement de comportement.
export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
export function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
export function fmtDDMM(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
export function daysBetween(laterStr: string, earlierStr: string) {
  const a = new Date(laterStr + "T00:00:00");
  const b = new Date(earlierStr + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export function fmtDayColumn(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
export function fmtMonthLabel(ym: string) {
  const d = new Date(ym + "-01T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function firstNameOf(nom: string) {
  return nom.trim().split(/\s+/)[0] || "";
}
export function auRevoirMessage(nom: string) {
  const prenom = firstNameOf(nom) || "—";
  return `Bonjour ${prenom} \n\nNous espérons que votre retour s'est bien passé.\n\nNous vous remercions d'avoir fait confiance à Autour des Dunes pour l'organisation de vos activités.\n\nCe sera avec grand plaisir que nous vous accueillerons à nouveau prochainement.\n\nL'équipe Autour des Dunes ☀️`;
}
export function avisMessage(nom: string) {
  const prenom = firstNameOf(nom) || "—";
  return `Bonjour ${prenom} \n\nJ'espère que vous allez bien ☺️\n\nJe me permets de vous envoyer un message pour savoir si vous seriez d'accord pour nous laisser un avis et partager avec nos voyageurs votre expérience à nos côtés \n\nCela prend quelques petites secondes mais cela nous aide beaucoup pour nous faire connaître comme nous sommes une jeune agence \n\nJe vous laisse le lien juste ici : \n\n➡️ Google : https://g.co/kgs/jUu71x\n\n➡️ Trip Advisor : https://www.tripadvisor.fr/Attraction_Review-g297549-d26856860-Reviews-Autour_des_Dunes-Hurghada_Red_Sea_and_Sinai.html\n\nEn vous remerciant par avance 🙏`;
}

export function horaireDetail(r: Reservation) {
  if (r.horaire_souhaite) return r.horaire_souhaite;
  if (r.moment && !hideMoment(r.nom_activite, r.horaire_souhaite)) return r.moment;
  return "";
}

export function pickupMissingTeamMessage(r: Reservation, client: Client) {
  const detail = horaireDetail(r);
  return `Missing pick-up — ${client.nom || "No name"} — ${r.nom_activite || "No activity name"}${
    detail ? ` (${detail})` : ""
  }`;
}

export function pickupClientMessage(
  r: Reservation,
  client: Client,
  montantRestant: number,
  catalogue: CatalogueItem[]
) {
  const prenom = firstNameOf(client.nom) || "—";
  const catalogueItem = r.catalogue_item_id
    ? catalogue.find((a) => a.id === r.catalogue_item_id)
    : null;
  // Ce qu'il faut prévoir vient du catalogue (liste structurée), pas du
  // champ libre de la réservation — c'est la vraie liste tenue à jour par
  // activité, alors que la copie sur la réservation peut être vide/périmée.
  const aPrevoirListe = catalogueItem?.a_prevoir_liste?.length
    ? catalogueItem.a_prevoir_liste.join(", ")
    : catalogueItem?.a_prevoir || r.a_prevoir || "le nécessaire pour l'activité";
  const soldeIci = client.solde_activite_id === r.id && !client.solde_paye;
  const paiementLigne = soldeIci
    ? `\n\nComme convenu, vous pourrez régler le solde de ${euros(montantRestant)}€ en espèces en euros demain, auprès de notre représentant sur place.`
    : "";
  // Point de RDV volontairement pas "devant la réception" tout court (trop
  // ambigu, lu comme "à l'intérieur") ni juste "à l'extérieur de l'hôtel"
  // (les clients s'arrêtaient alors à la barrière d'entrée du site, ~100m
  // avant le bâtiment) — "côté réception" les fait avancer jusqu'au
  // bâtiment tout en restant dehors (Mélanie, 2026-10-05).
  const transfertLigne = `⚠️ Pour toute demande au moment du transfert, merci de contacter uniquement ce numéro, qui gère directement votre transfert : ${TRANSFERT_PHONE}. Il est en contact direct avec votre chauffeur et pourra répondre à votre demande. L'agence reste ouverte tous les jours de 9h30 à 21h pour répondre à toutes vos autres questions si nécessaire.`;
  return `Bonjour ${prenom},\n\nLe rendez-vous transfert pour votre activité ${r.nom_activite || "—"} est prévu demain à ${r.pickup_reel}, à l'extérieur, devant l'entrée de l'hôtel côté réception.\n\nN'oubliez pas d'emporter ${aPrevoirListe} 😊${paiementLigne}\n\n${transfertLigne}\nMerci ☀️`;
}
