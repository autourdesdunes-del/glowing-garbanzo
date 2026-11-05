import { Resend } from "resend";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Email envoyé au client quand l'équipe répond à une conversation
// escaladée depuis l'arbre d'aide (BRIEF_MESSAGERIE.md) — le message est
// déjà enregistré en base avant cet appel (MessagerieView.tsx), jamais
// bloquant si l'envoi échoue. Même compte Resend et domaine vérifié que
// la vitrine (voir src/app/api/confirmer-demande/route.ts côté
// autour-des-dunes-vitrine) — la vérification de domaine est au niveau du
// compte Resend, pas du projet.
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { email, nom, contenu } = await request.json();
  if (!email || !contenu) {
    return Response.json({ error: "Champs manquants." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: true, skipped: "RESEND_API_KEY non configurée" });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Autour des Dunes <reservations@autourdesduneshurghada.com>",
      to: email,
      subject: "Réponse à votre question — Autour des Dunes",
      text: `Bonjour ${nom || ""},\n\n${contenu}\n\nÀ bientôt,\nL'équipe Autour des Dunes`,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
