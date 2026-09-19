import { createClient as createServerClient } from "@/lib/supabase/server";
import { searchKommoLeads } from "@/lib/kommoApi";

// Recherche de leads Kommo depuis le navigateur — utilisée par
// QuickAddClient.tsx pour relier un nouveau dossier client à sa
// conversation Kommo dès la création. Protégée par la session Supabase de
// l'utilisateur (le token Kommo lui-même reste côté serveur).

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { query } = await request.json();
  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ results: [] });
  }

  const results = await searchKommoLeads(query);
  return Response.json({ results });
}
