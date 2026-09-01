-- Étapes de paiement libres, entre l'acompte et le solde — certains
-- clients règlent en plusieurs fois (acompte, puis un ou plusieurs PayPal,
-- puis espèces, puis CB...). L'acompte et le solde restent tels quels
-- (un seul de chaque, jamais par activité — règle métier stable, voir
-- CLAUDE.md section 2), ces étapes viennent juste s'ajouter entre les deux
-- pour tracer les règlements intermédiaires.
create table if not exists paiements_etapes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  montant numeric not null default 0,
  mode text not null default '',
  date date,
  created_at timestamptz not null default now()
);

create index if not exists paiements_etapes_client_idx on paiements_etapes (client_id);

alter table paiements_etapes enable row level security;
create policy "team full access" on paiements_etapes for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
