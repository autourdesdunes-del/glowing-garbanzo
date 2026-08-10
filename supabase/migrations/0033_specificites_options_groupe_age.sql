-- Forfait groupe : un seul palier de "personne supplémentaire" (au lieu de
-- deux), avec un descriptif d'âge comme pour le tarif adulte, et un tarif
-- "enfant supplémentaire" avec son propre descriptif d'âge.
alter table catalogue_activites
  add column if not exists prix_groupe_extra1_age text not null default '';
alter table catalogue_activites
  add column if not exists prix_groupe_extra_enfant_age text not null default '';

-- Spécificités importantes d'une activité (ex. "2 adultes minimum", "ne pas
-- recommander cette activité"), affichées en rouge sur la fiche validée.
alter table catalogue_activites
  add column if not exists specificites text not null default '';

-- Options proposées par activité (ex. Privatif +10€, Dîner spectacle
-- +5€/personne), réutilisables sur chaque réservation de cette activité —
-- même logique que catalogue_tarifs/reservation_tarifs (migration 0012).
create table if not exists catalogue_options (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_id uuid not null references catalogue_activites(id) on delete cascade,
  nom text not null default '',
  prix numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table catalogue_options enable row level security;
create policy "team full access" on catalogue_options for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';

