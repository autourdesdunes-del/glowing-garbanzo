import { createAdminClient } from "@/lib/supabase/admin";

// Route de diagnostic TEMPORAIRE — sert uniquement à découvrir la forme
// exacte envoyée par l'action native Kommo "Send webhook" (Salesbot),
// piste gratuite pour remplacer le widget payant KWID (coupé depuis le
// 31/08, plus aucun message d'équipe capturé côté CRM depuis). Contrairement
// à /api/kommo/message, on ne présume rien du format ici : on logue tout
// (méthode, query, headers, corps brut) tel quel dans kommo_webhook_events,
// pour pouvoir l'inspecter après un test réel dans Kommo. À supprimer une
// fois le format connu et le vrai parsing branché (ou KWID confirmé
// nécessaire après tout).

async function logAndRespond(request: Request) {
  const url = new URL(request.url);
  const admin = createAdminClient();

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    rawBody = "(impossible de lire le corps)";
  }

  let bodyParsed: unknown = null;
  try {
    bodyParsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    bodyParsed = null;
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  await admin.from("kommo_webhook_events").insert({
    event_type: "debug_send_webhook_test",
    payload: {
      method: request.method,
      query: Object.fromEntries(url.searchParams.entries()),
      headers,
      body_raw: rawBody,
      body_parsed: bodyParsed,
    },
  });

  return new Response("ok", { status: 200 });
}

export async function POST(request: Request) {
  return logAndRespond(request);
}

export async function GET(request: Request) {
  return logAndRespond(request);
}
