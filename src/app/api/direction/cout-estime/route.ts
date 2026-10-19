import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { coutPrestataireEstimeEnEuros } from "@/lib/coutPrestataire";
import { Client, Reservation } from "@/lib/types";

// Suggestion de coût prestataire pour une réservation — réservée à la
// Direction, comme reservation_couts lui-même (migration
// 0025_cout_reel_direction_only.sql). Vérifié ici côté serveur via
// profiles.role, pas seulement caché côté écran : "mes employés ne
// doivent jamais voir les bénéfices" (demande de Mélanie, 2026-10-19).
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "direction") {
    return Response.json({ error: "Réservé à la Direction." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const reservationId = searchParams.get("reservation_id");
  if (!reservationId) {
    return Response.json({ error: "reservation_id manquant." }, { status: 400 });
  }

  const { data: reservation } = await admin
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();
  if (!reservation) {
    return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  }

  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("id", (reservation as Reservation).client_id)
    .single();
  if (!client) {
    return Response.json({ error: "Client introuvable." }, { status: 404 });
  }

  // getEurParEgp (appelé par coutPrestataireEstimeEnEuros) lit/écrit le
  // cache fx_rates_egp_eur avec le client serveur courant (session de
  // l'utilisateur, pas le rôle admin) — table ouverte à toute l'équipe
  // (voir migration 0157), donc pas besoin du client admin ici.
  const estimation = await coutPrestataireEstimeEnEuros(supabase, reservation as Reservation, client as Client);
  if (!estimation) {
    return Response.json({ estimation: null });
  }
  return Response.json({ estimation });
}
