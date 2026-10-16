import { SupabaseClient } from "@supabase/supabase-js";

// Prénom (ou repli e-mail) de l'employée actuellement connectée — même
// logique que remplirCreePar (ClientDetail.tsx), factorisée ici pour être
// réutilisée partout où une action doit être attribuée à quelqu'un (ex.
// MontantCommuniqueAlertModal : "qui a copié ce montant").
export async function getCurrentUserNom(supabase: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return "";
    const { data: prof } = await supabase.from("profiles").select("prenom, email").eq("id", userId).single();
    return prof?.prenom || (prof?.email || "").split("@")[0] || "";
  } catch {
    return "";
  }
}
