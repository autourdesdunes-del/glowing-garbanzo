import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resaTotalMontant } from "@/lib/resa";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";

// Classement (par bénéfice) des activités et des plus gros clients — sans
// jamais renvoyer le moindre montant de coût/marge au navigateur. La marge
// (reservation_couts) est réservée à la Direction en base (RLS, voir
// migration 0025_cout_reel_direction_only.sql) : ce calcul tourne donc
// côté serveur avec le rôle admin, et ne renvoie que l'ORDRE des noms —
// jamais les chiffres qui ont servi à les classer. C'est ce qui permet à
// Sylvie (compte équipe) de voir "qui/quoi est le plus rentable" sans
// jamais voir combien.
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const admin = createAdminClient();
  const [
    { data: reservations },
    { data: clients },
    { data: options },
    { data: tarifs },
    { data: couts },
    { data: catalogue },
  ] = await Promise.all([
    admin.from("reservations").select("*").neq("statut_resa", "Annulée"),
    admin.from("clients").select("*"),
    admin.from("reservation_options").select("*"),
    admin.from("reservation_tarifs").select("*"),
    admin.from("reservation_couts").select("*"),
    admin.from("catalogue_activites").select("id, nom"),
  ]);

  const clientsById = new Map((clients as Client[] | null)?.map((c) => [c.id, c]) ?? []);
  const optionsByResa = new Map<string, ReservationOption[]>();
  ((options as ReservationOption[]) || []).forEach((o) => {
    optionsByResa.set(o.reservation_id, [...(optionsByResa.get(o.reservation_id) || []), o]);
  });
  const tarifsByResa = new Map<string, ReservationTarif[]>();
  ((tarifs as ReservationTarif[]) || []).forEach((t) => {
    tarifsByResa.set(t.reservation_id, [...(tarifsByResa.get(t.reservation_id) || []), t]);
  });
  const coutByResa = new Map<string, number>(
    ((couts as { reservation_id: string; cout_reel: number }[]) || []).map((c) => [
      c.reservation_id,
      Number(c.cout_reel) || 0,
    ])
  );
  const catalogueById = new Map(((catalogue as { id: string; nom: string }[]) || []).map((c) => [c.id, c.nom]));

  const margeParActivite = new Map<string, number>();
  const margeParClient = new Map<string, number>();

  ((reservations as Reservation[]) || []).forEach((r) => {
    const client = clientsById.get(r.client_id);
    if (!client) return;
    const total = resaTotalMontant(r, client, optionsByResa.get(r.id) || [], tarifsByResa.get(r.id) || []);
    const cout = coutByResa.get(r.id) || 0;
    const marge = total - cout;

    const nomActivite = (r.catalogue_item_id && catalogueById.get(r.catalogue_item_id)) || r.nom_activite || "Sans nom";
    margeParActivite.set(nomActivite, (margeParActivite.get(nomActivite) || 0) + marge);

    const nomClient = client.nom || "Sans nom";
    margeParClient.set(nomClient, (margeParClient.get(nomClient) || 0) + marge);
  });

  const topActivites = Array.from(margeParActivite.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nom]) => nom);
  const topClients = Array.from(margeParClient.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nom]) => nom);

  return Response.json({ activites: topActivites, clients: topClients });
}
