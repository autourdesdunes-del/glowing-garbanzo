import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, prenom, nav_masque, suivis_visibles")
    .eq("id", user.id)
    .single();

  return (
    <AppShell
      userEmail={user.email ?? ""}
      userId={user.id}
      role={profile?.role ?? "equipe"}
      prenom={profile?.prenom ?? ""}
      navMasque={profile?.nav_masque ?? []}
      suivisVisibles={profile?.suivis_visibles ?? null}
    />
  );
}
