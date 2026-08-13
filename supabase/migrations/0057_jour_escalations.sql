-- Demande d'autorisation quand une employée choisit, pour une activité,
-- une date qui tombe un jour où le catalogue dit l'activité indisponible
-- (catalogue_activites.jours_disponibles) — même schéma que bus_escalations
-- (migration 0041/0042) : l'activité est ajoutée tout de suite avec la date
-- choisie (jamais bloquée en attendant une réponse), et la demande part en
-- parallèle pour Sylvie/Direction qui peuvent valider ou refuser.

create table if not exists jour_escalations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  client_nom text not null default '',
  reservation_id uuid references reservations(id) on delete cascade,
  nom_activite text not null default '',
  date_choisie date,
  jour_choisi text not null default '',
  jours_disponibles text[] not null default '{}',
  employe_id uuid not null references auth.users(id) on delete cascade,
  employe_nom text not null default '',
  statut text not null default 'en_attente' check (statut in ('en_attente', 'validee', 'refusee')),
  resolu_par uuid references auth.users(id) on delete set null,
  resolu_par_nom text not null default '',
  resolu_message text not null default '',
  resolu_at timestamptz,
  created_at timestamptz not null default now()
);

alter table jour_escalations enable row level security;

create policy "team full access" on jour_escalations for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
