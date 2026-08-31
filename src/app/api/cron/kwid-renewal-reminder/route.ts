import { Resend } from "resend";

// Rappel de renouvellement pour l'abonnement KWID "Salesbot Webhooks"
// (facturé tous les 6 mois, cf. project_kommo_kwid_webhook_outage) — sans
// ça, personne ne le remarque avant que le webhook retombe en panne comme
// le 27/08/2026. KWID n'a pas d'API de statut d'abonnement accessible ;
// la date de renouvellement est donc stockée en dur ici, à mettre à jour
// à chaque paiement (mets KWID_RENEWAL_DATE à jour dans Vercel après
// chaque renouvellement, sinon ce job continuera d'alerter sur une date
// passée).
//
// N'envoie qu'un email par exécution, dans la fenêtre des JOURS_AVANT
// jours précédant l'échéance — un rappel quotidien pendant cette fenêtre
// est voulu, pas du bruit, tant que la date n'a pas été mise à jour.

const JOURS_AVANT = 5;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const renewalDateStr = process.env.KWID_RENEWAL_DATE;
  if (!renewalDateStr) {
    return Response.json({ ok: true, skipped: "KWID_RENEWAL_DATE non configurée" });
  }

  const renewalDate = new Date(renewalDateStr);
  const joursRestants = Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (joursRestants > JOURS_AVANT || joursRestants < 0) {
    return Response.json({ ok: true, joursRestants });
  }

  const alerteEnvoyee = await envoyerAlerte(renewalDate, joursRestants);
  return Response.json({ ok: true, joursRestants, alerteEnvoyee });
}

async function envoyerAlerte(renewalDate: Date, joursRestants: number): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const destinataire = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !destinataire) return false;

  const resend = new Resend(apiKey);
  const dateStr = renewalDate.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

  try {
    await resend.emails.send({
      from: "Autour des Dunes CRM <onboarding@resend.dev>",
      to: destinataire,
      subject: `URGENT RENOUVELLEMENT — KWID (Kommo) à renouveler dans ${joursRestants} jour${joursRestants > 1 ? "s" : ""}`,
      text: `L'abonnement KWID "Salesbot Webhooks" (6 mois) arrive à échéance le ${dateStr}.\n\nSans renouvellement, le webhook qui alimente le résumé IA des conversations WhatsApp/Instagram retombera en panne silencieuse (comme le 27/08/2026).\n\nPour payer : https://wearekwid.com/buy-subscription?widget_code=dnov_sb_webhook&quantity=4&account_id=36806219\n\nUne fois payé, pense à mettre à jour KWID_RENEWAL_DATE dans les variables d'environnement Vercel avec la nouvelle date d'échéance.`,
    });
    return true;
  } catch {
    return false;
  }
}
