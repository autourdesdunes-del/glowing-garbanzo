// Appels sortants vers l'API Kommo — utilisés uniquement en best-effort
// depuis la route webhook pour enrichir un lead (le webhook "changement de
// statut" ne contient ni le nom ni les coordonnées du contact).

type KommoLeadContactInfo = {
    nom: string;
    telephone: string;
    email: string;
};

function kommoApiBase(): string | null {
    const subdomain = process.env.KOMMO_SUBDOMAIN;
    if (!subdomain) return null;
    return `https://${subdomain}.kommo.com/api/v4`;
}

async function kommoFetch(path: string): Promise<unknown | null> {
    const base = kommoApiBase();
    const token = process.env.KOMMO_ACCESS_TOKEN;
    if (!base || !token) return null;

  const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
  });
    if (!res.ok) return null;
    return res.json();
}

// Étape 2 (écriture) : pousse un changement de statut fait dans le CRM vers
// le lead Kommo correspondant, pour que le pipeline reste synchronisé dans
// les deux sens. Best-effort — un échec ici ne doit jamais bloquer l'action
// dans le CRM (le statut local reste la source de vérité de l'app).
// `name`, optionnel, resynchronise aussi le titre du lead Kommo — utilisé
// pour "Client confirmé" afin que le lead affiche le nom complet correct
// côté Kommo (souvent un pseudo Instagram/WhatsApp à l'origine).
export async function updateKommoLeadStatus(leadId: number, statusId: number, name?: string): Promise<boolean> {
    const base = kommoApiBase();
    const token = process.env.KOMMO_ACCESS_TOKEN;
    if (!base || !token) return false;

  try {
        const res = await fetch(`${base}/leads/${leadId}`, {
              method: "PATCH",
              headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
              },
              body: JSON.stringify({ status_id: statusId, ...(name ? { name } : {}) }),
        });
        return res.ok;
  } catch {
        return false;
  }
}

// Ajoute une note "système" dans le fil du lead côté Kommo — pour que les
// employées voient, directement là où elles travaillent (Kommo, pas le
// CRM), qu'un déplacement automatique vient d'avoir lieu et pourquoi
// (ex. "Message-type de demande d'infos détecté → déplacé dans 'Demande
// d'infos envoyée'"). Best-effort, comme updateKommoLeadStatus.
export async function addKommoLeadNote(leadId: number, text: string): Promise<boolean> {
    const base = kommoApiBase();
    const token = process.env.KOMMO_ACCESS_TOKEN;
    if (!base || !token) return false;

  try {
        const res = await fetch(`${base}/leads/notes`, {
              method: "POST",
              headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
              },
              body: JSON.stringify([{ entity_id: leadId, note_type: "common", params: { text } }]),
        });
        return res.ok;
  } catch {
        return false;
  }
}

// Va chercher le statut (et le nom) actuels d'un lead Kommo — utilisé par le
// job de réconciliation (cf. /api/cron/kommo-reconcile) pour rattraper les
// changements que le webhook classique n'a pas notifiés (constaté
// notamment pour les leads clôturés "Réservé" via l'action de clôture
// Kommo, qui n'émet pas toujours le webhook "lead_status_changed"). Le nom
// renvoyé est celui du LEAD lui-même (ce que les employées éditent en haut
// de la fiche Kommo), pas celui d'un contact lié qui peut être vide/périmé.
export async function fetchKommoLeadStatus(leadId: number): Promise<number | null> {
    const lead = await fetchKommoLead(leadId);
    return typeof lead?.status_id === "number" ? lead.status_id : null;
}

export async function fetchKommoLead(leadId: number): Promise<{ status_id?: number; name?: string } | null> {
    try {
          return (await kommoFetch(`/leads/${leadId}`)) as { status_id?: number; name?: string } | null;
    } catch {
          return null;
    }
}

export type KommoLeadSearchResult = {
  id: number;
  name: string;
  contactName: string;
  contactPhone: string;
};

// Recherche de leads Kommo par nom/téléphone — sert à relier manuellement
// un nouveau dossier client à sa conversation Kommo dès la création
// (QuickAddClient.tsx), plutôt que de compter uniquement sur le webhook
// automatique (demande de Mélanie, 2026-09-19 : plus aucun dossier créé à
// la main sans lien vers sa conversation Kommo, sauf venant d'un email).
// Kommo cherche sur le nom du lead ET les champs des contacts liés
// (téléphone, email) avec un seul paramètre "query".
export async function searchKommoLeads(query: string): Promise<KommoLeadSearchResult[]> {
    const clean = query.trim();
    if (!clean) return [];
    try {
          const data = (await kommoFetch(
                `/leads?query=${encodeURIComponent(clean)}&with=contacts&limit=15`
          )) as { _embedded?: { leads?: KommoRawLead[] } } | null;
          const leads = data?._embedded?.leads || [];
          const results: KommoLeadSearchResult[] = [];
          for (const lead of leads) {
                const contactId = lead._embedded?.contacts?.[0]?.id;
                let contactName = "";
                let contactPhone = "";
                if (contactId) {
                      const contact = (await kommoFetch(`/contacts/${contactId}`)) as KommoRawContact | null;
                      contactName = contact?.name || "";
                      const phoneField = contact?.custom_fields_values?.find(
                            (f) => f.field_code === "PHONE"
                      );
                      contactPhone = phoneField?.values?.[0]?.value || "";
                }
                results.push({ id: lead.id, name: lead.name, contactName, contactPhone });
          }
          return results;
    } catch {
          return [];
    }
}

