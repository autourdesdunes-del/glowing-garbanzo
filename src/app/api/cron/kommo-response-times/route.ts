import { createAdminClient } from "@/lib/supabase/admin";
import { fetchKommoChatEvents, KommoChatEvent } from "@/lib/kommoApi";

// Calcule le temps de réponse par employée à partir des messages Kommo
// (chaque employée a son propre compte Kommo — voir migration
// 0082_kommo_reponses_employe.sql). Ne tourne jamais en direct depuis le
// navigateur : l'API Kommo limite à 7 requêtes/s, et un calcul par ouverture
// du rapport Manager exploserait ce quota. Relit toujours les dernières 48h
// (pas juste depuis le dernier run) par sécurité si un run a été manqué —
// la contrainte unique sur kommo_event_id évite les doublons.
const LOOKBACK_HOURS = 48;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const sinceUnix = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;
  const events = await fetchKommoChatEvents(sinceUnix);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, prenom, kommo_user_id")
    .not("kommo_user_id", "is", null);
  const profileByKommoId = new Map<number, { id: string; prenom: string }>();
  (profiles ?? []).forEach((p) => {
    if (typeof p.kommo_user_id === "number") profileByKommoId.set(p.kommo_user_id, { id: p.id, prenom: p.prenom });
  });

  const leadIds = Array.from(new Set(events.map((e) => e.entity_id)));
  const { data: clients } = leadIds.length
    ? await admin.from("clients").select("id, kommo_lead_id").in("kommo_lead_id", leadIds)
    : { data: [] as { id: string; kommo_lead_id: number | null }[] };
  const clientByLeadId = new Map<number, string>();
  (clients ?? []).forEach((c) => {
    if (typeof c.kommo_lead_id === "number") clientByLeadId.set(c.kommo_lead_id, c.id);
  });

  const byLead = new Map<number, KommoChatEvent[]>();
  events.forEach((e) => {
    const list = byLead.get(e.entity_id) ?? [];
    list.push(e);
    byLead.set(e.entity_id, list);
  });

  type Row = {
    kommo_event_id: string;
    client_id: string | null;
    kommo_lead_id: number;
    kommo_user_id: number;
    employe_id: string;
    employe_nom: string;
    message_client_at: string;
    reponse_at: string;
    delai_secondes: number;
  };
  const rows: Row[] = [];

  byLead.forEach((leadEvents, leadId) => {
    const sorted = [...leadEvents].sort((a, b) => a.created_at - b.created_at);
    // Le premier message client en attente d'une réponse non encore
    // apparié — si plusieurs messages client s'enchaînent avant une
    // réponse, le délai se mesure depuis le premier (l'attente réelle du
    // client), pas depuis le dernier.
    let pendingClientAt: number | null = null;
    for (const e of sorted) {
      if (e.type === "incoming_chat_message") {
        if (pendingClientAt === null) pendingClientAt = e.created_at;
        continue;
      }
      // outgoing_chat_message
      if (pendingClientAt === null) continue; // réponse proactive, rien à apparier
      const profile = profileByKommoId.get(e.created_by);
      if (profile) {
        rows.push({
          kommo_event_id: e.id,
          client_id: clientByLeadId.get(leadId) ?? null,
          kommo_lead_id: leadId,
          kommo_user_id: e.created_by,
          employe_id: profile.id,
          employe_nom: profile.prenom,
          message_client_at: new Date(pendingClientAt * 1000).toISOString(),
          reponse_at: new Date(e.created_at * 1000).toISOString(),
          delai_secondes: e.created_at - pendingClientAt,
        });
      }
      pendingClientAt = null;
    }
  });

  let inserted = 0;
  if (rows.length > 0) {
    const { data, error } = await admin
      .from("kommo_reponses_employe")
      .upsert(rows, { onConflict: "kommo_event_id", ignoreDuplicates: true })
      .select("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    inserted = data?.length ?? 0;
  }

  return Response.json({ events: events.length, paired: rows.length, inserted });
}
