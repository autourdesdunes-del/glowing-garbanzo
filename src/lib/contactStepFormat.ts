import { Client } from "@/lib/types";

// Petits formateurs propres à ContactStep (client-steps.tsx) — extraits
// pour alléger ce fichier, sans changement de comportement.
export function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export function fmtDateDMY(dateStr: string | null) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

// "2 sept." — utilisé pour les dates d'arrivée/départ de chaque hôtel du
// circuit, affichées en tout petit à côté de la destination.
export function fmtDateCourte(d: string | null) {
  if (!d) return "?";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function hebergementSummary(client: Client) {
  if (client.type_hebergement === "airbnb") {
    if (!client.hotel.trim()) return "Airbnb — non renseigné";
    // Le numéro d'appartement était bien enregistré (champ airbnb_appartement,
    // saisi dans le popup) mais jamais réaffiché sur la carte résumée —
    // seul le nom du logement apparaissait, ce qui donnait l'impression que
    // la saisie avait été perdue.
    const detail = [client.airbnb_building, client.airbnb_appartement].filter((v) => v.trim()).join(" - ");
    return detail ? `Airbnb — ${client.hotel} - ${detail}` : `Airbnb — ${client.hotel}`;
  }
  if (!client.hotel.trim()) return "Non renseigné";
  return client.chambre.trim() ? `${client.hotel} - ${client.chambre}` : client.hotel;
}

// "13 août → 27 août 2026" : l'année n'apparaît qu'une fois, sur la
// dernière date, sauf si le séjour chevauche deux années civiles.
export function datesSummary(client: Client) {
  const { date_debut: debut, date_fin: fin } = client;
  if (!debut && !fin) return "Non renseignées";
  const fmtLong = (d: string, withYear: boolean) =>
    new Date(d + "T00:00:00").toLocaleDateString(
      "fr-FR",
      withYear ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" }
    );
  if (debut && !fin) return fmtLong(debut, true);
  if (!debut && fin) return fmtLong(fin, true);
  const sameYear = debut!.slice(0, 4) === fin!.slice(0, 4);
  return `${fmtLong(debut!, !sameYear)} → ${fmtLong(fin!, true)}`;
}

export function canalLabel(canal: string, client: Client) {
  if (canal === "Instagram" || canal === "TikTok") {
    return client.pseudo_contact ? `${canal} — @${client.pseudo_contact}` : canal;
  }
  if (canal === "Email") {
    return client.email ? `Email — ${client.email}` : "Email";
  }
  if (canal === "Autre") {
    return client.canal_autre || "Autre";
  }
  return canal;
}

// Même logique pour le 2e et le 3e canal — factorisée ici pour ne pas
// dupliquer une troisième fois le cas "Autre"/Instagram-TikTok/Email.
function canalSupplementaireLabel(canal: string, canalAutre: string, pseudoContact: string, client: Client): string {
  if (canal === "Autre") return canalAutre || "Autre";
  if (canal === "Instagram" || canal === "TikTok") {
    // Le pseudo de ce canal supplémentaire est stocké dans un champ dédié
    // (jamais pseudo_contact, qui appartient au canal principal) —
    // canalLabel() ne peut donc pas être réutilisée telle quelle.
    return pseudoContact ? `${canal} — @${pseudoContact}` : canal;
  }
  if (canal === "Email") {
    // Contrairement au pseudo Instagram/TikTok, l'email n'a pas de champ
    // dédié par canal : `email` est déjà collecté indépendamment du canal
    // (modale "What's app / Email") et ne peut pas être déjà pris par un
    // autre canal ici, puisque deux canaux du même client sont toujours
    // distincts entre eux.
    return client.email ? `Email — ${client.email}` : "Email";
  }
  return canal;
}

export function contactViaSummary(client: Client) {
  const canaux = [canalLabel(client.canal, client)];
  if (client.canal_secondaire) {
    canaux.push(
      canalSupplementaireLabel(
        client.canal_secondaire,
        client.canal_secondaire_autre,
        client.pseudo_contact_secondaire,
        client
      )
    );
  }
  if (client.canal_tertiaire) {
    canaux.push(
      canalSupplementaireLabel(client.canal_tertiaire, client.canal_tertiaire_autre, client.pseudo_contact_tertiaire, client)
    );
  }
  return canaux.join(" + ");
}

export function whatsappSummary(client: Client) {
  if (!client.telephone) return "Non renseigné";
  return client.telephone_2 ? `${client.telephone} / ${client.telephone_2}` : client.telephone;
}
