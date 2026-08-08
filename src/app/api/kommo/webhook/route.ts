import { createAdminClient } from "@/lib/supabase/admin";
import { fetchKommoLeadContactInfo } from "@/lib/kommoApi";
import {
    detectKommoEventType,
    extractContactEntries,
    extractCustomFieldValue,
    extractLeadEntries,
    parseKommoFormBody,
      KOMMO_STATUS_MAP,
} from "@/lib/kommoWebhook";

// Étape 1 (lecture seule) de l'intégration Kommo : ce endpoint reçoit les
// webhooks Kommo (statut de lead, contact ajouté/modifié) et se contente de
// journaliser + relier des fiches client. Il n'envoie jamais rien vers
// Kommo — l'écriture (étape 2) sera un endpoint séparé, activé plus tard.
//
// Le token en query string est notre seule protection : Kommo n'envoie pas
// de header de signature fiable pour les webhooks classiques d'une
// intégration privée. Ne jamais rendre cette URL publique.

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
                const rawText = await request.text();
                payload = parseKommoFormBody(rawText);
        }
  } catch {
        payload = { _parse_error: true };
  }

  const admin = createAdminClient();
    const eventType = detectKommoEventType(payload);

  const { data: logRow } = await admin
      .from("kommo_webhook_events")
      .insert({ event_type: eventType, payload })
      .select("id")
      .single();

  try {
        const clientId = await processKommoEvent(admin, payload, eventType);
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

  // Toujours répondre 200 rapidement : Kommo désactive un webhook qui
  // échoue ou traîne trop souvent.
  return new Response("ok", { status: 200 });
}

async function processKommoEvent(
    admin: ReturnType<typeof createAdminClient>,
    payload: Record<string, unknown>,
    eventType: string
  ): Promise<string | null> {
    if (eventType === "lead_status_changed" || eventType === "lead_added") {
          return processLeadEvent(admin, payload);
    }
    if (eventType === "contact_added_or_updated") {
          return processContactEvent(admin, payload);
    }
    // task_added_or_updated / talk / inconnu : journalisés seulement pour
  // l'instant, le temps de voir de vrais payloads et décider quoi en faire.
  return null;
}

async function processLeadEvent(
      admin: ReturnType<typeof createAdminClient>,
      payload: Record<string, unknown>
    ): Promise<string | null> {
      const entries = extractLeadEntries(payload);
      let lastClientId: string | null = null;
    
      for (const entry of entries) {
              const leadId = Number(entry.id);
              if (!leadId) continue;
          
              const statusId = entry.status_id ? Number(entry.status_id) : null;
              const mapped = statusId ? KOMMO_STATUS_MAP[statusId] : undefined;
              const statusNom = typeof entry.status_name === "string" && entry.status_name
                        ? entry.status_name
                        : mapped?.nom ?? "";
              const entryName = typeof entry.name === "string" ? entry.name : "";
          
              const { data: existing } = await admin
                        .from("clients")
                        .select("id, nom, telephone, email")
                        .eq("kommo_lead_id", leadId)
                        .maybeSingle();
          
              if (existing) {
                        const patch: Record<string, unknown> = {
                                    kommo_pipeline_status_id: statusId,
                                    kommo_pipeline_status_nom: statusNom,
                                    kommo_synced_at: new Date().toISOString(),
                        };
                        if (mapped) patch.statut = mapped.statutCrm;
                  
                        const isPlaceholder = !existing.nom || existing.nom.startsWith("Lead Kommo #");
                        if (isPlaceholder) {
                                    const info = await fetchKommoLeadContactInfo(leadId);
                                    if (info?.nom) patch.nom = info.nom;
                                    if (info?.telephone && !existing.telephone) patch.telephone = info.telephone;
                                    if (info?.email && !existing.email) patch.email = info.email;
                        }
                  
                        await admin.from("clients").update(patch).eq("id", existing.id);
                        lastClientId = existing.id;
                        continue;
              }
          
              let nom = entryName;
              let telephone = "";
              let email = "";
              if (!nom) {
                        const info = await fetchKommoLeadContactInfo(leadId);
                        if (info) {
                                    nom = info.nom;
                                    telephone = info.telephone;
                                    email = info.email;
                        }
              }
          
              let matchedId: string | null = null;
              if (telephone) {
                        const { data } = await admin.from("clients").select("id").eq("telephone", telephone).maybeSingle();
                        matchedId = data?.id ?? null;
              }
          
              if (matchedId) {
                        await admin
                                    .from("clients")
                                    .update({
                                                  kommo_lead_id: leadId,
                                                  kommo_pipeline_status_id: statusId,
                                                  kommo_pipeline_status_nom: statusNom,
                                                  kommo_synced_at: new Date().toISOString(),
                                                  ...(mapped ? { statut: mapped.statutCrm } : {}),
                                    })
                                    .eq("id", matchedId);
                        lastClientId = matchedId;
              } else {
                        const { data: created } = await admin
                                    .from("clients")
                                    .insert({
                                                  nom: nom || `Lead Kommo #${leadId}`,
                                                  statut: mapped?.statutCrm ?? "Prospect",
                                                  telephone,
                                                  email,
                                                  kommo_lead_id: leadId,
                                                  kommo_pipeline_status_id: statusId,
                                                  kommo_pipeline_status_nom: statusNom,
                                                  kommo_synced_at: new Date().toISOString(),
                                    })
                                    .select("id")
                                    .single();
                        lastClientId = created?.id ?? null;
              }
      }
    
      return lastClientId;
}

