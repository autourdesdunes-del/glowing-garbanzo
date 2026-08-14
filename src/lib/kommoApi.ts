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
