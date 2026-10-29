-- Tableau de bord > File d'attente prioritaire : bloc "Notes d'équipe"
-- (demande de Mélanie, 2026-10-29) — un mur de notes libres taguées,
-- écrites par n'importe qui, visibles de toute l'équipe, qu'on coche une
-- fois traité (avec confirmation, voir TeamNotes.tsx) plutôt que de les
-- supprimer : elles restent consultables en historique au lieu de
-- disparaître.
create table if not exists team_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tag text not null,
  texte text not null,
  auteur_nom text not null default '',
  auteur_id uuid,
  traite boolean not null default false,
  traite_le timestamptz,
  traite_par_nom text,
  traite_par_id uuid
);

alter table team_notes enable row level security;

create policy "team read team_notes" on team_notes for select to authenticated using (true);
create policy "team insert team_notes" on team_notes for insert to authenticated with check (true);
create policy "team update team_notes" on team_notes for update to authenticated using (true);
create policy "team delete team_notes" on team_notes for delete to authenticated using (true);
