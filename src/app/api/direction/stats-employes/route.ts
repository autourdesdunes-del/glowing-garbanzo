import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resaTotalMontant } from "@/lib/resa";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";

// Stat employés (Direction > Statistiques) — demande de Mélanie, 2026-10-28 :
// comparer Sylvie et Justine (jamais Laura, qui ne rédige que ponctuellement
// des programmes — pas un rôle comparable). Fenêtre fixe depuis le 20/09,
// comme Stat agences. Réservé à la Direction, comme les autres routes
// /api/direction/*. Le CA/marge vient de reservation_couts, réservé à la
// Direction en base (RLS) — lu ici côté serveur avec le rôle admin.
const WINDOW_START = "2026-09-20T00:00:00Z"; // proche de l'heure d'Égypte, cohérent avec Stat agences
const EMPLOYEES = ["Sylvie", "Justine"];

export async function GET() {
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

  const { data: profiles } = await admin.from("profiles").select("id, prenom, email").in("prenom", EMPLOYEES);
  const emailByPrenom = new Map((profiles || []).map((p) => [p.prenom, p.email]));
  const idByPrenom = new Map((profiles || []).map((p) => [p.prenom, p.id]));

  const [
    { data: reservations },
    { data: clients },
    { data: options },
    { data: tarifs },
    { data: couts },
    { data: verifications },
    { data: clientsAuRevoirAvis },
    { data: shifts },
    { data: relanceLogs },
  ] = await Promise.all([
    admin
      .from("reservations")
      .select("id, client_id, cree_par_nom, created_at, statut_resa")
      .in("cree_par_nom", EMPLOYEES)
      .gte("created_at", WINDOW_START),
    admin.from("clients").select("id, statut"),
    admin.from("reservation_options").select("*"),
    admin.from("reservation_tarifs").select("*"),
    admin.from("reservation_couts").select("reservation_id, cout_reel"),
    admin.from("verifications").select("nom").in("nom", EMPLOYEES).gte("created_at", WINDOW_START),
    admin
      .from("clients")
      .select("au_revoir_envoye_par_nom, au_revoir_envoye_le, avis_envoye_par_nom, avis_envoye_le")
      .or(
        `and(au_revoir_envoye_par_nom.in.(${EMPLOYEES.join(",")}),au_revoir_envoye_le.gte.${WINDOW_START}),and(avis_envoye_par_nom.in.(${EMPLOYEES.join(",")}),avis_envoye_le.gte.${WINDOW_START})`
      ),
    admin.from("planning_shifts").select("user_id, date, statut").in("statut", ["travail", "superviseur"]).gte("date", WINDOW_START.slice(0, 10)),
    admin
      .from("activity_log")
      .select("actor_email, changes")
      .eq("table_name", "clients")
      .not("changes->dernier_contact_date", "is", null)
      .gte("created_at", WINDOW_START),
  ]);

  const clientById = new Map((clients as Pick<Client, "id" | "statut">[] | null)?.map((c) => [c.id, c]) ?? []);
  const optionsByResa = new Map<string, ReservationOption[]>();
  ((options as ReservationOption[]) || []).forEach((o) => {
    optionsByResa.set(o.reservation_id, [...(optionsByResa.get(o.reservation_id) || []), o]);
  });
  const tarifsByResa = new Map<string, ReservationTarif[]>();
  ((tarifs as ReservationTarif[]) || []).forEach((t) => {
    tarifsByResa.set(t.reservation_id, [...(tarifsByResa.get(t.reservation_id) || []), t]);
  });
  const coutByResa = new Map<string, number>(
    ((couts as { reservation_id: string; cout_reel: number }[]) || []).map((c) => [c.reservation_id, Number(c.cout_reel) || 0])
  );

  const stats = EMPLOYEES.map((prenom) => {
    const mesResas = ((reservations as (Reservation & { client_id: string; cree_par_nom: string })[]) || []).filter(
      (r) => r.cree_par_nom === prenom
    );

    let ca = 0;
    let marge = 0;
    let caConfirme = 0;
    let nResasConfirmees = 0;
    for (const r of mesResas) {
      const client = clientById.get(r.client_id);
      // Même règle que partout ailleurs dans le CRM (incident 2026-10-19/20) :
      // une activité validée sur un prospect ne doit jamais peser dans un
      // calcul de CA/marge, ni fausser le panier moyen.
      if (!client || client.statut !== "Client confirmé") continue;
      const total = resaTotalMontant(
        r as unknown as Reservation,
        client as unknown as Client,
        optionsByResa.get(r.id) || [],
        tarifsByResa.get(r.id) || []
      );
      const cout = coutByResa.get(r.id) || 0;
      ca += total;
      marge += total - cout;
      caConfirme += total;
      nResasConfirmees += 1;
    }

    const email = emailByPrenom.get(prenom);
    const userId = idByPrenom.get(prenom);
    const joursTravailles = new Set(
      ((shifts as { user_id: string; date: string }[]) || []).filter((s) => s.user_id === userId).map((s) => s.date)
    ).size;
    const nVerifications = ((verifications as { nom: string }[]) || []).filter((v) => v.nom === prenom).length;
    const nAuRevoir = ((clientsAuRevoirAvis as { au_revoir_envoye_par_nom: string }[]) || []).filter(
      (c) => c.au_revoir_envoye_par_nom === prenom
    ).length;
    const nAvis = ((clientsAuRevoirAvis as { avis_envoye_par_nom: string }[]) || []).filter(
      (c) => c.avis_envoye_par_nom === prenom
    ).length;
    const nRelances = ((relanceLogs as { actor_email: string }[]) || []).filter((l) => l.actor_email === email).length;

    return {
      prenom,
      reservations: mesResas.length,
      joursTravailles,
      moyenneParJour: joursTravailles > 0 ? Math.round((mesResas.length / joursTravailles) * 10) / 10 : null,
      ca: Math.round(ca * 100) / 100,
      marge: Math.round(marge * 100) / 100,
      panierMoyen: nResasConfirmees > 0 ? Math.round((caConfirme / nResasConfirmees) * 100) / 100 : null,
      verifications: nVerifications,
      auRevoirEnvoyes: nAuRevoir,
      avisDemandes: nAvis,
      relances: nRelances,
    };
  });

  return Response.json({ windowStart: WINDOW_START, employes: stats });
}
