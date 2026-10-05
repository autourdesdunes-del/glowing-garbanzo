"use client";

// Digital marketing (Direction) — statistiques Instagram réelles, branchées
// sur les tables instagram_account_daily / instagram_media / instagram_stories
// alimentées par les crons instagram-daily-sync (quotidien) et
// instagram-stories-sync (toutes les 4h, avant expiration des stories).
// Reprend la mise en page validée par Mélanie dans l'artifact "Digital
// Marketing" (2026-10-05) — mêmes sections, mais avec les vraies données.

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkline } from "@/components/direction/DashboardWidgets";
import type { Client } from "@/lib/types";

type AccountDailyRow = { date: string; followers_count: number | null; reach: number | null };
type MediaRow = {
  id: string;
  ig_media_id: string;
  media_type: string;
  media_product_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  posted_at: string;
  theme: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  views: number | null;
  total_interactions: number | null;
};
type StoryRow = {
  id: string;
  ig_story_id: string;
  permalink: string | null;
  posted_at: string;
  reach: number | null;
  replies: number | null;
  navigation: number | null;
  total_interactions: number | null;
};

function fmtNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")} K`;
  return String(n);
}
function fmtPct(n: number): string {
  return `${n.toFixed(1).replace(".", ",")} %`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function engagementRate(m: MediaRow): number | null {
  if (!m.reach) return null;
  return ((m.likes ?? 0) + (m.comments ?? 0)) / m.reach;
}
function saveRate(m: MediaRow): number | null {
  if (!m.reach) return null;
  return (m.saved ?? 0) / m.reach;
}
function formatLabel(type: string | null): string {
  if (type === "REELS") return "Reel";
  if (type === "CAROUSEL_ALBUM") return "Carrousel";
  return "Post";
}

// Pills pour les thématiques déjà utilisées (reproposées) + un champ libre
// pour en taper une nouvelle, qui réapparaît ensuite comme suggestion
// puisque usedThemes est recalculé à partir de ce qui est déjà en base.
function ThemePicker({ suggestions, onPick }: { suggestions: string[]; onPick: (theme: string) => void }) {
  const [custom, setCustom] = useState("");
  function submitCustom() {
    const trimmed = custom.trim();
    if (!trimmed) return;
    onPick(trimmed);
    setCustom("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {suggestions.map((theme) => (
        <button
          key={theme}
          onClick={() => onPick(theme)}
          className="rounded-full border border-[#eaeaea] bg-white px-2.5 py-1 text-[11px] text-neutral-500 hover:border-[#0F5C56] hover:text-[#0F5C56]"
        >
          {theme}
        </button>
      ))}
      <input
        type="text"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submitCustom();
        }}
        placeholder="+ nouvelle thématique…"
        className="w-40 rounded-full border border-dashed border-[#eaeaea] bg-white px-2.5 py-1 text-[11px] text-neutral-600 placeholder:text-neutral-400 focus:border-[#0F5C56] focus:outline-none"
      />
      {custom.trim() && (
        <button
          onClick={submitCustom}
          className="rounded-full bg-[#0F5C56] px-2.5 py-1 text-[11px] font-semibold text-white"
        >
          Ajouter
        </button>
      )}
    </div>
  );
}

