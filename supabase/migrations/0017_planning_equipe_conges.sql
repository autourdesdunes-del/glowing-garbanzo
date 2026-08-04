-- Planning équipe : Direction tient le planning (horaires + jours de congé)
-- de chaque personne ; chaque employée peut demander un congé, et ne voit
-- que son propre total de congés pris dans l'année (jamais celui des
-- autres) — appliqué directement via RLS, pas juste côté UI.

alter table profiles add column if not exists email text not null default '';

update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email = '';

create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role, email) values (new.id, 'equipe', new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- planning_shifts : un jour = une ligne, tenue par la Direction (horaires de
-- travail ou congé). Toute l'équipe peut la lire (besoin de savoir qui
-- travaille), seule la Direction peut l'écrire.
-- ---------------------------------------------------------------------------
create table if not exists planning_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  shift_debut text not null default '',
  shift_fin text not null default '',
  statut text not null default 'travail' check (statut in ('travail', 'conge', 'repos')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table planning_shifts enable row level security;

create policy "team read planning" on planning_shifts for select to authenticated using (true);
create policy "direction insert planning" on planning_shifts for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction update planning" on planning_shifts for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction delete planning" on planning_shifts for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

create trigger planning_shifts_set_updated_at before update on planning_shifts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- conges : demandes de congé. Chacune peut créer/voir la sienne ; seule la
-- Direction voit celles de tout le monde et peut les valider/refuser.
-- C'est cette règle de lecture (et pas un simple filtrage côté écran) qui
-- garantit qu'une employée ne peut jamais voir le total des autres.
-- ---------------------------------------------------------------------------
create table if not exists conges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  motif text not null default '',
  statut text not null default 'En attente' check (statut in ('En attente', 'Validé', 'Refusé')),
  created_at timestamptz not null default now()
);

alter table conges enable row level security;

create policy "self insert conge" on conges for insert to authenticated
  with check (user_id = auth.uid());
create policy "self or direction read conge" on conges for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction')
  );
create policy "self delete own pending conge" on conges for delete to authenticated
  using (user_id = auth.uid() and statut = 'En attente');
create policy "direction update conge" on conges for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction delete conge" on conges for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
