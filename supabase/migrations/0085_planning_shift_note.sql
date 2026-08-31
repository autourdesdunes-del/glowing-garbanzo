-- Petite note libre sur un horaire ponctuel (ex. "OFF habituel décalé",
-- "Récup samedi 19") — affichée en icône ℹ️ sur la carte du shift dans le
-- Planning équipe, pour expliquer une exception sans avoir à s'en souvenir.
alter table planning_shifts
  add column if not exists note text not null default '';
