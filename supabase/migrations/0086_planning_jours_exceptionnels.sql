-- Jours où la couverture 9h30-21h30 par au moins 2 personnes n'est pas
-- exigée (Noël, jour de l'an, raison spéciale...) — la Direction les marque
-- "exceptionnel" pour que l'alerte "jour incomplet" du Planning équipe ne
-- se déclenche pas sur ces dates précises.
create table if not exists planning_jours_exceptionnels (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  motif text not null default '',
  created_at timestamptz not null default now()
);

alter table planning_jours_exceptionnels enable row level security;
create policy "team full access" on planning_jours_exceptionnels for all to authenticated using (true) with check (true);
