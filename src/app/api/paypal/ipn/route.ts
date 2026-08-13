import { createAdminClient } from "@/lib/supabase/admin";
import { extractIpnPaiement, parseIpnBody, verifyIpn } from "@/lib/paypalIpn";

// Reçoit les notifications IPN PayPal (voir src/lib/paypalIpn.ts pour le
// pourquoi d'IPN plutôt que les webhooks REST). Toujours journalisé, même
// en cas d'échec de vérification, pour pouvoir diagnostiquer si besoin.

export async function POST(request: Request) {
  const rawBody = await request.text();
  const fields = parseIpnBody(rawBody);

  const admin = createAdminClient();
  const eventType = fields.txn_type || "inconnu";

  const { data: logRow } = await admin
    .from("paypal_webhook_events")
    .insert({ event_type: eventType, payload: fields })
    .select("id")
    .single();

  let verified = false;
  let verifyError: string | null = null;
  try {
    verified = await verifyIpn(rawBody);
  } catch (err) {
    verified = false;
    verifyError = String(err instanceof Error ? err.message : err);
  }
  if (!verified) {
    if (logRow) {
      await admin
        .from("paypal_webhook_events")
        .update({ error: verifyError || "IPN non vérifié (réponse PayPal différente de VERIFIED)" })
        .eq("id", logRow.id);
    }
    // PayPal n'attend pas de code d'erreur particulier pour un IPN invalide,
    // mais on répond quand même 200 pour ne pas déclencher de retries en
    // boucle sur un message qu'on a déjà journalisé.
    return new Response("ok", { status: 200 });
  }

  try {
    const extrait = extractIpnPaiement(fields);
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

  // Toujours répondre 200 rapidement : PayPal désactive un IPN qui échoue
  // ou traîne trop souvent.
  return new Response("ok", { status: 200 });
}
