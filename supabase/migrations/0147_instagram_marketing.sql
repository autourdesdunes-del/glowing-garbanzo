-- Digital marketing (Direction) : statistiques Instagram du compte
-- "autourdesduneshurghada", synchronisées depuis l'API Graph (app Meta
-- "Autour des Dunes CRM") par deux crons — voir
-- src/app/api/cron/instagram-daily-sync et instagram-stories-sync.
-- Mockup validé par Mélanie le 2026-10-05 (artifact "Digital Marketing").

-- Une ligne par jour : couverture du compte + nombre d'abonnés à cette
-- date (permet le graphique de croissance et le sparkline de l'aperçu).
create table if not exists instagram_account_daily (
  date date primary key,
  followers_count integer,
  reach integer,
  synced_at timestamptz not null default now()
);

-- Une ligne par publication (post/reel/carrousel). "theme" est saisi à la
-- main par l'équipe (voir UI de tagging) — sert au classement par
-- thématique ; reste null tant que personne ne l'a taggée.
create table if not exists instagram_media (
  id uuid primary key default gen_random_uuid(),
  ig_media_id text not null unique,
  media_type text not null,
  media_product_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz not null,
  theme text,
  reach integer,
  likes integer,
  comments integer,
  shares integer,
  saved integer,
  views integer,
  total_interactions integer,
  synced_at timestamptz not null default now()
);

create index if not exists instagram_media_posted_at_idx on instagram_media (posted_at desc);

-- Une ligne par story, capturée pendant qu'elle est encore active (elle
-- disparaît de l'API Instagram ~24h après publication — d'où le cron
-- fréquent instagram-stories-sync). Une fois expirée, la ligne reste en
-- base avec ses dernières stats captées : c'est la seule façon de garder
-- un historique, l'API ne les réexpose plus après coup.
create table if not exists instagram_stories (
  id uuid primary key default gen_random_uuid(),
  ig_story_id text not null unique,
  media_type text,
  permalink text,
  posted_at timestamptz not null,
  reach integer,
  replies integer,
  navigation integer,
  total_interactions integer,
  captured_at timestamptz not null default now()
);

create index if not exists instagram_stories_posted_at_idx on instagram_stories (posted_at desc);

alter table instagram_account_daily enable row level security;
alter table instagram_media enable row level security;
alter table instagram_stories enable row level security;

create policy "team full access" on instagram_account_daily for all to authenticated using (true) with check (true);
create policy "team full access" on instagram_media for all to authenticated using (true) with check (true);
create policy "team full access" on instagram_stories for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
