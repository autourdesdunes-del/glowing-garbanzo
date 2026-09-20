// Construit les propriétés Notion à partir d'un client CRM — voir
// notionApi.ts pour l'appel réseau lui-même. Ne couvre volontairement que
// les champs "client" (pas les acomptes/billets d'avion/RDV paiement/bons
// de réservation, reliés à d'autres bases Notion — trop gros chantier pour
// une v1, Mélanie a validé ce périmètre le 2026-09-20). Les propriétés
// remplies à la main dans Notion (Signature vérificateur, Statut billet,
// SUPP., ✔️...) ne sont jamais incluses ici, donc jamais écrasées.
import type { Client, ClientHotel, HotelReference, Reservation } from "./types";
import { infosManquantesToutes } from "./infosManquantes";
import type { NotionProperties } from "./notionApi";

export function buildClientNotionProperties(
  client: Client,
  reservations: Reservation[],
  hotelsRef: HotelReference[],
  clientHotels: ClientHotel[],
  totalSejour: number
): NotionProperties {
  const infosManquantes = infosManquantesToutes(client, reservations, hotelsRef, clientHotels);
  const contactVia = [client.canal, client.canal_secondaire, client.canal_tertiaire]
    .map((c) => c.trim())
    .filter(Boolean)
    .join(" / ");

  const properties: NotionProperties = {
    Clients: { title: [{ text: { content: client.nom.trim() || "Sans nom" } }] },
    "Client / prospect": { select: { name: client.statut === "Client confirmé" ? "Client" : "Prospect" } },
    "Contact via": { rich_text: contactVia ? [{ text: { content: contactVia } }] : [] },
    "Relation grâce à": {
      multi_select: client.relation_grace_a.trim() ? [{ name: client.relation_grace_a.trim() }] : [],
    },
    Total: { number: totalSejour },
    "Info missing": { multi_select: infosManquantes.map((nom) => ({ name: nom })) },
  };

  properties["Dates du voyage"] = client.date_debut
    ? {
        date: {
          start: client.date_debut,
          end: client.date_fin && client.date_fin !== client.date_debut ? client.date_fin : null,
        },
      }
    : { date: null };

  return properties;
}
