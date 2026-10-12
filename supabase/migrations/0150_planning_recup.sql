-- Nouveau statut "recup" (récupération d'heures), distinct de OFF — jusqu'ici
-- une récup n'avait pas d'état propre et était notée OFF + une note libre,
-- ce qui la rendait indiscernable d'un OFF normal sans ouvrir la note.

alter table planning_shifts drop constraint if exists planning_shifts_statut_check;
alter table planning_shifts add constraint planning_shifts_statut_check
  check (statut in ('travail', 'conge', 'repos', 'superviseur', 'recup'));

alter table planning_semaine_type drop constraint if exists planning_semaine_type_statut_check;
alter table planning_semaine_type add constraint planning_semaine_type_statut_check
  check (statut in ('travail', 'conge', 'repos', 'superviseur', 'recup'));
