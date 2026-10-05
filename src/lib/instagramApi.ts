// Appels sortants vers l'API Graph (Instagram Business, via l'app Meta
// "Autour des Dunes CRM" — token lié à la Page "Autour des dunes Hurghada").
// Utilisé uniquement depuis les crons instagram-daily-sync et
// instagram-stories-sync, jamais en direct depuis le navigateur (le token
// est un secret serveur).
//
// Les noms de métriques valides par type de contenu viennent d'appels de
// test réels faits le 2026-10-05 (pas de la documentation) : "plays" a par
// exemple été remplacé par "views" dans une version récente de l'API, et
// "instagram_manage_insights" doit être explicitement ajouté à l'app sur
// la page Autorisations et fonctionnalités avant de fonctionner (il n'est
// plus proposé par défaut dans les groupes de permissions "Content"/
// "Messaging" de l'assistant Facebook Login).

const GRAPH_VERSION = "v26.0";

function graphBase(): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}`;
}

async function igFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${graphBase()}${path}?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    console.error(`[instagramApi] ${path} -> ${res.status}: ${body}`);
    return null;
  }
  return res.json();
}

export type InstagramAccountInfo = {
  id: string;
  username: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
};

export async function fetchAccountInfo(): Promise<InstagramAccountInfo | null> {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  if (!igId) return null;
  return igFetch<InstagramAccountInfo>(`/${igId}`, {
    fields: "id,username,followers_count,follows_count,media_count",
  });
}

// Couverture quotidienne du compte sur les N derniers jours (metric_type
// time_series — une valeur par jour). Les jours trop récents (aujourd'hui)
// sont souvent incomplets côté Meta, mais on les récupère quand même : le
// cron tourne tous les jours et réécrit (upsert) la même ligne tant que le
// jour n'est pas figé.
export async function fetchAccountDailyReach(since: string, until: string): Promise<{ date: string; reach: number }[]> {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  if (!igId) return [];
  const result = await igFetch<{ data: { values: { value: number; end_time: string }[] }[] }>(
    `/${igId}/insights`,
    { metric: "reach", period: "day", metric_type: "time_series", since, until }
  );
  const values = result?.data?.[0]?.values ?? [];
  return values.map((v) => ({ date: v.end_time.slice(0, 10), reach: v.value }));
}

export type InstagramMediaRaw = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
};

// Pagine via `after` (curseur retourné par l'appel précédent) plutôt que
// de suivre `paging.next` tel quel, pour ne jamais perdre le token d'accès
// qu'un `next` déjà expiré pourrait contenir en cache.
export async function fetchRecentMedia(limit: number, after?: string): Promise<{ items: InstagramMediaRaw[]; nextCursor: string | null }> {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  if (!igId) return { items: [], nextCursor: null };
  const params: Record<string, string> = {
    fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp",
    limit: String(limit),
  };
  if (after) params.after = after;
  const result = await igFetch<{ data: InstagramMediaRaw[]; paging?: { cursors?: { after?: string } } }>(
    `/${igId}/media`,
    params
  );
  return {
    items: result?.data ?? [],
    nextCursor: result?.paging?.cursors?.after ?? null,
  };
}

export type InstagramMediaInsights = {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  views: number | null;
  total_interactions: number | null;
};

const REELS_METRICS = "reach,likes,comments,shares,saved,views,total_interactions";
const FEED_METRICS = "reach,likes,comments,shares,saved,total_interactions";

export async function fetchMediaInsights(mediaId: string, mediaProductType: string | undefined): Promise<InstagramMediaInsights | null> {
  const metrics = mediaProductType === "REELS" ? REELS_METRICS : FEED_METRICS;
  const result = await igFetch<{ data: { name: string; values: { value: number }[] }[] }>(
    `/${mediaId}/insights`,
    { metric: metrics }
  );
  if (!result?.data) return null;
  const byName = new Map(result.data.map((m) => [m.name, m.values?.[0]?.value ?? null]));
  return {
    reach: byName.get("reach") ?? null,
    likes: byName.get("likes") ?? null,
    comments: byName.get("comments") ?? null,
    shares: byName.get("shares") ?? null,
    saved: byName.get("saved") ?? null,
    views: byName.get("views") ?? null,
    total_interactions: byName.get("total_interactions") ?? null,
  };
}

export type InstagramStoryRaw = {
  id: string;
  media_type?: string;
  permalink?: string;
  timestamp: string;
};

// Stories actives uniquement — l'API ne retourne plus rien pour une story
// passée 24h, c'est pour ça qu'on les capture régulièrement avant
// expiration (voir commentaire en tête du fichier de migration).
export async function fetchActiveStories(): Promise<InstagramStoryRaw[]> {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  if (!igId) return [];
  const result = await igFetch<{ data: InstagramStoryRaw[] }>(`/${igId}/stories`, {
    fields: "id,media_type,permalink,timestamp",
  });
  return result?.data ?? [];
}

export type InstagramStoryInsights = {
  reach: number | null;
  replies: number | null;
  navigation: number | null;
  total_interactions: number | null;
};

export async function fetchStoryInsights(storyId: string): Promise<InstagramStoryInsights | null> {
  const result = await igFetch<{ data: { name: string; values: { value: number }[] }[] }>(
    `/${storyId}/insights`,
    { metric: "reach,replies,navigation,total_interactions" }
  );
  if (!result?.data) return null;
  const byName = new Map(result.data.map((m) => [m.name, m.values?.[0]?.value ?? null]));
  return {
    reach: byName.get("reach") ?? null,
    replies: byName.get("replies") ?? null,
    navigation: byName.get("navigation") ?? null,
    total_interactions: byName.get("total_interactions") ?? null,
  };
}
