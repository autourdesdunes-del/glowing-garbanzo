-- Intégration Kommo (étape 1 — lecture seule) : lier chaque fiche client à
-- son contact/lead Kommo, et tracer les délais de réponse par conversation
-- sans dupliquer la messagerie elle-même (Kommo reste le seul endroit où on
-- lit/écrit les messages WhatsApp/Instagram).
--
-- kommo_webhook_events journalise le payload brut de chaque appel reçu :
-- les formats exacts envoyés par Kommo (webhooks classiques vs API v4)
-- varient selon la configuration côté compte, donc on log tout pendant la
-- phase de test avant d'affiner le parsing sur des events réels.

alter table clients add column if not exists kommo_contact_id bigint;
alter table clients add column if not exists kommo_lead_id bigint;
alter table clients add column if not exists kommo_pipeline_status_id bigint;
alter table clients add column if not exists kommo_pipeline_status_nom text not null default '';
alter table clients add column if not exists kommo_last_client_message_at timestamptz;
alter table clients add column if not exists kommo_last_team_reply_at timestamptz;
alter table clients add column if not exists kommo_last_team_reply_par text not null default '';
alter table clients add column if not exists kommo_synced_at timestamptz;

create unique index if not exists clients_kommo_contact_id_key
  on clients (kommo_contact_id) where kommo_contact_id is not null;
create unique index if not exists clients_kommo_lead_id_key
  on clients (kommo_lead_id) where kommo_lead_id is not null;

create table if not exists kommo_webhook_events (
    id uuid primary key default gen_random_uuid(),
    event_type text not null default 'inconnu',
    payload jsonb not null default '{}'::jsonb,
    client_id uuid references clients(id) on delete set null,
    error text,
    created_at timestamptz not null default now()
  );

create index if not exists kommo_webhook_events_created_at_idx
  on kommo_webhook_events (created_at desc);

alter table kommo_webhook_events enable row level security;

-- Écriture réservée au service role (route webhook) ; l'équipe peut lire
-- pour déboguer l'intégration pendant la phase de test.
create policy "team read kommo events" on kommo_webhook_events
  for select to authenticated using (true);

notify pgrst, 'reload schema';