type KommoRawLead = {
  id: number;
  name: string;
  _embedded?: { contacts?: { id: number }[] };
};
type KommoRawContact = {
  name?: string;
  custom_fields_values?: { field_code: string; values?: { value: string }[] }[] | null;
};

export type KommoChatEvent = {
  id: string;
  type: "incoming_chat_message" | "outgoing_chat_message";
  entity_id: number;
  created_by: number;
  created_at: number;
};

// Va chercher les événements de messagerie (entrant/sortant) depuis
// `sinceUnix` — utilisé par /api/cron/kommo-response-times pour calculer le
// temps de réponse par employée (chaque employée a son propre compte
// Kommo, `created_by` identifie donc qui a répondu). Pagine jusqu'à
// épuisement (une page pleine = probablement une page suivante), avec une
// limite de sécurité pour ne jamais boucler indéfiniment.
export async function fetchKommoChatEvents(sinceUnix: number): Promise<KommoChatEvent[]> {
  const base = kommoApiBase();
  const token = process.env.KOMMO_ACCESS_TOKEN;
  if (!base || !token) return [];

  const events: KommoChatEvent[] = [];
  const limit = 250;
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams();
    params.append("filter[type][0]", "incoming_chat_message");
    params.append("filter[type][1]", "outgoing_chat_message");
    params.append("filter[created_at][from]", String(sinceUnix));
    params.append("limit", String(limit));
    params.append("page", String(page));
    const res = await fetch(`${base}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) break;
    if (!res.ok) break;
    const data = (await res.json()) as { _embedded?: { events?: KommoChatEvent[] } };
    const batch = data._embedded?.events ?? [];
    events.push(...batch);
    if (batch.length < limit) break;
  }
  return events;
}

function extractPhoneOrEmail(
    customFields: unknown,
    code: "PHONE" | "EMAIL"
  ): string {
    if (!Array.isArray(customFields)) return "";
    const field = customFields.find(
          (f) => f && typeof f === "object" && (f as { field_code?: string }).field_code === code
        ) as { values?: { value?: string }[] } | undefined;
    return field?.values?.[0]?.value ?? "";
}

// Va chercher le contact principal d'un lead Kommo pour compléter une fiche
// créée à partir d'un webhook "changement de statut" (qui ne fournit que
// l'id du lead et son nouveau statut).
export async function fetchKommoLeadContactInfo(
    leadId: number
  ): Promise<KommoLeadContactInfo | null> {
    try {
          const lead = (await kommoFetch(`/leads/${leadId}?with=contacts`)) as
                  | { _embedded?: { contacts?: { id: number; is_main?: boolean }[] } }
            | null;
          const contacts = lead?._embedded?.contacts ?? [];
          const mainContact = contacts.find((c) => c.is_main) ?? contacts[0];
          if (!mainContact) return null;

      const contact = (await kommoFetch(`/contacts/${mainContact.id}`)) as
              | { name?: string; custom_fields_values?: unknown }
            | null;
          if (!contact) return null;

      return {
              nom: contact.name ?? "",
              telephone: extractPhoneOrEmail(contact.custom_fields_values, "PHONE"),
              email: extractPhoneOrEmail(contact.custom_fields_values, "EMAIL"),
      };
    } catch {
          return null;
    }
}

// Kommo n'expose le canal réel (WhatsApp/Instagram/...) nulle part sur le
// lead ou le contact via l'API classique — vérifié en direct sur un lead
// Instagram confirmé (badge visible dans l'UI Kommo) : custom_fields_values
// et source_id sont vides des deux côtés. Le seul endroit qui le donne est
// /leads/unsorted (gratuit, inclus dans l'abonnement standard, aucun lien
// avec l'API Chats payante) via metadata.service ("waba", "instagram_business"...),
// tant que l'item reste dans sa fenêtre de rétention (~quelques jours,
// une cinquantaine d'items observés). Best-effort : un lead plus ancien que
// cette fenêtre, ou créé manuellement, n'y sera simplement pas — canal
// retombe alors sur le défaut existant, pas d'erreur.
const KOMMO_SERVICE_TO_CANAL: Record<string, string> = {
    waba: "WhatsApp",
    whatsapp: "WhatsApp",
    instagram_business: "Instagram",
    instagram: "Instagram",
    tiktok_business: "TikTok",
    tiktok: "TikTok",
};

export async function fetchKommoUnsortedCanal(): Promise<{
    byLeadId: Map<number, string>;
    byContactId: Map<number, string>;
}> {
    const byLeadId = new Map<number, string>();
    const byContactId = new Map<number, string>();
    try {
          const data = (await kommoFetch("/leads/unsorted?limit=250")) as
                  | {
                                  _embedded?: {
                                                unsorted?: {
                                                              metadata?: { service?: string };
                                                              _embedded?: {
                                                                            leads?: { id?: number }[];
                                                                            contacts?: { id?: number }[];
                                                              };
                                                }[];
                                  };
                    }
            | null;
          const items = data?._embedded?.unsorted ?? [];
          for (const item of items) {
                    const service = item.metadata?.service;
                    const canal = service ? KOMMO_SERVICE_TO_CANAL[service] : undefined;
                    if (!canal) continue;
                    const leadId = item._embedded?.leads?.[0]?.id;
                    const contactId = item._embedded?.contacts?.[0]?.id;
                    if (leadId) byLeadId.set(leadId, canal);
                    if (contactId) byContactId.set(contactId, canal);
          }
    } catch {
          // best-effort — ne doit jamais empêcher la création/synchro normale du lead.
    }
    return { byLeadId, byContactId };
}
