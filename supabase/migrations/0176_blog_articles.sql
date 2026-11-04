-- Blog public de la vitrine — 7 articles à migrer depuis WordPress
-- (wp-json/wp/v2/posts) puis les suivants écrits directement ici.
-- Le slug est repris à l'identique des URLs WordPress existantes : elles
-- sont déjà indexées, les changer casserait le référencement acquis.
create table blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titre text not null,
  extrait text not null default '',
  -- HTML pour les 7 articles migrés (contenu WordPress tel quel) ; les
  -- nouveaux articles écrits dans le CRM peuvent aussi y stocker du HTML
  -- simple généré depuis un éditeur texte enrichi basique.
  contenu_html text not null default '',
  photo_path text not null default '',
  date_publication date not null default current_date,
  valide boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_articles_date_idx on blog_articles (date_publication desc);

alter table blog_articles enable row level security;

-- Lecture publique des articles publiés uniquement (vitrine publique,
-- même logique que catalogue_activites/valide — migration 0162).
create policy "Lecture publique des articles publiés"
  on blog_articles for select
  to anon
  using (valide = true);

-- Écriture réservée à l'équipe interne (CRM, utilisateurs authentifiés).
create policy "Équipe interne : tout"
  on blog_articles for all
  to authenticated
  using (true)
  with check (true);
