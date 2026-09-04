-- Petites tâches libres que la Direction ajoute elle-même dans la "Liste
-- prioritaire" du tableau de bord Direction (ex. "finir le CRM"), à côté
-- des remboursements en attente qui eux viennent d'ailleurs dans l'app.
-- Cocher une tâche la retire simplement de la liste (fait = true).

create table if not exists direction_taches (
  id uuid primary key default gen_random_uuid(),
  texte text not null,
  fait boolean not null default false,
  created_at timestamptz not null default now()
);

alter table direction_taches enable row level security;

create policy "team full access" on direction_taches for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
