import { createAdminClient } from "@/lib/supabase/admin";
import { coutPrestataireEstimeEnEuros } from "@/lib/coutPrestataire";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { Client, Reservation } from "@/lib/types";

// Remplit automatiquement "Coût réel" (reservation_couts, source="estime")
// pour toute nouvelle réservation qui n'en a pas encore — sans ce job,
// reservation_couts reste vide dès qu'une activité est ajoutée (constaté le
// 2026-10-28 : les tarifs prestataires avaient été donnés le 19/10 mais
// rien n'appliquait jamais l'estimation à grande échelle, seulement un
// bouton "Suggérer" cliqué réservation par réservation). Ne touche jamais
// une ligne déjà présente (estimée ou confirmée à la main) — un cron
// n'écrase jamais une correction humaine.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // Dernières 48h plutôt que tout l'historique — le backfill initial
  // (2026-10-28) a déjà traité l'existant, ce job ne couvre que le flux
  // courant. Une marge de 48h (pas 24h) pour couvrir une activité ajoutée
  // tard après le dernier passage du cron.
  const depuis = new Date(Date.now() - 48 * 3600000).toISOString();

  const [{ data: reservations }, { data: existingCouts }] = await Promise.all([
    admin.from("reservations").select("*").neq("statut_resa", "Annulée").gte("created_at", depuis),
    fetchAllRows<{ reservation_id: string }>(admin, "reservation_couts", "reservation_id", "reservation_id", true),
  ]);

  const existingIds = new Set(existingCouts.map((c) => c.reservation_id));
  const aTraiter = ((reservations as Reservation[]) || []).filter((r) => !existingIds.has(r.id));

  if (aTraiter.length === 0) {
    return Response.json({ traitees: 0, estimees: 0, nonReconnues: 0 });
  }

  const clientIds = [...new Set(aTraiter.map((r) => r.client_id))];
  const { data: clients } = await admin.from("clients").select("*").in("id", clientIds);
  const clientById = new Map(((clients as Client[]) || []).map((c) => [c.id, c]));

  let estimees = 0;
  let nonReconnues = 0;
  let erreurs = 0;

  for (const r of aTraiter) {
    const client = clientById.get(r.client_id);
    if (!client) continue;
    try {
      const estimation = await coutPrestataireEstimeEnEuros(admin, r, client);
      if (!estimation) {
        nonReconnues++;
        continue;
      }
      const { error } = await admin
        .from("reservation_couts")
        .insert({ reservation_id: r.id, cout_reel: estimation.montantEur, source: "estime" });
      if (error) erreurs++;
      else estimees++;
    } catch {
      erreurs++;
    }
  }

  return Response.json({ traitees: aTraiter.length, estimees, nonReconnues, erreurs });
}
