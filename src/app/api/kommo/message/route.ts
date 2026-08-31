import { createAdminClient } from "@/lib/supabase/admin";
import { cleanKommoName, parseKommoFormBody } from "@/lib/kommoWebhook";
import { extractProspectInfoFromMessage, KommoExtractedInfo } from "@/lib/kommoExtraction";
import { localDateStr } from "@/lib/dates";

// Étape 2 (légère) de l'intégration Kommo : reçoit, message par message, le
// texte des conversations WhatsApp/Instagram — via un scénario Salesbot
// configuré dans Kommo ("message reçu → envoyer vers cette URL"), car le
// webhook classique Kommo (route /api/kommo/webhook) ne contient jamais le
// texte des messages. On ne stocke jamais ce texte dans Supabase : chaque
// message met juste à jour, via l'IA, un petit état structuré sur la fiche
// (dates de séjour estimées, hôtel, PAX, résumé, activités d'intérêt).
//
// Payload attendu (JSON ou form-urlencoded), à configurer côté Salesbot :
//   token       : le KOMMO_WEBHOOK_SECRET, en query string (?token=...)
//   lead_id     : id du lead Kommo (prioritaire pour retrouver la fiche)
//   contact_id  : id du contact Kommo (utilisé si pas de lead_id)
//   text        : le texte du message
//   direction   : "in" (message du prospect) ou "out" (message envoyé par l'équipe)

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.KOMMO_WEBHOOK_SECRET;

  if (!expected || token !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let payload: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      payload = parseKommoFormBody(await request.text());
    }
  } catch {
    payload = { _parse_error: true };
  }

  const admin = createAdminClient();

  const { data: logRow } = await admin
    .from("kommo_webhook_events")
    .insert({ event_type: "prospect_message", payload })
    .select("id")
    .single();

  try {
    const clientId = await processMessage(admin, payload);
    if (clientId && logRow) {
      await admin.from("kommo_webhook_events").update({ client_id: clientId }).eq("id", logRow.id);
    }
  } catch (err) {
    if (logRow) {
      await admin
        .from("kommo_webhook_events")
        .update({ error: String(err instanceof Error ? err.message : err) })
        .eq("id", logRow.id);
    }
  }

  return new Response("ok", { status: 200 });
}

