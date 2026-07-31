-- Horaire de travail du jour par personne (table séparée de profiles pour ne
-- jamais donner à une policy d'update le pouvoir de toucher à la colonne
-- role — chacun ne peut modifier que sa propre ligne ici).
create table if not exists user_shifts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shift_debut text not null default '',
  shift_fin text not null default '',
  updated_at timestamptz not null default now()
);

alter table user_shifts enable row level security;

create policy "team read shifts" on user_shifts for select to authenticated using (true);
create policy "self insert shift" on user_shifts for insert to authenticated
  with check (user_id = auth.uid());
create policy "self update shift" on user_shifts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Prochain appel programmé avec le client (affiché dans les actions rapides
-- du jour quand la date correspond à aujourd'hui).
alter table clients
  add column if not exists prochain_appel_date date,
  add column if not exists prochain_appel_heure text not null default '';
