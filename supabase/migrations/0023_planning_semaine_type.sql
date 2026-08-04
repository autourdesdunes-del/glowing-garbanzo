-- Modèles de semaine (Semaine A / Semaine B) : au lieu de ressaisir chaque
-- jour à la main, la Direction remplit une fois le motif hebdomadaire de
-- chaque personne pour la semaine A et pour la semaine B, puis "génère" le
-- vrai planning (planning_shifts) en alternant A/B sur autant de semaines
-- que voulu à partir d'une date de départ.

create table if not exists planning_semaine_type (
  id uuid primary key default gen_random_uuid(),
  semaine text not null check (semaine in ('A', 'B')),
  user_id uuid not null references auth.users(id) on delete cascade,
  jour text not null check (jour in ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
  statut text not null default 'repos' check (statut in ('travail', 'conge', 'repos')),
  shift_debut text not null default '',
  shift_fin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semaine, user_id, jour)
);

alter table planning_semaine_type enable row level security;

create policy "team read semaine type" on planning_semaine_type for select to authenticated using (true);
create policy "direction write semaine type" on planning_semaine_type for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

create trigger planning_semaine_type_set_updated_at before update on planning_semaine_type
  for each row execute function set_updated_at();
