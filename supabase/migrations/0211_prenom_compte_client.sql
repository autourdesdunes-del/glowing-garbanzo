-- BRIEF_COMPTE_CLIENT.md — décision de Mélanie du 2026-11-10 : un seul
-- champ à l'inscription (le prénom), pour pouvoir dire "Bonjour
-- {prénom}" sans rien demander d'autre — la règle "aucune condition
-- d'entrée" tient. Transmis par signInWithOtp({ options: { data:
-- { prenom } } }), disponible dans auth.users.raw_user_meta_data à la
-- création du compte.
alter table comptes_clients
  add column if not exists prenom text not null default '';

create or replace function handle_new_client_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_client_id uuid;
  email_normalise text;
begin
  if new.email is null or new.email = '' then
    return new;
  end if;

  email_normalise := lower(btrim(new.email));

  select id into found_client_id
  from clients
  where email <> '' and lower(btrim(email)) = email_normalise
  order by created_at asc
  limit 1;

  insert into comptes_clients (id, email, client_id, prenom)
  values (new.id, new.email, found_client_id, coalesce(new.raw_user_meta_data->>'prenom', ''))
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;
