-- Rôles d'équipe : Direction (accès total, y compris marges/CA) vs Équipe
-- (accès clients/catalogue/réservations, mais ne peut pas supprimer un client
-- ni voir les marges/coûts). Remplace le PIN codé en dur par une vraie
-- vérification côté base de données.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'equipe' check (role in ('direction', 'equipe')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Tout utilisateur authentifié peut lire tous les profils (équipe partagée,
-- besoin de connaître son propre rôle côté app). Personne ne peut modifier
-- son propre rôle depuis l'app — seul un administrateur via le SQL Editor
-- peut promouvoir quelqu'un en Direction.
create policy "team read profiles" on profiles for select to authenticated using (true);

-- Un profil "equipe" par défaut est créé automatiquement à la première
-- connexion de chaque nouvel utilisateur.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role) values (new.id, 'equipe')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Rétroactivement, un profil pour chaque compte déjà créé.
insert into profiles (id, role)
select id, 'equipe' from auth.users
on conflict (id) do nothing;

-- La suppression de client devient réservée à la Direction : on retire le
-- delete de la policy "for all" et on le remplace par une policy dédiée.
drop policy if exists "team full access" on clients;

create policy "team read/write clients" on clients
  for select to authenticated using (true);
create policy "team insert clients" on clients
  for insert to authenticated with check (true);
create policy "team update clients" on clients
  for update to authenticated using (true) with check (true);
create policy "direction delete clients" on clients
  for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
