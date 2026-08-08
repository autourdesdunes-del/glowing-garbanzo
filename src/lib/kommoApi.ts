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
