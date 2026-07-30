-- Historique des modifications : qui a créé/modifié/supprimé quoi et quand.
-- Alimenté automatiquement par des triggers (pas par le code applicatif) pour
-- qu'aucune modification ne puisse passer inaperçue.

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_email text,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

create policy "team read activity_log" on activity_log for select to authenticated using (true);
create policy "team insert activity_log" on activity_log for insert to authenticated with check (true);

create or replace function log_activity() returns trigger as $$
declare
  actor text;
  cid uuid;
  rid uuid;
begin
  select email into actor from auth.users where id = auth.uid();

  if TG_OP = 'DELETE' then
    rid := old.id;
    cid := case TG_TABLE_NAME
      when 'clients' then old.id
      else old.client_id
    end;
    insert into activity_log (client_id, table_name, record_id, action, actor_email)
    values (cid, TG_TABLE_NAME, rid, 'delete', actor);
    return old;
  else
    rid := new.id;
    cid := case TG_TABLE_NAME
      when 'clients' then new.id
      else new.client_id
    end;
    insert into activity_log (client_id, table_name, record_id, action, actor_email)
    values (cid, TG_TABLE_NAME, rid, lower(TG_OP), actor);
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists log_clients on clients;
create trigger log_clients after insert or update or delete on clients
  for each row execute function log_activity();

drop trigger if exists log_reservations on reservations;
create trigger log_reservations after insert or update or delete on reservations
  for each row execute function log_activity();

drop trigger if exists log_paiements on paiements;
create trigger log_paiements after insert or update or delete on paiements
  for each row execute function log_activity();

drop trigger if exists log_remboursements on remboursements;
create trigger log_remboursements after insert or update or delete on remboursements
  for each row execute function log_activity();
