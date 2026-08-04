-- Catalogue enrichi : FAQ par activité, guide (langue + "sur demande"),
-- programme complet, inclus sous forme de liste sélectionnable, tranches
-- d'âge éditables pour les PU, durée (demi-journée/journée/plusieurs
-- jours), et prochaine disponibilité connue. "Top des ventes" et "Top
-- rentabilité" ne sont pas stockés : ils sont recalculés à la volée à
-- partir des réservations (voir AppShell/CatalogueView).

alter table catalogue_activites
  add column if not exists guide text not null default 'Aucun',
  add column if not exists guide_francophone_sur_demande boolean not null default false,
  add column if not exists programme text not null default '',
  add column if not exists inclus_liste text[] not null default '{}',
  add column if not exists pu_adulte_age text not null default '11 ans et +',
  add column if not exists pu_enfant_age text not null default '4 à 10 ans',
  add column if not exists pu_bebe_age text not null default '0 à 3 ans',
  add column if not exists duree text not null default 'Journée',
  add column if not exists prochaine_disponibilite text not null default '';

create table if not exists catalogue_faq (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_id uuid not null references catalogue_activites(id) on delete cascade,
  question text not null default '',
  reponse text not null default '',
  created_at timestamptz not null default now()
);

alter table catalogue_faq enable row level security;
create policy "team full access" on catalogue_faq for all to authenticated using (true) with check (true);
