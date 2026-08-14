import { createAdminClient } from "@/lib/supabase/admin";
import { fetchKommoLeadStatus } from "@/lib/kommoApi";
import { KOMMO_STATUS_MAP } from "@/lib/kommoWebhook";

// Filet de sécurité pour le sync Kommo → CRM : constaté que le webhook
// classique ("lead_status_changed") n'émet pas toujours d'événement quand
// un lead est clôturé "Réservé" côté Kommo (bouton de clôture, distinct
// d'un simple déplacement d'étape) — plusieurs fiches sont restées bloquées
// sur "Demande d'infos envoyée" alors que le client avait déjà payé. Ce job
// planifié revérifie périodiquement, via l'API, le statut réel des leads
// actifs et corrige le CRM si besoin. Ne touche jamais "Client annulé" (une
// décision manuelle côté CRM, sans équivalent dans le pipeline Kommo).

const ACTIVE_STATUSES = ["Prospect", "À relancer", "Programme envoyé", "Demande d'infos envoyée"];

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: clients, error } = await admin
    .from("clients")
    .select("id, nom, statut, kommo_lead_id, kommo_pipeline_status_nom")
    .in("statut", ACTIVE_STATUSES)
    .not("kommo_lead_id", "is", null);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const updates: { nom: string; from: string; to: string }[] = [];

  for (const client of clients ?? []) {
    const statusId = await fetchKommoLeadStatus(client.kommo_lead_id as number);
    if (statusId === null) continue;

    const mapped = KOMMO_STATUS_MAP[statusId];
    if (!mapped || mapped.statutCrm === client.statut) continue;
    if (client.statut === "Client annulé" || client.statut === "Client perdu") continue;

    const { error: updateError } = await admin
      .from("clients")
      .update({
        statut: mapped.statutCrm,
        kommo_pipeline_status_id: statusId,
        kommo_pipeline_status_nom: mapped.nom,
        kommo_synced_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (!updateError) {
      updates.push({ nom: client.nom as string, from: client.statut as string, to: mapped.statutCrm });
    }
  }

  return Response.json({ checked: clients?.length ?? 0, updated: updates.length, updates });
}