async function processMessage(
  admin: ReturnType<typeof createAdminClient>,
  payload: Record<string, unknown>
): Promise<string | null> {
  const leadId = payload.lead_id ? Number(payload.lead_id) : null;
  const contactId = payload.contact_id ? Number(payload.contact_id) : null;
  const text = typeof payload.text === "string" ? payload.text : "";
  const direction = payload.direction === "out" ? "out" : "in";
  if (!leadId && !contactId) return null;

  const nowIso = new Date().toISOString();
  const SELECT_FIELDS =
    "id, kommo_resume, kommo_sejour_debut_estime, kommo_sejour_fin_estime, kommo_hotel_estime, kommo_nb_adultes_estime, kommo_nb_enfants_estime, kommo_ages_enfants_estime, kommo_activites_interet, kommo_activites_a_eviter, kommo_programme_envoye_resume, kommo_etape_detectee, kommo_premier_echange_le";

  let query = admin.from("clients").select(SELECT_FIELDS);
  query = leadId ? query.eq("kommo_lead_id", leadId) : query.eq("kommo_contact_id", contactId);
  const selectRes = await query.maybeSingle();
  if (selectRes.error) throw new Error(`select existing failed: ${selectRes.error.message}`);
  let existing = selectRes.data;
  let isNewClient = false;

  // Premier message d'un lead qui vient d'apparaître dans Kommo : la fiche
  // CRM n'existe pas encore (le webhook classique "lead_added" arrive
  // parfois après, ou pas du tout selon la config Kommo) — on la crée ici
  // à la volée avec ce que le payload du message fournit déjà, plutôt que
  // de perdre ce premier message.
  if (!existing) {
    isNewClient = true;
    const additionalData = (payload.additional_data as Record<string, unknown>) || {};
    const mainContact = (additionalData.main_contact as Record<string, unknown>) || {};
    const rawName =
      (typeof mainContact.name === "string" && mainContact.name) ||
      (typeof additionalData.name === "string" && additionalData.name) ||
      "";
    const nom = cleanKommoName(rawName) || (leadId ? `Lead Kommo #${leadId}` : `Contact Kommo #${contactId}`);
    const phones = additionalData.main_contact_phones as { simple_value?: string } | undefined;
    const telephone = phones?.simple_value || "";
    const status = additionalData.status as { id?: number; name?: string } | undefined;

    const insertRes = await admin
      .from("clients")
      .insert({
        nom,
        statut: "Prospect",
        telephone,
        kommo_lead_id: leadId,
        kommo_contact_id: contactId,
        kommo_pipeline_status_id: status?.id ?? null,
        kommo_pipeline_status_nom: status?.name || "",
        kommo_premier_echange_le: nowIso,
        kommo_synced_at: nowIso,
      })
      .select(SELECT_FIELDS)
      .single();
    if (insertRes.error) throw new Error(`create client failed: ${insertRes.error.message}`);
    existing = insertRes.data;
  }
  if (!existing) return null;

  // Date du tout premier échange et de dernier échange (dans chaque sens) —
  // posées à chaque message reçu, indépendamment du contenu, y compris les
  // messages sans texte (photo, sticker...).
  const echangePatch: Record<string, unknown> = {};
  if (!isNewClient && !existing.kommo_premier_echange_le) echangePatch.kommo_premier_echange_le = nowIso;
  if (direction === "out") echangePatch.kommo_last_team_reply_at = nowIso;
  else echangePatch.kommo_last_client_message_at = nowIso;

  // Un message de l'équipe (direction "out") ne sert qu'à horodater la
  // réponse — jamais d'appel IA dessus : l'extraction ne sert qu'à
  // comprendre ce que dit le PROSPECT, pas à analyser nos propres messages.
  // Ça divise par ~2 le nombre d'appels IA (voir project_kommo_etape_detectee).
  if (!text.trim() || direction === "out") {
    if (Object.keys(echangePatch).length > 0) {
      const patchRes = await admin.from("clients").update(echangePatch).eq("id", existing.id);
      if (patchRes.error) throw new Error(`update echange dates failed: ${patchRes.error.message}`);
    }
    return existing.id;
  }

  const previousInfo: KommoExtractedInfo = {
    resume: existing.kommo_resume || null,
    sejour_debut_estime: existing.kommo_sejour_debut_estime,
    sejour_fin_estime: existing.kommo_sejour_fin_estime,
    hotel_estime: existing.kommo_hotel_estime || null,
    nb_adultes_estime: existing.kommo_nb_adultes_estime,
    nb_enfants_estime: existing.kommo_nb_enfants_estime,
    ages_enfants_estime: existing.kommo_ages_enfants_estime || null,
    activites_interet: existing.kommo_activites_interet || null,
    activites_a_eviter: existing.kommo_activites_a_eviter || null,
    programme_envoye_resume: existing.kommo_programme_envoye_resume || null,
    etape_detectee: existing.kommo_etape_detectee || null,
  };

  const updated = await extractProspectInfoFromMessage({
    previousInfo,
    newMessageText: text,
    newMessageDirection: direction,
    todayStr: localDateStr(new Date()),
  });
  if (!updated) return existing.id;

  const updateRes = await admin
    .from("clients")
    .update({
      ...echangePatch,
      kommo_resume: updated.resume || "",
      kommo_sejour_debut_estime: updated.sejour_debut_estime,
      kommo_sejour_fin_estime: updated.sejour_fin_estime,
      kommo_hotel_estime: updated.hotel_estime || "",
      kommo_nb_adultes_estime: updated.nb_adultes_estime,
      kommo_nb_enfants_estime: updated.nb_enfants_estime,
      kommo_ages_enfants_estime: updated.ages_enfants_estime || "",
      kommo_activites_interet: updated.activites_interet || "",
      kommo_activites_a_eviter: updated.activites_a_eviter || "",
      kommo_programme_envoye_resume: updated.programme_envoye_resume || "",
      kommo_etape_detectee: updated.etape_detectee || "",
      kommo_extraction_updated_at: nowIso,
    })
    .eq("id", existing.id);
  if (updateRes.error) throw new Error(`update client failed: ${updateRes.error.message}`);

  return existing.id;
}
