-- Notifie Sylvie/Direction quand un acompte validé reste sous le minimum
-- requis pour "Le Caire en avion" (billet acheté immédiatement, non
-- remboursable) malgré l'alerte affichée à l'employée — jamais bloquant,
-- juste un signal. Même schéma que bus_escalations/jour_escalations
-- (migrations 0041/0057), mais sans statut à trancher (vu/vu_par_nom au
-- lieu de en_attente/validee/refusee).

create table if not exists acompte_alertes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  client_nom text not null default '',
  reservation_id uuid references reservations(id) on delete set null,
  nom_activite text not null default '',
  montant_minimum numeric not null default 0,
  montant_saisi numeric not null default 0,
  employe_id uuid not null references auth.users(id) on delete cascade,
  employe_nom text not null default '',
  vu boolean not null default false,
  vu_par_nom text not null default '',
  vu_at timestamptz,
  created_at timestamptz not null default now()
);

alter table acompte_alertes enable row level security;

create policy "team full access" on acompte_alertes for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