async function processContactEvent(
    admin: ReturnType<typeof createAdminClient>,
    payload: Record<string, unknown>
  ): Promise<string | null> {
    const entries = extractContactEntries(payload);
    let lastClientId: string | null = null;

  for (const entry of entries) {
        const contactId = Number(entry.id);
        if (!contactId) continue;

      const phone = extractCustomFieldValue(entry, "PHONE");
        const email = extractCustomFieldValue(entry, "EMAIL");
        const nom = typeof entry.name === "string" ? entry.name : "";

      const { data: existing } = await admin
          .from("clients")
          .select("id, nom, telephone, email")
          .eq("kommo_contact_id", contactId)
          .maybeSingle();

      if (existing) {
              const patch: Record<string, unknown> = { kommo_synced_at: new Date().toISOString() };
              // On ne remplace jamais une donnée déjà saisie par l'équipe, on ne
          // comble que les champs vides.
          if (!existing.nom && nom) patch.nom = nom;
              if (!existing.telephone && phone) patch.telephone = phone;
              if (!existing.email && email) patch.email = email;
              await admin.from("clients").update(patch).eq("id", existing.id);
              lastClientId = existing.id;
              continue;
      }

      // Pas de fiche existante liée à ce contact : on tente un rapprochement
      // par téléphone/email avant de créer un doublon.
      let matchedId: string | null = null;
        if (phone) {
                const { data } = await admin.from("clients").select("id").eq("telephone", phone).maybeSingle();
                matchedId = data?.id ?? null;
        }
        if (!matchedId && email) {
                const { data } = await admin.from("clients").select("id").eq("email", email).maybeSingle();
                matchedId = data?.id ?? null;
        }

      if (matchedId) {
              await admin
                .from("clients")
                .update({ kommo_contact_id: contactId, kommo_synced_at: new Date().toISOString() })
                .eq("id", matchedId);
              lastClientId = matchedId;
      } else {
              const { data: created } = await admin
                .from("clients")
                .insert({
                            nom: nom || `Contact Kommo #${contactId}`,
                            statut: "Prospect",
                            telephone: phone || "",
                            email: email || "",
                            kommo_contact_id: contactId,
                            kommo_synced_at: new Date().toISOString(),
                })
                .select("id")
                .single();
              lastClientId = created?.id ?? null;
      }
  }

  return lastClientId;
}
