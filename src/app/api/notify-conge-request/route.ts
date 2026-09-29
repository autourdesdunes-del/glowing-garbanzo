import { Resend } from "resend";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { MELANIE_ALERT_EMAIL } from "@/lib/constants";

// Email envoyé à Mélanie dès qu'une employée soumet une demande de congé
// (demande du 2026-09-29) — en plus de la notif dans l'app (voir
// CongeDemandeAlert.tsx). Appelé côté client juste après l'insert dans
// `conges` (requestConge, PlanningRHView.tsx), donc un seul appel par
// demande même si elle couvre plusieurs jours (une ligne par jour en base).

function fmt(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { employeNom, dateDebut, dateFin, motif } = await request.json();
  if (!employeNom || !dateDebut || !dateFin) {
    return Response.json({ error: "Champs manquants." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: true, skipped: "RESEND_API_KEY non configurée" });
  }

  const periode = dateDebut === dateFin ? fmt(dateDebut) : `du ${fmt(dateDebut)} au ${fmt(dateFin)}`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Autour des Dunes CRM <onboarding@resend.dev>",
      to: MELANIE_ALERT_EMAIL,
      subject: `Nouvelle demande de congé — ${employeNom}`,
      text: `${employeNom} a demandé un congé ${periode}.${motif ? `\n\nMotif : ${motif}` : ""}\n\nÀ valider dans le CRM (Planning équipe > Congés).`,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
