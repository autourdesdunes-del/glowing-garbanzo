import { createAdminClient } from "@/lib/supabase/admin";
import { buildClientNotionProperties } from "@/lib/notionSync";
import { upsertNotionPage } from "@/lib/notionApi";
import { resaTotalMontant } from "@/lib/resa";
import type { Client, ClientHotel, HotelReference, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";

// Copie de secours automatique CRM -> Notion (Mélanie, 2026-09-20) : ce job
// tourne une fois par jour (limite du plan Vercel actuel — voir vercel.json,
// les autres crons Kommo sont logés sur le même principe) et repousse tout
// client modifié dans les dernières 26h (24h + marge pour absorber un run
// en retard) vers la base Notion "nouvel essai bdd client 1". Ne supprime
// jamais rien côté Notion (client annulé, etc.) — juste une photo à jour,
// pas un miroir parfait. Périmètre volontairement limité aux champs
// "client" (voir notionSync.ts) — pas les acomptes/billets d'avion/RDV
// paiement/bons de réservation, reliés à d'autres bases Notion.

export const maxDuration = 60;

// Notion tolère ~3 requêtes/seconde en moyenne — on reste loin en dessous
// plutôt que de risquer un 429 qui ferait échouer des pages en plein milieu
// du batch quotidien.
const DELAY_MS = 350;
const MAX_PAR_RUN = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_CLIENTS_DATABASE_ID) {
    return Response.json({ error: "Notion non configuré (NOTION_API_KEY / NOTION_CLIENTS_DATABASE_ID)" }, { status: 500 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

  const [{ data: clients, error: clientsError }, { data: hotelsRef }] = await Promise.all([
    admin
      .from("clients")
      .select("*")
      .gte("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(MAX_PAR_RUN),
    admin.from("hotels_reference").select("*"),
  ]);

  if (clientsError) {
    return Response.json({ error: clientsError.message }, { status: 500 });
  }
  if (!clients || clients.length === 0) {
    return Response.json({ pushed: 0, errors: [] });
  }

  const clientIds = clients.map((c) => c.id);
  const [{ data: allReservations }, { data: allClientHotels }] = await Promise.all([
    admin.from("reservations").select("*").in("client_id", clientIds),
    admin.from("client_hotels").select("*").in("client_id", clientIds),
  ]);

  const reservationIds = (allReservations ?? []).map((r) => r.id);
  const [{ data: allOptions }, { data: allTarifs }] =
    reservationIds.length > 0
      ? await Promise.all([
          admin.from("reservation_options").select("*").in("reservation_id", reservationIds),
          admin.from("reservation_tarifs").select("*").in("reservation_id", reservationIds),
        ])
      : [{ data: [] as ReservationOption[] }, { data: [] as ReservationTarif[] }];

  const errors: { client: string; error: string }[] = [];
  let pushed = 0;

  for (const client of clients as Client[]) {
    const clientReservations = (allReservations ?? []).filter(
      (r): r is Reservation => r.client_id === client.id
    );
    const clientHotels = (allClientHotels ?? []).filter(
      (h): h is ClientHotel => h.client_id === client.id
    );
    const totalSejour = clientReservations
      .filter((r) => r.statut_resa !== "Annulée")
      .reduce((sum, r) => {
        const options = (allOptions ?? []).filter((o) => o.reservation_id === r.id) as ReservationOption[];
        const tarifs = (allTarifs ?? []).filter((t) => t.reservation_id === r.id) as ReservationTarif[];
        return sum + resaTotalMontant(r, client, options, tarifs);
      }, 0);

    const properties = buildClientNotionProperties(
      client,
      clientReservations,
      (hotelsRef ?? []) as HotelReference[],
      clientHotels,
      totalSejour
    );

    const result = await upsertNotionPage(client.notion_page_id, properties);
    if (result.ok) {
      pushed += 1;
      if (result.pageId !== client.notion_page_id) {
        await admin
          .from("clients")
          .update({ notion_page_id: result.pageId, notion_synced_at: new Date().toISOString() })
          .eq("id", client.id);
      } else {
        await admin.from("clients").update({ notion_synced_at: new Date().toISOString() }).eq("id", client.id);
      }
    } else {
      errors.push({ client: client.nom, error: result.error });
    }

    await sleep(DELAY_MS);
  }

  return Response.json({ pushed, errors, total: clients.length });
}
