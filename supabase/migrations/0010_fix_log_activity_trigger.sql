-- Correctif : un CASE unique référençant new.client_id ET new.id échoue au
-- runtime dès que le trigger tourne sur la table clients (pas de colonne
-- client_id là-bas) — PL/pgSQL résout les champs d'un RECORD générique en
-- fonction de l'appel, et un CASE assigné en une seule expression peut
-- tenter la mauvaise branche. On remplace par des branches IF/ELSIF
-- distinctes, chacune avec sa propre insertion.

create or replace function log_activity() returns trigger as $$
declare
  actor text;
begin
  select email into actor from auth.users where id = auth.uid();

  if TG_TABLE_NAME = 'clients' then
    if TG_OP = 'DELETE' then
      insert into activity_log (client_id, table_name, record_id, action, actor_email)
      values (old.id, TG_TABLE_NAME, old.id, 'delete', actor);
      return old;
    else
      insert into activity_log (client_id, table_name, record_id, action, actor_email)
      values (new.id, TG_TABLE_NAME, new.id, lower(TG_OP), actor);
      return new;
    end if;
  else
    if TG_OP = 'DELETE' then
      insert into activity_log (client_id, table_name, record_id, action, actor_email)
      values (old.client_id, TG_TABLE_NAME, old.id, 'delete', actor);
      return old;
    else
      insert into activity_log (client_id, table_name, record_id, action, actor_email)
      values (new.client_id, TG_TABLE_NAME, new.id, lower(TG_OP), actor);
      return new;
    end if;
  end if;
end;
$$ language plpgsql security definer;
