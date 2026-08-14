import { createAdminClient } from "@/lib/supabase/admin";
import { fetchKommoLeadContactInfo } from "@/lib/kommoApi";
import { localDateStr } from "@/lib/dates";
import { normText } from "@/lib/duplicates";
import {
    cleanKommoName,
    detectKommoEventType,
    extractContactEntries,
    extractCustomFieldValue,
    extractLeadEntries,
    parseKommoFormBody,
      KOMMO_STATUS_MAP,
} from "@/lib/kommoWebhook";

// Kommo ne matche une fiche existante que par kommo_lead_id/téléphone/email
// — jamais par nom, trop risqué de rapprocher deux personnes différentes
// sans validation humaine. Quand aucun de ces signaux ne suffit, on crée
// quand même la fiche (ne jamais bloquer la synchro) mais on cherche un nom
// proche parmi les clients existants pour la marquer "à vérifier" — voir
// migration 0068 et DoublonPossibleAlert (pop-up) côté app.
async function findPossibleDuplicateByName(
  admin: ReturnType<typeof createAdminClient>,
  nom: string
): Promise<string | null> {
  const target = normText(nom);
  if (!target) return null;
  const { data } = await admin.from("clients").select("id, nom");
  const match = (data as { id: string; nom: string }[] | null)?.find((c) => normText(c.nom) === target);
  return match?.id ?? null;
}

// Id du statut Kommo "Demande d'infos envoyée" (cf. KOMMO_STATUS_MAP) — sert
// à horodater l'entrée dans cette étape, une seule fois côté webhook
// classique (fiable), pas déduit par l'IA.
const DEMANDE_INFOS_STATUS_ID = 109792995;

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
                        .select("id, nom, telephone, email, statut, kommo_demande_infos_envoyee_le")
                        .eq("kommo_lead_id", leadId)
                        .maybeSingle();

              if (existing) {
                        const patch: Record<string, unknown> = {
                                    kommo_pipeline_status_id: statusId,
                                    kommo_pipeline_status_nom: statusNom,
                                    kommo_synced_at: new Date().toISOString(),
                        };
                        // "Client annulé"/"Client perdu" sont des décisions manuelles côté
                        // CRM, sans équivalent dans le pipeline Kommo — un webhook qui
                        // resynchronise juste le statut (message reçu, etc., sans que
                        // personne n'ait rouvert le lead côté Kommo) ne doit jamais les
                        // écraser silencieusement en le repassant "Client confirmé".
                        if (mapped && existing.statut !== "Client annulé" && existing.statut !== "Client perdu") {
                                    patch.statut = mapped.statutCrm;
                        }
                        // Horodate l'entrée dans "Demande d'infos envoyée" une seule fois
                        // (ne réécrase pas une date déjà posée si le lead y repasse).
                        if (statusId === DEMANDE_INFOS_STATUS_ID && !existing.kommo_demande_infos_envoyee_le) {
                                    patch.kommo_demande_infos_envoyee_le = localDateStr(new Date());
                        }

                        // Le nom se resynchronise à chaque webhook (écrase une éventuelle
                        // saisie manuelle) — demande explicite : c'est Kommo qui fait foi
                        // pour le nom, et ça nettoie au passage le ✅ que les employées
                        // ajoutent parfois devant le nom sur Kommo.
                        const info = await fetchKommoLeadContactInfo(leadId);
                        const cleanedNom = cleanKommoName(info?.nom || "");
                        if (cleanedNom) patch.nom = cleanedNom;
                        if (info?.telephone && !existing.telephone) patch.telephone = info.telephone;
                        if (info?.email && !existing.email) patch.email = info.email;

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
              nom = cleanKommoName(nom);

              let matchedId: string | null = null;
              let matchedStatut: string | null = null;
              if (telephone) {
                        const { data } = await admin
                                    .from("clients")
                                    .select("id, statut")
                                    .eq("telephone", telephone)
                                    .maybeSingle();
                        matchedId = data?.id ?? null;
                        matchedStatut = data?.statut ?? null;
              }

              if (matchedId) {
                        const gardeStatut = matchedStatut === "Client annulé" || matchedStatut === "Client perdu";
                        await admin
                                    .from("clients")
                                    .update({
                                                  kommo_lead_id: leadId,
                                                  kommo_pipeline_status_id: statusId,
                                                  kommo_pipeline_status_nom: statusNom,
                                                  kommo_synced_at: new Date().toISOString(),
                                                  ...(mapped && !gardeStatut ? { statut: mapped.statutCrm } : {}),
                                                  ...(nom ? { nom } : {}),
                                    })
                                    .eq("id", matchedId);
                        lastClientId = matchedId;
              } else {
                        const doublonPossibleId = await findPossibleDuplicateByName(admin, nom);
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
                                                  doublon_possible_id: doublonPossibleId,
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
        const nom = cleanKommoName(typeof entry.name === "string" ? entry.name : "");

      const { data: existing } = await admin
          .from("clients")
          .select("id, nom, telephone, email")
          .eq("kommo_contact_id", contactId)
          .maybeSingle();

      if (existing) {
              const patch: Record<string, unknown> = { kommo_synced_at: new Date().toISOString() };
              // Le nom se resynchronise à chaque webhook (écrase une éventuelle
              // saisie manuelle) — demande explicite, et ça nettoie au passage le
              // ✅ ajouté parfois devant le nom côté Kommo. Téléphone/email ne se
              // comblent eux que s'ils sont vides.
          if (nom) patch.nom = nom;
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
                .update({
                            kommo_contact_id: contactId,
                            kommo_synced_at: new Date().toISOString(),
                            ...(nom ? { nom } : {}),
                })
                .eq("id", matchedId);
              lastClientId = matchedId;
      } else {
              const doublonPossibleId = await findPossibleDuplicateByName(admin, nom);
              const { data: created } = await admin
                .from("clients")
                .insert({
                            nom: nom || `Contact Kommo #${contactId}`,
                            statut: "Prospect",
                            telephone: phone || "",
                            email: email || "",
                            kommo_contact_id: contactId,
                            kommo_synced_at: new Date().toISOString(),
                            doublon_possible_id: doublonPossibleId,
                })
                .select("id")
                .single();
              lastClientId = created?.id ?? null;
      }
  }

  return lastClientId;
}