export default function MarketingView({ clients }: { clients: Client[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<AccountDailyRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [followersNow, setFollowersNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dailyRes, mediaRes, storiesRes] = await Promise.all([
        supabase.from("instagram_account_daily").select("date, followers_count, reach").order("date", { ascending: true }).limit(60),
        supabase
          .from("instagram_media")
          .select(
            "id, ig_media_id, media_type, media_product_type, caption, permalink, thumbnail_url, posted_at, theme, reach, likes, comments, shares, saved, views, total_interactions"
          )
          .order("posted_at", { ascending: false })
          .limit(200),
        supabase
          .from("instagram_stories")
          .select("id, ig_story_id, permalink, posted_at, reach, replies, navigation, total_interactions")
          .order("posted_at", { ascending: false })
          .limit(100),
      ]);
      if (cancelled) return;
      const dailyRows = (dailyRes.data ?? []) as AccountDailyRow[];
      setDaily(dailyRows);
      setMedia((mediaRes.data ?? []) as MediaRow[]);
      setStories((storiesRes.data ?? []) as StoryRow[]);
      const lastWithFollowers = [...dailyRows].reverse().find((d) => d.followers_count != null);
      setFollowersNow(lastWithFollowers?.followers_count ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function setTheme(mediaId: string, theme: string) {
    setMedia((prev) => prev.map((m) => (m.id === mediaId ? { ...m, theme } : m)));
    await supabase.from("instagram_media").update({ theme }).eq("id", mediaId);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-8 text-sm text-neutral-400">Chargement des statistiques Instagram…</div>
    );
  }

  const noData = daily.length === 0 && media.length === 0;

  const last30 = daily.slice(-30);
  const followers30dAgo = last30[0]?.followers_count ?? null;
  const followersDelta = followersNow != null && followers30dAgo != null ? followersNow - followers30dAgo : null;
  const followerSeries = last30.map((d) => d.followers_count ?? 0).filter((v) => v > 0);

  const media30 = media.filter((m) => Date.now() - new Date(m.posted_at).getTime() <= 30 * 86400000);
  const reach30 = last30.reduce((s, d) => s + (d.reach ?? 0), 0);
  const views30 = media30.reduce((s, m) => s + (m.views ?? 0), 0);
  const engagementValues = media30.map(engagementRate).filter((v): v is number => v != null);
  const avgEngagement = engagementValues.length ? engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length : null;
  const saveValues = media30.map(saveRate).filter((v): v is number => v != null);
  const avgSaveRate = saveValues.length ? saveValues.reduce((a, b) => a + b, 0) / saveValues.length : null;

  const topContenus = [...media]
    .map((m) => ({ m, rate: saveRate(m) }))
    .filter((x) => x.rate != null)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, 8);

  // Les thématiques ne sont pas une liste fixe : ce sont celles que
  // l'équipe a déjà tapées une fois sur une publication (voir ThemePicker
  // plus bas), qu'on représente ensuite comme suggestions.
  const usedThemes = Array.from(new Set(media.map((m) => m.theme).filter((t): t is string => !!t))).sort((a, b) =>
    a.localeCompare(b, "fr")
  );

  const themeStats = usedThemes.map((theme) => {
    const items = media.filter((m) => m.theme === theme);
    const rates = items.map(saveRate).filter((v): v is number => v != null);
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    return { theme, avg, count: items.length };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  const maxThemeRate = Math.max(...themeStats.map((t) => t.avg ?? 0), 0.0001);

  const untaggedMedia = media.filter((m) => !m.theme).slice(0, 10);

  const stories7 = stories.filter((s) => Date.now() - new Date(s.posted_at).getTime() <= 7 * 86400000);
  const storiesReach = stories7.map((s) => s.reach).filter((v): v is number => v != null);
  const avgStoryReach = storiesReach.length ? Math.round(storiesReach.reduce((a, b) => a + b, 0) / storiesReach.length) : null;
  const totalReplies = stories7.reduce((s, st) => s + (st.replies ?? 0), 0);
  const bestStory = [...stories7].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];

  const byFormat: Record<string, MediaRow[]> = {};
  for (const m of media) {
    const key = m.media_product_type === "REELS" ? "REELS" : m.media_product_type === "CAROUSEL_ALBUM" ? "CAROUSEL_ALBUM" : "FEED";
    (byFormat[key] ??= []).push(m);
  }
  const formatStats = (["REELS", "CAROUSEL_ALBUM", "FEED"] as const).map((key) => {
    const items = byFormat[key] ?? [];
    const rates = items.map(engagementRate).filter((v): v is number => v != null);
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    return { key, label: key === "REELS" ? "Reels" : key === "CAROUSEL_ALBUM" ? "Carrousels" : "Posts simples", avg, count: items.length };
  });

  // Heatmap jour/heure — heure UTC du champ posted_at (Meta ne renvoie pas
  // de fuseau par compte ; l'Égypte est UTC+2/+3 selon la saison, écart
  // volontairement ignoré ici, l'intérêt est la tendance relative).
  const HOUR_BUCKETS = [6, 12, 17, 21];
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const heat: Record<string, number[]> = {};
  for (const m of media) {
    const d = new Date(m.posted_at);
    const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
    const hour = d.getUTCHours();
    const bucketIdx = HOUR_BUCKETS.findIndex((h, i) => hour < (HOUR_BUCKETS[i + 1] ?? 24)) ;
    const rate = engagementRate(m);
    if (rate == null) continue;
    const key = `${dow}-${bucketIdx}`;
    (heat[key] ??= []).push(rate);
  }
  const heatMax = Math.max(0.0001, ...Object.values(heat).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length));

  // Lien (approximatif) publications / nouveaux prospects : nombre de
  // nouveaux clients créés par jour sur les 14 derniers jours, superposé
  // aux jours de publication.
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const prospectsByDay = new Map<string, number>();
  for (const c of clients) {
    if (!c.created_at) continue;
    const day = c.created_at.slice(0, 10);
    if (!last14Days.includes(day)) continue;
    prospectsByDay.set(day, (prospectsByDay.get(day) ?? 0) + 1);
  }
  const postDays = new Set(media.filter((m) => last14Days.includes(m.posted_at.slice(0, 10))).map((m) => m.posted_at.slice(0, 10)));
  const maxProspectsDay = Math.max(1, ...last14Days.map((d) => prospectsByDay.get(d) ?? 0));

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Digital marketing</h1>
        <p className="mt-1 text-sm text-[#666666]">Statistiques Instagram — @autourdesduneshurghada</p>
      </div>

      {noData ? (
        <div className="rounded-[6px] border border-[#eaeaea] bg-white p-6 text-sm text-neutral-500">
          Pas encore de données synchronisées. Le premier passage du cron quotidien (6h du matin) remplira cette page —
          revenez un peu plus tard, ou demandez à Claude de déclencher une synchronisation manuelle.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-[#eaeaea] bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 flex-shrink-0 rounded-full bg-gradient-to-br from-[#C9973E] to-[#8B4531]" />
              <div>
                <div className="font-heading text-[16px] text-[#5C2A1D]">Autour des Dunes</div>
                <div className="text-xs text-neutral-400">@autourdesduneshurghada · compte professionnel</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-amounts text-2xl font-bold text-[#5C2A1D]">
                {followersNow != null ? followersNow.toLocaleString("fr-FR") : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-400">Abonnés</div>
              {followersDelta != null && (
                <div className={`text-xs font-semibold ${followersDelta >= 0 ? "text-[#0F5C56]" : "text-red-600"}`}>
                  {followersDelta >= 0 ? "+" : ""}
                  {followersDelta} (30 derniers jours)
                </div>
              )}
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">Vue d&apos;ensemble</h2>
              <span className="text-xs text-neutral-400">30 derniers jours</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Portée totale</p>
                <p className="font-amounts mt-1 text-xl font-bold text-[#5C2A1D]">{reach30 ? fmtNumber(reach30) : "—"}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">comptes touchés</p>
              </div>
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Vues (reels)</p>
                <p className="font-amounts mt-1 text-xl font-bold text-[#5C2A1D]">{views30 ? fmtNumber(views30) : "—"}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">lectures totales</p>
              </div>
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Engagement moyen</p>
                <p className="font-amounts mt-1 text-xl font-bold text-[#5C2A1D]">{avgEngagement != null ? fmtPct(avgEngagement * 100) : "—"}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">likes+comm. / portée</p>
              </div>
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Taux d&apos;enregistrement</p>
                <p className="font-amounts mt-1 text-xl font-bold text-[#5C2A1D]">{avgSaveRate != null ? fmtPct(avgSaveRate * 100) : "—"}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">saves / portée — signal le plus fiable</p>
              </div>
            </div>
            {followerSeries.length >= 2 && (
              <div className="mt-3 rounded-[6px] border border-[#eaeaea] bg-white p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Évolution des abonnés</p>
                <Sparkline values={followerSeries} />
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">Contenus qui marchent le mieux</h2>
              <span className="text-xs text-neutral-400">classé par taux d&apos;enregistrement</span>
            </div>
            {topContenus.length === 0 ? (
              <p className="text-sm text-neutral-400">Pas encore assez de publications synchronisées.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {topContenus.map(({ m, rate }) => (
                  <a
                    key={m.id}
                    href={m.permalink ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white"
                  >
                    <div className="relative h-32 bg-[#f6f0e4]">
                      {m.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        {formatLabel(m.media_product_type)}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-semibold text-[#171717]">{m.caption?.split("\n")[0] || "(sans légende)"}</p>
                      {m.theme && (
                        <span className="mt-1.5 inline-block rounded-full bg-[#E4EFE9] px-2 py-0.5 text-[10px] font-semibold text-[#0F5C56]">
                          {m.theme}
                        </span>
                      )}
                      <p className="font-amounts mt-1 text-[10.5px] text-neutral-400">{fmtDate(m.posted_at)}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                        <span>
                          Portée <b className="font-amounts text-[#171717]">{fmtNumber(m.reach ?? 0)}</b>
                        </span>
                        <span>
                          ❤️ <b className="font-amounts text-[#171717]">{m.likes ?? 0}</b>
                        </span>
                        <span className="font-semibold text-[#0F5C56]">💾 {rate != null ? fmtPct(rate * 100) : "—"}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">Thématiques les plus performantes</h2>
              <span className="text-xs text-neutral-400">taux d&apos;enregistrement moyen par thème</span>
            </div>
            {themeStats.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucune publication taguée pour l&apos;instant — voir la saisie ci-dessous.</p>
            ) : (
              <div className="space-y-2.5">
                {themeStats.map((t) => (
                  <div key={t.theme} className="grid grid-cols-[150px_1fr_60px] items-center gap-3">
                    <span className="text-sm font-semibold text-[#171717]">{t.theme}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#eee]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#C9973E] to-[#0F5C56]"
                        style={{ width: `${((t.avg ?? 0) / maxThemeRate) * 100}%` }}
                      />
                    </div>
                    <span className="font-amounts text-right text-xs text-neutral-500">{t.avg != null ? fmtPct(t.avg * 100) : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">Stories</h2>
              <span className="text-xs text-neutral-400">7 derniers jours — capturées avant expiration (24h)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-3">
                <p className="text-[11px] text-neutral-400">Stories publiées</p>
                <p className="font-amounts mt-0.5 text-lg font-bold text-[#5C2A1D]">{stories7.length}</p>
              </div>
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-3">
                <p className="text-[11px] text-neutral-400">Portée moyenne</p>
                <p className="font-amounts mt-0.5 text-lg font-bold text-[#5C2A1D]">{avgStoryReach ?? "—"}</p>
              </div>
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-3">
                <p className="text-[11px] text-neutral-400">Réponses reçues</p>
                <p className="font-amounts mt-0.5 text-lg font-bold text-[#5C2A1D]">{totalReplies}</p>
              </div>
              <div className="rounded-[6px] border border-[#eaeaea] bg-white p-3">
                <p className="text-[11px] text-neutral-400">Meilleure story</p>
                <p className="font-amounts mt-0.5 text-sm font-bold text-[#5C2A1D]">
                  {bestStory ? fmtNumber(bestStory.reach ?? 0) + " portée" : "—"}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">Format : post vs reel vs carrousel</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {formatStats.map((f) => (
                <div key={f.key} className="rounded-[6px] border border-[#eaeaea] bg-white p-4 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{f.label}</div>
                  <div className="font-amounts mt-1.5 text-xl font-bold text-[#5C2A1D]">{f.avg != null ? fmtPct(f.avg * 100) : "—"}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-400">engagement moyen · {f.count} publication(s)</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-heading mb-1 text-lg font-semibold text-[#171717]">Meilleurs horaires de publication</h2>
            <p className="mb-3 text-xs text-neutral-400">Intensité de l&apos;engagement selon le jour et la tranche horaire de publication.</p>
            <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-1">
              <div />
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-neutral-400">
                  {d}
                </div>
              ))}
              {HOUR_BUCKETS.map((h, hi) => (
                <Fragment key={`h-${h}`}>
                  <div className="self-center pr-1 text-right text-[10px] text-neutral-400">{h}h</div>
                  {DAYS.map((_, di) => {
                    const arr = heat[`${di}-${hi}`];
                    const avg = arr ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
                    const intensity = avg / heatMax;
                    return (
                      <div
                        key={`${di}-${hi}`}
                        className="aspect-[1.6/1] rounded-sm"
                        style={{ background: arr ? `rgba(15,92,86,${0.12 + intensity * 0.8})` : "#f0ece0" }}
                        title={arr ? fmtPct(avg * 100) : "pas de publication"}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">Lien avec les nouveaux prospects</h2>
            <div className="mb-3 rounded-md bg-[#F5E4D9] px-4 py-2.5 text-xs text-[#A6401E]">
              ⚠ Approximation uniquement — Instagram ne dit jamais &quot;ce prospect vient de ce post précis&quot;. Superpose les
              dates de publication aux nouveaux clients créés dans le CRM, sans lien de causalité certain.
            </div>
            <div className="flex h-32 items-end gap-1.5 border-b border-[#eaeaea] pb-1">
              {last14Days.map((day) => {
                const count = prospectsByDay.get(day) ?? 0;
                const hasPost = postDays.has(day);
                return (
                  <div key={day} className="relative flex-1">
                    <div
                      className={`rounded-t ${hasPost ? "bg-[#C9973E]" : "bg-[#eee]"}`}
                      style={{ height: `${Math.max(4, (count / maxProspectsDay) * 100)}px` }}
                      title={`${day} — ${count} nouveau(x) prospect(s)`}
                    />
                    {hasPost && <div className="absolute -bottom-2.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#0F5C56]" />}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-neutral-400">● = jour de publication · barres dorées = jour où une publication est sortie</p>
          </section>

          {untaggedMedia.length > 0 && (
            <section>
              <h2 className="font-heading mb-1 text-lg font-semibold text-[#171717]">Publications à taguer</h2>
              <p className="mb-3 text-xs text-neutral-400">
                Instagram ne connaît pas vos thématiques — attribuez-en une à chaque publication pour alimenter le classement
                ci-dessus.
              </p>
              <div className="space-y-3">
                {untaggedMedia.map((m) => (
                  <div key={m.id} className="rounded-[6px] border border-dashed border-[#eaeaea] bg-[#fbf9f4] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#171717]">{m.caption?.split("\n")[0] || "(sans légende)"}</p>
                    <ThemePicker suggestions={usedThemes} onPick={(theme) => setTheme(m.id, theme)} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
