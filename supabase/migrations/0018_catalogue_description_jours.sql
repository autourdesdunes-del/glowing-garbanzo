-- Catalogue plus complet pour une employée qui ne connaît pas l'activité :
-- une vraie description, et les jours de la semaine où elle a lieu (pour
-- afficher un mini calendrier hebdomadaire au lieu d'un texte libre).

alter table catalogue_activites
  add column if not exists description text not null default '',
  add column if not exists jours_disponibles text[] not null default '{}';
