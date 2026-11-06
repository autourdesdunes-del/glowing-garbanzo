-- Notification de pick-up (BRIEF_MESSAGERIE.md §8 bis, 2026-11-06) : dès
-- que l'équipe saisit pickup_reel dans le CRM, le client reçoit une
-- notification dans l'espace client et un email. Détecté par trigger
-- plutôt que dans le code applicatif : pickup_reel peut être saisi
-- depuis plusieurs écrans du CRM (Suivis > Pick-ups, fiche client...),
-- un trigger attrape tous les points d'entrée sans dépendre de ce que le
-- code appelant pense à faire.
create table if not exists notifications_client (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete cascade,
  type text not null check (type in ('pickup_initial', 'pickup_modifie')),
  contenu text not null default '',
  lu boolean not null default false,
  -- Coché par le cron d'envoi (vitrine) une fois l'email parti — permet
  -- de rejouer uniquement les envois ratés sans redemander in-app.
  email_envoye boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_client_client_idx on notifications_client (client_id, lu);
create index if not exists notifications_client_email_idx on notifications_client (email_envoye) where email_envoye = false;

alter table notifications_client enable row level security;

create policy "notifications_client_all_authenticated"
  on notifications_client for all
  to authenticated
  using (true)
  with check (true);

-- Pas de policy anon select/insert/update : la lecture depuis l'espace
-- client passe par une route API côté serveur (service role), jamais un
-- accès table direct — même discipline que les autres écritures/lectures
-- publiques de ce projet.

create or replace function notifier_pickup_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pickup_reel is distinct from old.pickup_reel and coalesce(new.pickup_reel, '') <> '' then
    insert into notifications_client (client_id, reservation_id, type, contenu)
    values (
      new.client_id,
      new.id,
      case when coalesce(old.pickup_reel, '') = '' then 'pickup_initial' else 'pickup_modifie' end,
      case when coalesce(old.pickup_reel, '') = ''
        then 'Votre horaire de prise en charge pour ' || coalesce(nullif(new.nom_activite, ''), 'votre activité') || ' est confirmé : ' || new.pickup_reel || '.'
        else 'Votre horaire de prise en charge pour ' || coalesce(nullif(new.nom_activite, ''), 'votre activité') || ' a été modifié : ' || new.pickup_reel || '.'
      end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifier_pickup_change on reservations;
create trigger trg_notifier_pickup_change
  after update of pickup_reel on reservations
  for each row
  execute function notifier_pickup_change();
