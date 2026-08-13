-- Intégration PayPal : le CRM reçoit une notification webhook à chaque
-- paiement reçu sur le compte PayPal Business de l'agence (acomptes,
-- 95% des cas). paypal_webhook_events journalise le payload brut de
-- chaque appel — le format exact des events PayPal pour un paiement
-- "personnel" (entre proches) reçu hors flux Checkout n'est confirmé
-- qu'une fois de vrais paiements de test observés, donc on log tout
-- avant d'affiner le parsing. paypal_paiements est la version "propre"
-- après extraction : un paiement reçu, pas encore rattaché à un client
-- tant qu'une employée ne l'a pas fait manuellement (le nom du payeur
-- PayPal ne suffit jamais à rapprocher automatiquement sans risque
-- d'erreur — deux clients peuvent avoir un nom proche).
--
-- Ne remplace pas les colonnes acompte_* existantes sur clients : une
-- fois rattaché, le paiement PayPal vient renseigner ces colonnes
-- (acompte_paye, acompte_montant, acompte_mode, acompte_date_encaissement)
-- au lieu d'une saisie manuelle.

create table if not exists paypal_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'inconnu',
  payload jsonb not null default '{}'::jsonb,
  paiement_id uuid,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists paypal_webhook_events_created_at_idx
  on paypal_webhook_events (created_at desc);

create table if not exists paypal_paiements (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null,
  montant numeric not null default 0,
  devise text not null default 'EUR',
  frais numeric not null default 0,
  montant_net numeric not null default 0,
  -- null tant qu'on n'a pas confirmé la lecture du champ PayPal exact ;
  -- true/false une fois le parsing du payload fiabilisé.
  entre_proches boolean,
  payeur_nom text not null default '',
  payeur_email text not null default '',
  paypal_recu_le timestamptz not null default now(),
  rattache_client_id uuid references clients(id) on delete set null,
  rattache_par text not null default '',
  rattache_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists paypal_paiements_transaction_id_key
  on paypal_paiements (transaction_id);
create index if not exists paypal_paiements_non_rattaches_idx
  on paypal_paiements (paypal_recu_le desc) where rattache_client_id is null;

alter table paypal_webhook_events enable row level security;
alter table paypal_paiements enable row level security;

-- Écriture réservée au service role (route webhook) ; l'équipe peut lire
-- pour rattacher un paiement à un client et déboguer l'intégration.
create policy "team read paypal webhook events" on paypal_webhook_events
  for select to authenticated using (true);
create policy "team read paypal paiements" on paypal_paiements
  for select to authenticated using (true);
create policy "team update paypal paiements" on paypal_paiements
  for update to authenticated using (true);

notify pgrst, 'reload schema';
