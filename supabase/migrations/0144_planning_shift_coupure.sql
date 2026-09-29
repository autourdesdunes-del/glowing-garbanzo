-- Un horaire "coupé" (ex. 9h30-12h00 puis 15h00-20h00, avec une vraie
-- absence entre les deux) ne pouvait pas être représenté : planning_shifts
-- a unique(user_id, date), donc une seule plage par personne et par jour.
-- Jusqu'ici, ces journées étaient approximées par un seul bloc continu
-- (ex. 9h30-20h00), ce qui affichait la personne comme présente pendant sa
-- coupure de midi — refusé par Mélanie le 2026-09-29.
--
-- Ajoute une deuxième plage optionnelle (shift2_debut/shift2_fin, vides par
-- défaut = pas de coupure) plutôt que de lever unique(user_id, date) : une
-- seule ligne par personne et par jour reste la norme, la coupure est
-- l'exception qui ajoute juste deux colonnes de plus à cette même ligne.

alter table planning_shifts
  add column if not exists shift2_debut text not null default '';
alter table planning_shifts
  add column if not exists shift2_fin text not null default '';
