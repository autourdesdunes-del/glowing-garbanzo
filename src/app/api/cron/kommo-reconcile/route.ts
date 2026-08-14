import { createAdminClient } from "@/lib/supabase/admin";
import { fetchKommoLead } from "@/lib/kommoApi";
import { KOMMO_STATUS_MAP, cleanKommoName } from "@/lib/kommoWebhook";

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
    const lead = await fetchKommoLead(client.kommo_lead_id as number);
    const statusId = typeof lead?.status_id === "number" ? lead.status_id : null;
    if (statusId === null) continue;

    const mapped = KOMMO_STATUS_MAP[statusId];
    if (!mapped || mapped.statutCrm === client.statut) continue;
    if (client.statut === "Client annulé" || client.statut === "Client perdu") continue;

    // Ce job ne passait jusqu'ici que par le statut : un lead rattrapé ici
    // (webhook "lead_status_changed" manqué, cf. commentaire plus haut)
    // gardait donc son nom d'origine (souvent un pseudo Instagram/WhatsApp)
    // même si l'équipe l'avait bien renommé "Prénom NOM" sur Kommo au
    // moment de le clôturer "Réservé".
    const cleanedNom = cleanKommoName(lead?.name || "");

    const { error: updateError } = await admin
      .from("clients")
      .update({
        statut: mapped.statutCrm,
        kommo_pipeline_status_id: statusId,
        kommo_pipeline_status_nom: mapped.nom,
        kommo_synced_at: new Date().toISOString(),
        ...(cleanedNom ? { nom: cleanedNom } : {}),
        // Le client partait d'un statut "actif" (jamais déjà confirmé, cf.
        // ACTIVE_STATUSES) : toute bascule vers "Client confirmé" ici est
        // une vraie nouvelle confirmation — déclenche la pop-up bloquante
        // "à compléter" côté équipe, comme pour le webhook classique.
        ...(mapped.statutCrm === "Client confirmé"
          ? { confirmation_a_traiter: true, confirmation_assignee_a: null }
          : {}),
      })
      .eq("id", client.id);

    if (!updateError) {
      updates.push({ nom: client.nom as string, from: client.statut as string, to: mapped.statutCrm });
    }
  }

  return Response.json({ checked: clients?.length ?? 0, updated: updates.length, updates });
}
