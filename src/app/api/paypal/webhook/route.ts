import { createAdminClient } from "@/lib/supabase/admin";
import { extractPaypalPaiement, verifyPaypalWebhookSignature } from "@/lib/paypalWebhook";

// Étape 1 de l'intégration PayPal : ce endpoint reçoit les webhooks
// "paiement reçu" du compte Business de l'agence, vérifie la signature
// PayPal (pas un simple token comme Kommo — PayPal fournit une vraie
// vérification cryptographique), journalise le payload brut, puis
// enregistre un paiement "à rattacher" qu'une employée reliera ensuite
// manuellement au bon client (voir paypal_paiements dans la migration
// 0058). Ne modifie jamais les colonnes acompte_* directement ici — ça se
// fait uniquement au moment du rattachement, côté UI.

export async function POST(request: Request) {
  const rawBody = await request.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { _parse_error: true, _raw: rawBody };
  }

  const admin = createAdminClient();
  const eventType = (payload.event_type as string) || "inconnu";

  // On journalise systématiquement, même si la signature échoue ensuite —
  // sinon un échec de vérification est invisible (rien en base) et
  // indiscernable de "PayPal n'a rien envoyé du tout".
  const { data: logRow } = await admin
    .from("paypal_webhook_events")
    .insert({ event_type: eventType, payload })
    .select("id")
    .single();

  let verified = false;
  let verifyError: string | null = null;
  try {
    verified = await verifyPaypalWebhookSignature(request.headers, rawBody);
  } catch (err) {
    verified = false;
    verifyError = String(err instanceof Error ? err.message : err);
  }
  if (!verified) {
    if (logRow) {
      await admin
        .from("paypal_webhook_events")
        .update({ error: verifyError || "Signature PayPal invalide" })
        .eq("id", logRow.id);
    }
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const extrait = extractPaypalPaiement(payload);
    if (extrait) {
      const { data: paiement } = await admin
        .from("paypal_paiements")
        .upsert(extrait, { onConflict: "transaction_id" })
        .select("id")
        .single();
      if (paiement && logRow) {
        await admin.from("paypal_webhook_events").update({ paiement_id: paiement.id }).eq("id", logRow.id);
      }
    }
  } catch (err) {
    if (logRow) {
      await admin
        .from("paypal_webhook_events")
        .update({ error: String(err instanceof Error ? err.message : err) })
        .eq("id", logRow.id);
    }
  }

  // Toujours répondre 200 rapidement : PayPal désactive un webhook qui
  // échoue ou traîne trop souvent.
  return new Response("ok", { status: 200 });
}
