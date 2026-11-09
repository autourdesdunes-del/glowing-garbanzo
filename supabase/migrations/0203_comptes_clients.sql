-- BRIEF_COMPTE_CLIENT.md étape 1 — comptes clients par téléphone, rapprochés
-- automatiquement avec la fiche `clients` existante. Même schéma de principe
-- que `profiles` (0003_roles.sql) pour les comptes équipe : une table 1:1
-- sur auth.users, remplie par un trigger after insert. Ici le rôle n'existe
-- pas (ce n'est jamais un compte équipe) et l'essentiel est le
-- rapprochement par numéro, pas un rôle.
create table if not exists comptes_clients (
  id uuid primary key references auth.users(id) on delete cascade,
  telephone text not null default '',
  client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table comptes_clients enable row level security;

-- Un client authentifié ne lit que son propre compte directement ; le
-- reste (fiche, réservations...) continue de passer par les routes API en
-- service_role, jamais par un accès direct depuis le navigateur — même
-- principe que le reste de la vitrine (voir jeton_hotel, favoris).
create policy "comptes_clients_self_select" on comptes_clients
  for select using (auth.uid() = id);

-- Compare les 9 derniers chiffres pour absorber l'écart indicatif (+20...)
-- vs zéro initial (0...) entre un numéro saisi au clavier international
-- (E.164) et un numéro de `clients.telephone` collecté tel que tapé sur
-- WhatsApp/Instagram — même limite que normPhone() côté CRM (src/lib/
-- duplicates.ts), qui ne gère pas non plus cet écart de format, donc pas
-- une régression par rapport à ce qui existe déjà pour les doublons.
create or replace function telephone_suffixe(texte text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(texte, ''), '\D', '', 'g'), 9)
$$;

create or replace function handle_new_client_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_client_id uuid;
  suffixe text;
begin
  -- Les comptes équipe (email/mot de passe, voir 0003_roles.sql) n'ont
  -- jamais de numéro sur auth.users.phone — rien à faire pour eux ici.
  if new.phone is null or new.phone = '' then
    return new;
  end if;

  suffixe := telephone_suffixe(new.phone);

  select id into found_client_id
  from clients
  where suffixe <> ''
    and (telephone_suffixe(telephone) = suffixe or telephone_suffixe(telephone_2) = suffixe)
  order by created_at asc
  limit 1;

  insert into comptes_clients (id, telephone, client_id)
  values (new.id, new.phone, found_client_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_client_user_created on auth.users;
create trigger on_auth_client_user_created
  after insert on auth.users
  for each row execute function handle_new_client_user();
