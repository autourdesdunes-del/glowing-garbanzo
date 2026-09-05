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
    return client.hotel.trim() ? `Airbnb — ${client.hotel}` : "Airbnb — non renseigné";
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
  const secondaire =
    client.canal_secondaire === "Autre"
      ? client.canal_secondaire_autre || "Autre"
      : client.canal_secondaire;
  return `${principal} + ${secondaire}`;
}

export function whatsappSummary(client: Client) {
  if (!client.telephone) return "Non renseigné";
  return client.telephone_2 ? `${client.telephone} / ${client.telephone_2}` : client.telephone;
}
