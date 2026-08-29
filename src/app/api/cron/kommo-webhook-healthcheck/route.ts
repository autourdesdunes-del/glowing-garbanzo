import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

// Filet d'alerte pour la panne silencieuse constatée le 2026-08-27 : le
// widget tiers "Salesbot Webhooks by KWID" (abonnement payant, essai
// expiré) alimente kommo_webhook_events (event_type "prospect_message") à
// chaque message WhatsApp/Instagram reçu ou envoyé — sur un compte aussi
// actif que celui-ci (des dizaines de conversations par jour), une absence
// de plus de quelques heures est un signal fiable de panne, bien avant que
// quelqu'un ne tombe dessus par hasard dans Kommo. Ce job ne corrige rien,
// il prévient juste — voir /api/cron/kommo-reconcile pour le filet de
// correction côté statut/nom.
//
// N'envoie qu'un email par exécution (cron 1x/jour, plan Vercel Hobby) —
// pas de déduplication supplémentaire nécessaire : tant que la panne dure,
// un rappel quotidien est voulu, pas du bruit.

const SEUIL_HEURES = 20;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: lastEvent, error } = await admin
    .from("kommo_webhook_events")
    .select("created_at")
    .eq("event_type", "prospect_message")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const dernierMessageLe = lastEvent?.created_at ? new Date(lastEvent.created_at) : null;
  const heuresEcoulees = dernierMessageLe
    ? (Date.now() - dernierMessageLe.getTime()) / (1000 * 60 * 60)
    : Infinity;

  if (heuresEcoulees < SEUIL_HEURES) {
    return Response.json({ ok: true, dernierMessageLe, heuresEcoulees });
  }

  const alerteEnvoyee = await envoyerAlerte(dernierMessageLe);
  return Response.json({ ok: true, dernierMessageLe, heuresEcoulees, alerteEnvoyee });
}

async function envoyerAlerte(dernierMessageLe: Date | null): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const destinataire = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !destinataire) return false;

  const resend = new Resend(apiKey);
  const depuis = dernierMessageLe
    ? `${dernierMessageLe.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`
    : "jamais (aucun message reçu dans kommo_webhook_events)";

  try {
    await resend.emails.send({
      from: "Autour des Dunes CRM <onboarding@resend.dev>",
      to: destinataire,
      subject: "⚠️ Aucun message Kommo reçu depuis plus de 20h",
      text: `Le CRM n'a reçu aucun message WhatsApp/Instagram via le webhook Kommo depuis le ${depuis}.\n\nSur un compte aussi actif, c'est probablement une panne du webhook (licence expirée, Salesbot désactivé, etc.) plutôt qu'un vrai calme plat — vérifie dans Kommo (Settings > Webhooks > Request Logs) si les envois échouent.`,
    });
    return true;
  } catch {
    return false;
  }
}
