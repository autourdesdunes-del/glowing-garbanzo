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

export function contactViaSummary(client: Client) {
  const principal = canalLabel(client.canal, client);
  if (!client.canal_secondaire) return principal;
  let secondaire: string;
  if (client.canal_secondaire === "Autre") {
    secondaire = client.canal_secondaire_autre || "Autre";
  } else if (client.canal_secondaire === "Instagram" || client.canal_secondaire === "TikTok") {
    // Le pseudo du canal secondaire est stocké dans un champ dédié
    // (pseudo_contact_secondaire) car pseudo_contact appartient au canal
    // principal — canalLabel() ne peut donc pas être réutilisée telle quelle.
    secondaire = client.pseudo_contact_secondaire
      ? `${client.canal_secondaire} — @${client.pseudo_contact_secondaire}`
      : client.canal_secondaire;
  } else if (client.canal_secondaire === "Email") {
    // Contrairement au pseudo Instagram/TikTok, l'email n'a pas de champ
    // dédié au canal secondaire : `email` est déjà collecté indépendamment
    // du canal (modale "What's app / Email") et ne peut pas être déjà pris
    // par le canal principal ici, puisque le second canal ne peut pas être
    // identique au principal.
    secondaire = client.email ? `Email — ${client.email}` : "Email";
  } else {
    secondaire = client.canal_secondaire;
  }
  return `${principal} + ${secondaire}`;
}

export function whatsappSummary(client: Client) {
  if (!client.telephone) return "Non renseigné";
  return client.telephone_2 ? `${client.telephone} / ${client.telephone_2}` : client.telephone;
}
