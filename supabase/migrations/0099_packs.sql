-- Un Pack regroupe plusieurs activités déjà au catalogue, vendues ensemble
-- à un prix par personne inférieur à la somme des activités prises
-- séparément (ex. PACK EXPLORATION : Caire/Louxor + Maison des dauphins +
-- Safari, 125€/pers au lieu du cumul des prix normaux). "slots" est la
-- liste des emplacements du pack, chacun avec une ou plusieurs activités
-- catalogue alternatives ("OU") : [{ "ordre": 1, "catalogue_item_ids": [...] }, ...].
create table if not exists packs (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '',
  description text not null default '',
  inclus text not null default '',
  photo_path text not null default '',
  prix_adulte numeric not null default 0,
  prix_enfant numeric not null default 0,
  valide boolean not null default false,
  ordre integer not null default 0,
  slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table packs enable row level security;
create policy "team full access" on packs for all to authenticated using (true) with check (true);

-- Chaque activité créée à partir d'un pack garde sa propre part de prix
-- (calculée au prorata des prix catalogue normaux, jamais à 0€) pour que
-- son annulation individuelle se comporte exactement comme une réservation
-- normale, sans casser le total des autres cartes du même pack.
alter table reservations
  add column if not exists pack_id uuid references packs(id) on delete set null,
  add column if not exists pack_nom text not null default '';

notify pgrst, 'reload schema';
