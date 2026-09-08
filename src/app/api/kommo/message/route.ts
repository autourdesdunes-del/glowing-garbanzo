import { createAdminClient } from "@/lib/supabase/admin";
import { cleanKommoName, CRM_STATUT_TO_KOMMO_STATUS_ID, parseKommoFormBody } from "@/lib/kommoWebhook";
import { updateKommoLeadStatus } from "@/lib/kommoApi";
import { extractProspectInfoFromMessage, KommoExtractedInfo } from "@/lib/kommoExtraction";
import { localDateStr } from "@/lib/dates";
import { PROSPECT_STATUTS } from "@/lib/constants";

// Sans ça, le statut avancé ici serait écrasé au prochain sync : le cron
// kommo-reconcile et le webhook classique traitent Kommo comme la seule
// source de vérité pour un lead lié (kommo_lead_id non nul) et réécrivent
// le statut CRM depuis la vraie étape Kommo dès qu'ils la revoient. Il faut
// donc pousser CE changement vers Kommo aussi, pas seulement dans le CRM —
// best-effort (jamais bloquant : le statut CRM reste posé même si l'appel
// Kommo échoue, comme pushStatutToKommo côté navigateur dans AppShell.tsx).
async function pousserStatutVersKommo(leadId: number | null, statut: string) {
  if (!leadId) return;
  const statusId = CRM_STATUT_TO_KOMMO_STATUS_ID[statut];
  if (!statusId) return;
  await updateKommoLeadStatus(leadId, statusId);
}

// Seul "Programme envoyé" (détecté par l'IA sur un message du PROSPECT) a
// un équivalent direct dans le pipeline CRM. "Devis donné" et "Réservé"
// n'ont volontairement pas d'équivalent : pas de statut "Devis donné" dans
// le pipeline CRM, et une confirmation ne doit jamais être déclenchée par
// une simple détection IA sur un message (ça reste une action humaine, via
// "Passer en client confirmé"). "Demande d'infos envoyée" n'est PAS ici :
// ça ne veut pas dire "le prospect pose des questions" (ce que l'IA
// détecte comme "Infos demandées") mais un événement précis et daté —
// l'équipe a envoyé le message-type de collecte d'infos de réservation
// (nom, pax, dates, hôtel, contact, passeports...) — voir
// estMessageDemandeInfos ci-dessous, détecté sur les messages de l'ÉQUIPE.
const ETAPE_DETECTEE_TO_STATUT: Record<string, string> = {
  "Programme envoyé": "Programme envoyé",
};

// Message-type envoyé par l'équipe pour collecter les infos nécessaires à
// la validation d'une réservation (texte de référence donné par Mélanie le
// 2026-09-08) — c'est CET envoi, et rien d'autre, qui définit le statut
// "Demande d'infos envoyée". Détection par mots-clés (pas d'IA : c'est un
// message-type copié-collé par l'équipe, pas un texte à interpréter) sur
// au moins 3 marqueurs distinctifs, pour tolérer de petites variations de
// formulation sans se déclencher sur un message qui n'a rien à voir.
const DEMANDE_INFOS_MARKERS = [
  "nombre de personnes",
  "dates du sejour",
  "pseudo instagram",
  "photo des passeports",
  "comment avez-vous connu",
  "numero de chambre",
  "numero egyptien",
];

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase();
}

