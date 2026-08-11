-- Quand une employée choisit "Le Caire en bus" / "Louxor en bus" (au lieu
-- de la formule mini-bus recommandée) et signale que le client insiste,
-- ça crée une escalade à valider/refuser par la Direction (Mélanie,
-- Hossam) et Sylvie. Les trois la voient, mais un seul traitement suffit —
-- d'où le statut partagé plutôt qu'une ligne par destinataire.
create table if not exists bus_escalations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  client_nom text not null default '',
  nom_activite text not null default '',
  employe_id uuid not null references auth.users(id) on delete cascade,
  employe_nom text not null default '',
  statut text not null default 'en_attente' check (statut in ('en_attente', 'validee', 'refusee')),
  resolu_par uuid references auth.users(id) on delete set null,
  resolu_par_nom text not null default '',
  resolu_message text not null default '',
  resolu_at timestamptz,
  created_at timestamptz not null default now()
);

alter table bus_escalations enable row level security;
create policy "team full access" on bus_escalations for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
