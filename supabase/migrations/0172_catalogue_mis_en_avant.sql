-- Permet à l'équipe de choisir elle-même les activités affichées en "Nos
-- incontournables" sur la page d'accueil de la vitrine publique, au lieu de
-- l'ordre alphabétique par défaut.
alter table catalogue_activites
  add column mis_en_avant boolean not null default false;
