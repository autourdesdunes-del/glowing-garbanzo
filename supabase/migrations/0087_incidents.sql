-- Rapports d'incident par client : réclamations, soucis de communication,
-- problèmes pendant une activité (ex. morsure de chameau + désaccord
-- remboursement) — jusqu'ici ce type d'info finissait perdu dans le résumé
-- IA Kommo (kommo_resume), invisible une fois le client confirmé. Ici c'est
-- un log visible et actionnable depuis la fiche client (icône + popup).

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  titre text not null default '',
  details text not null default '',
  date_incident date,
  statut text not null default 'Ouvert' check (statut in ('Ouvert', 'Résolu')),
  par text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_client_id_idx on incidents (client_id);

alter table incidents enable row level security;

create policy "team full access" on incidents for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
