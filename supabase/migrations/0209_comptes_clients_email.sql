-- BRIEF_COMPTE_CLIENT.md — correction du 2026-11-09 : l'identifiant du
-- compte devient l'email, pas le téléphone (décision de Mélanie, qui
-- renverse la recommandation initiale de ce brief). Personne ne s'est
-- jamais inscrit par téléphone (le fournisseur SMS n'a jamais été
-- branché) : aucune ligne réelle à migrer, on peut remplacer la colonne
-- proprement plutôt que la garder en doublon.
alter table comptes_clients
  add column if not exists email text not null default '';

alter table comptes_clients
  drop column if exists telephone;

-- Rapprochement par email (insensible à la casse et aux espaces) plutôt
-- que par les 9 derniers chiffres du téléphone — plus simple, et c'est
-- déjà ce que /api/espace-client/demander-lien utilisait pour retrouver
-- une fiche par email avant cette migration.
drop function if exists telephone_suffixe(text);

create or replace function handle_new_client_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  found_client_id uuid;
  email_normalise text;
begin
  -- Les comptes équipe (créés à la main, voir 0208) n'ont jamais de
  -- trigger sur auth.users : rien à faire ici pour eux, ce trigger ne
  -- concerne que les comptes clients.
  if new.email is null or new.email = '' then
    return new;
  end if;

  email_normalise := lower(btrim(new.email));

  select id into found_client_id
  from clients
  where email <> '' and lower(btrim(email)) = email_normalise
  order by created_at asc
  limit 1;

  insert into comptes_clients (id, email, client_id)
  values (new.id, new.email, found_client_id)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_client_user_created on auth.users;
create trigger on_auth_client_user_created
  after insert on auth.users
  for each row execute function handle_new_client_user();