function estMessageDemandeInfos(text: string): boolean {
  const normalized = normalizeText(text);
  return DEMANDE_INFOS_MARKERS.filter((m) => normalized.includes(m)).length >= 3;
}

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
    "id, statut, kommo_lead_id, kommo_resume, kommo_sejour_debut_estime, kommo_sejour_fin_estime, kommo_hotel_estime, kommo_nb_adultes_estime, kommo_nb_enfants_estime, kommo_ages_enfants_estime, kommo_activites_interet, kommo_activites_a_eviter, kommo_programme_envoye_resume, kommo_etape_detectee, kommo_premier_echange_le, kommo_demande_infos_envoyee_le";

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
    if (insertRes.error) {
      // Deux messages quasi simultanés pour un même lead tout juste créé
      // peuvent tous les deux ne trouver aucune fiche existante et tenter
      // de la créer — le premier réussit, le second tombe sur la contrainte
      // unique (kommo_lead_id/kommo_contact_id). Plutôt que de perdre ce
      // message, on relit la fiche que l'autre requête vient de créer.
      if (insertRes.error.code === "23505") {
        const retryQuery = leadId
          ? admin.from("clients").select(SELECT_FIELDS).eq("kommo_lead_id", leadId)
          : admin.from("clients").select(SELECT_FIELDS).eq("kommo_contact_id", contactId);
        const retryRes = await retryQuery.maybeSingle();
        if (retryRes.error || !retryRes.data) {
          throw new Error(`create client failed: ${insertRes.error.message}`);
        }
        existing = retryRes.data;
        isNewClient = false;
      } else {
        throw new Error(`create client failed: ${insertRes.error.message}`);
      }
    } else {
      existing = insertRes.data;
    }
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
  // Exception : on regarde quand même (sans IA, juste des mots-clés) si CE
  // message de l'équipe est le message-type de collecte d'infos — c'est
  // l'unique déclencheur de "Demande d'infos envoyée".
  if (!text.trim() || direction === "out") {
    const statutPatch: Record<string, unknown> = {};
    if (
      direction === "out" &&
      text.trim() &&
      estMessageDemandeInfos(text) &&
      PROSPECT_STATUTS.includes(existing.statut) &&
      PROSPECT_STATUTS.indexOf("Demande d'infos envoyée") > PROSPECT_STATUTS.indexOf(existing.statut)
    ) {
      statutPatch.statut = "Demande d'infos envoyée";
      if (!existing.kommo_demande_infos_envoyee_le) {
        statutPatch.kommo_demande_infos_envoyee_le = localDateStr(new Date());
      }
    }
    if (Object.keys(echangePatch).length > 0 || Object.keys(statutPatch).length > 0) {
      const patchRes = await admin
        .from("clients")
        .update({ ...echangePatch, ...statutPatch })
        .eq("id", existing.id);
      if (patchRes.error) throw new Error(`update echange dates failed: ${patchRes.error.message}`);
      if (typeof statutPatch.statut === "string") {
        await pousserStatutVersKommo(existing.kommo_lead_id, statutPatch.statut);
      }
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
    // Jamais reporté d'un message à l'autre — l'IA le réévalue à chaque
    // fois sur le seul message courant (voir kommoExtraction.ts).
    incident_signale: null,
  };

  const updated = await extractProspectInfoFromMessage({
    previousInfo,
    newMessageText: text,
    newMessageDirection: direction,
    todayStr: localDateStr(new Date()),
  });
  if (!updated) return existing.id;

  // Fait avancer le statut CRM vers "Programme envoyé" directement depuis
  // ce que dit le PROSPECT lui-même, sans dépendre d'un employé qui irait
  // déplacer l'étape dans le pipeline Kommo (déplacement qui, en pratique,
  // n'est presque jamais fait — voir l'audit Prospects). Uniquement en
  // avant (jamais de retour en arrière), et seulement tant que le dossier
  // est encore un prospect actif (jamais sur un client déjà
  // confirmé/perdu/annulé).
  const statutPatch: Record<string, unknown> = {};
  const statutCible = updated.etape_detectee ? ETAPE_DETECTEE_TO_STATUT[updated.etape_detectee] : null;
  if (statutCible && PROSPECT_STATUTS.includes(existing.statut)) {
    const indexActuel = PROSPECT_STATUTS.indexOf(existing.statut);
    const indexCible = PROSPECT_STATUTS.indexOf(statutCible);
    if (indexCible > indexActuel) {
      statutPatch.statut = statutCible;
    }
  }

  const updateRes = await admin
    .from("clients")
    .update({
      ...echangePatch,
      ...statutPatch,
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
  if (typeof statutPatch.statut === "string") {
    await pousserStatutVersKommo(existing.kommo_lead_id, statutPatch.statut);
  }

  // Signalement en direct d'un incident détecté sur ce message — jusqu'ici
  // ce type d'info finissait perdu dans kommo_resume, invisible sans relire
  // toute la conversation. Pas de doublon si le même incident (même titre)
  // est déjà ouvert pour ce client — un client qui revient sur le même
  // problème sur plusieurs messages ne doit pas créer une ligne par message.
  if (updated.incident_signale) {
    const { titre, details } = updated.incident_signale;
    const { data: dejaOuvert } = await admin
      .from("incidents")
      .select("id")
      .eq("client_id", existing.id)
      .eq("statut", "Ouvert")
      .eq("titre", titre)
      .maybeSingle();
    if (!dejaOuvert) {
      const incidentRes = await admin.from("incidents").insert({
        client_id: existing.id,
        titre,
        details,
        date_incident: localDateStr(new Date()),
        statut: "Ouvert",
        par: "Détection IA",
      });
      if (incidentRes.error) throw new Error(`create incident failed: ${incidentRes.error.message}`);
    }
  }

  return existing.id;
}
