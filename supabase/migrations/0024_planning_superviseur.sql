-- Nouveau statut "superviseur" (pas d'horaires associés, comme OFF/congé)
-- pour les jours où quelqu'un supervise sans créneau fixe.

alter table planning_shifts drop constraint if exists planning_shifts_statut_check;
alter table planning_shifts add constraint planning_shifts_statut_check
  check (statut in ('travail', 'conge', 'repos', 'superviseur'));

alter table planning_semaine_type drop constraint if exists planning_semaine_type_statut_check;
alter table planning_semaine_type add constraint planning_semaine_type_statut_check
  check (statut in ('travail', 'conge', 'repos', 'superviseur'));
