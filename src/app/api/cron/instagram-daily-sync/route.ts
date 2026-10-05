import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAccountInfo,
  fetchAccountDailyReach,
  fetchRecentMedia,
  fetchMediaInsights,
} from "@/lib/instagramApi";

// Tourne une fois par jour : capture le nombre d'abonnés du jour, la
// couverture (reach) des 7 derniers jours (Meta met parfois à jour un jour
// déjà passé, d'où le re-fetch systématique plutôt qu'un seul "hier"), et
// rafraîchit les stats des publications récentes. Les publications de plus
// de 14 jours ne sont pas re-synchronisées à chaque run (leur engagement a
// fini de bouger) — seules les nouvelles et les récentes le sont, pour
// rester sous la limite de requêtes de l'API.
const RECENT_MEDIA_REFRESH_DAYS = 14;
const MEDIA_PAGE_SIZE = 25;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const account = await fetchAccountInfo();
  if (account) {
    await admin
      .from("instagram_account_daily")
      .upsert({ date: today, followers_count: account.followers_count, synced_at: new Date().toISOString() }, { onConflict: "date" });
  }

  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const dailyReach = await fetchAccountDailyReach(since, today);
  for (const row of dailyReach) {
    await admin
      .from("instagram_account_daily")
      .upsert({ date: row.date, reach: row.reach, synced_at: new Date().toISOString() }, { onConflict: "date" });
  }

  // Quels médias a-t-on déjà en base, et depuis quand ? Sert à savoir
  // lesquels sont "récents" (à rafraîchir) sans refaire un appel insights
  // par média existant à chaque run.
  const { data: existingMedia } = await admin
    .from("instagram_media")
    .select("ig_media_id, posted_at");
  const existingByI = new Map((existingMedia ?? []).map((m) => [m.ig_media_id, m.posted_at as string]));
  const refreshCutoff = Date.now() - RECENT_MEDIA_REFRESH_DAYS * 86400000;

  let after: string | undefined;
  let syncedCount = 0;
  let stopPaging = false;

  while (!stopPaging) {
    const { items, nextCursor } = await fetchRecentMedia(MEDIA_PAGE_SIZE, after);
    if (items.length === 0) break;

    for (const item of items) {
      const postedAtMs = new Date(item.timestamp).getTime();
      const known = existingByI.get(item.id);
      const isNew = !known;
      const isRecent = postedAtMs >= refreshCutoff;

      // Dès qu'on retombe sur un média déjà connu ET trop vieux pour être
      // rafraîchi, tout ce qui suit (plus ancien, car l'API renvoie du plus
      // récent au plus ancien) l'est aussi : on arrête la pagination.
      if (!isNew && !isRecent) {
        stopPaging = true;
        break;
      }

      const insights = await fetchMediaInsights(item.id, item.media_product_type);
      await admin.from("instagram_media").upsert(
        {
          ig_media_id: item.id,
          media_type: item.media_type,
          media_product_type: item.media_product_type ?? null,
          caption: item.caption ?? null,
          permalink: item.permalink ?? null,
          thumbnail_url: item.thumbnail_url ?? null,
          posted_at: item.timestamp,
          reach: insights?.reach ?? null,
          likes: insights?.likes ?? null,
          comments: insights?.comments ?? null,
          shares: insights?.shares ?? null,
          saved: insights?.saved ?? null,
          views: insights?.views ?? null,
          total_interactions: insights?.total_interactions ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "ig_media_id" }
      );
      syncedCount++;
    }

    if (stopPaging || !nextCursor) break;
    after = nextCursor;
  }

  return Response.json({ ok: true, followers: account?.followers_count ?? null, dailyReachRows: dailyReach.length, mediaSynced: syncedCount });
}
