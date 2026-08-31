-- Retire "fermeture" (migration 0083) — n'a pas de sens pour l'agence,
-- ouverte tous les jours avec des shifts, pas de notion de fermeture.
alter table planning_shifts
  drop column if exists est_fermeture;

alter table planning_semaine_type
  drop column if exists est_fermeture;
