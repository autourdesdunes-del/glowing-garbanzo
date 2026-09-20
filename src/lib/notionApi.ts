// Appels sortants vers l'API Notion — poussent chaque client modifié vers
// la base Notion "nouvel essai bdd client 1" (copie de secours en cas de
// problème sur le CRM, Mélanie 2026-09-20). Best-effort : un échec ici ne
// doit jamais faire planter le job planifié dans son ensemble, une seule
// page en erreur ne doit pas bloquer les suivantes.

const NOTION_VERSION = "2022-06-28";

function notionHeaders(): Record<string, string> | null {
  const token = process.env.NOTION_API_KEY;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

export type NotionProperties = Record<string, unknown>;

// Crée la page si `pageId` est vide, sinon met à jour la page existante —
// seules les propriétés passées dans `properties` sont touchées, tout le
// reste de la page (colonnes remplies à la main type "Signature
// vérificateur", "Statut billet"...) reste intact.
export async function upsertNotionPage(
  pageId: string | null,
  properties: NotionProperties
): Promise<{ ok: true; pageId: string } | { ok: false; error: string }> {
  const headers = notionHeaders();
  const databaseId = process.env.NOTION_CLIENTS_DATABASE_ID;
  if (!headers) return { ok: false, error: "NOTION_API_KEY manquant" };
  if (!databaseId) return { ok: false, error: "NOTION_CLIENTS_DATABASE_ID manquant" };

  try {
    if (pageId) {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ properties }),
      });
      if (res.ok) return { ok: true, pageId };
      // La page a pu être supprimée/déplacée côté Notion depuis — on
      // retombe sur une création plutôt que de rester bloqué en erreur.
      if (res.status !== 404) {
        const text = await res.text();
        return { ok: false, error: `PATCH ${res.status} : ${text.slice(0, 300)}` };
      }
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers,
      body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `POST ${res.status} : ${text.slice(0, 300)}` };
    }
    const data = (await res.json()) as { id: string };
    return { ok: true, pageId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
