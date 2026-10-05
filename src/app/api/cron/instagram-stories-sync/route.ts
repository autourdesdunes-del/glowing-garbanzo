import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActiveStories, fetchStoryInsights } from "@/lib/instagramApi";

// Tourne toutes les 4h (voir vercel.json) : les stories Instagram ne sont
// accessibles via l'API que pendant leurs ~24h de vie, donc c'est la seule
// façon de garder un historique — chaque passage capture les stats
// actuelles de chaque story encore active, en écrasant la capture
// précédente (upsert sur ig_story_id) pour garder la plus à jour avant
// qu'elle disparaisse.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const stories = await fetchActiveStories();

  let syncedCount = 0;
  for (const story of stories) {
    const insights = await fetchStoryInsights(story.id);
    await admin.from("instagram_stories").upsert(
      {
        ig_story_id: story.id,
        media_type: story.media_type ?? null,
        permalink: story.permalink ?? null,
        posted_at: story.timestamp,
        reach: insights?.reach ?? null,
        replies: insights?.replies ?? null,
        navigation: insights?.navigation ?? null,
        total_interactions: insights?.total_interactions ?? null,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "ig_story_id" }
    );
    syncedCount++;
  }

  return Response.json({ ok: true, activeStories: stories.length, synced: syncedCount });
}
