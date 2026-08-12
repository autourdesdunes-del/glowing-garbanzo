// Décodage des payloads webhook Kommo. Kommo envoie du
// application/x-www-form-urlencoded avec des clés en notation crochets
// (ex: "leads[status][0][id]=123"), qu'il faut reconstruire en objet
// imbriqué avant de pouvoir le lire normalement.

export function parseKommoFormBody(body: string): Record<string, unknown> {
    const params = new URLSearchParams(body);
    const root: Record<string, unknown> = {};

  for (const [rawKey, value] of params.entries()) {
        const path = rawKey
          .replace(/\]/g, "")
          .split("[")
          .map((segment) => segment.trim());

      let node: Record<string, unknown> = root;
        for (let i = 0; i < path.length - 1; i++) {
                const key = path[i];
                const nextKeyIsIndex = /^\d+$/.test(path[i + 1]);
                if (node[key] === undefined) {
                          node[key] = nextKeyIsIndex ? [] : {};
                }
                node = node[key] as Record<string, unknown>;
        }
        const lastKey = path[path.length - 1];
        (node as Record<string, unknown>)[lastKey] = value;
  }

  return root;
}

function capitalize(word: string): string {
    return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;
}

// Les employées ajoutent parfois un ✅ (ou variante) devant le nom dans
// Kommo pour se signaler à elles-mêmes qu'une fiche a été vérifiée — utile
// sur Kommo, mais ça ne doit jamais apparaître côté CRM. On applique aussi
// la convention "Prénom NOM" : prénom avec une majuscule initiale, nom de
// famille tout en majuscules — quelle que soit la casse saisie sur Kommo.
export function cleanKommoName(raw: string): string {
    const name = raw.replace(/[✅✔️✔☑️☑]/g, "").trim().replace(/\s+/g, " ");
    if (!name) return name;
    const parts = name.split(" ");
    if (parts.length < 2) return capitalize(parts[0]);
    const [prenom, ...reste] = parts;
    return `${capitalize(prenom)} ${reste.join(" ").toUpperCase()}`;
}

// Correspondance entre les étapes du pipeline Kommo (compte
// autourdesdunes, pipeline "Pipeline" id 14220187) et le statut CRM.
// Ids récupérés via GET /api/v4/leads/pipelines le 2026-08-08 — à mettre
// à jour si les étapes du pipeline changent côté Kommo.
export const KOMMO_STATUS_MAP: Record<number, { nom: string; statutCrm: string }> = {
      109792979: { nom: "Incoming leads", statutCrm: "Prospect" },
      109792983: { nom: "Prospect", statutCrm: "Prospect" },
      109792987: { nom: "À relancer", statutCrm: "À relancer" },
      109792991: { nom: "Programme envoyé", statutCrm: "Programme envoyé" },
      109792995: { nom: "Demande d'infos envoyée", statutCrm: "Demande d'infos envoyée" },
      142: { nom: "Réservé", statutCrm: "Client confirmé" },
      143: { nom: "Client perdu", statutCrm: "Client perdu" },
};

export type KommoEventType =
    | "lead_status_changed"
  | "lead_added"
  | "contact_added_or_updated"
  | "task_added_or_updated"
  | "talk"
  | "inconnu";

export function detectKommoEventType(payload: Record<string, unknown>): KommoEventType {
    const leads = payload.leads as Record<string, unknown> | undefined;
    if (leads?.status) return "lead_status_changed";
    if (leads?.add) return "lead_added";

  const contacts = payload.contacts as Record<string, unknown> | undefined;
    if (contacts?.add || contacts?.update) return "contact_added_or_updated";

  if (payload.task) return "task_added_or_updated";
    if (payload.talks || payload.message) return "talk";

  return "inconnu";
}

function asArray(value: unknown): Record<string, unknown>[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
    if (typeof value === "object") return Object.values(value as object) as Record<string, unknown>[];
    return [];
}

export function extractLeadEntries(payload: Record<string, unknown>): Record<string, unknown>[] {
    const leads = payload.leads as Record<string, unknown> | undefined;
    if (!leads) return [];
    return [...asArray(leads.status), ...asArray(leads.add)];
}

export function extractContactEntries(payload: Record<string, unknown>): Record<string, unknown>[] {
    const contacts = payload.contacts as Record<string, unknown> | undefined;
    if (!contacts) return [];
    return [...asArray(contacts.add), ...asArray(contacts.update)];
}

// Les custom_fields Kommo classiques arrivent en forme
// custom_fields[0][code]=PHONE / custom_fields[0][values][0][value]=...
export function extractCustomFieldValue(
    entry: Record<string, unknown>,
    code: string
  ): string | undefined {
    const fields = asArray(entry.custom_fields);
    const field = fields.find((f) => f.code === code || f.id === code);
    if (!field) return undefined;
    const values = asArray(field.values);
    const first = values[0]?.value;
    return typeof first === "string" ? first : undefined;
}
