-- Coordonnées des hôtels existants, pour servir de référentiel de
-- classement par zone (nearest-neighbor) quand un hôtel saisi côté
-- vitrine n'est pas dans hotels_reference. Remplies une fois par un
-- géocodage ponctuel (script, clé Google), pas par saisie manuelle.
alter table hotels_reference
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;
