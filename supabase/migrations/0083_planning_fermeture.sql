-- Marque un horaire de travail comme "fermeture" (la personne ferme
-- l'agence ce jour-là) — sert à l'alerte "jour incomplet" du Planning
-- équipe : un jour sans personne en fermeture est un risque même si le
-- reste de l'effectif est correct.
alter table planning_shifts
  add column if not exists est_fermeture boolean not null default false;

alter table planning_semaine_type
  add column if not exists est_fermeture boolean not null default false;
