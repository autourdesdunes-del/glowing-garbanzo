-- La reprise (règlement en attente pour une activité ajoutée après un solde
-- déjà entièrement réglé) ne gardait qu'UNE seule activité de rattachement
-- (reprise_activite_id) alors que plusieurs activités ajoutées l'une après
-- l'autre peuvent composer le même montant en attente, surtout en PayPal/
-- virement (pas de point de collecte physique). Deviner après coup laquelle
-- afficher "En attente" (par date, puis par ordre de création) a fait
-- afficher "Payé" à tort sur une activité en réalité impayée, deux fois de
-- suite sur le même dossier le 2026-09-14 (Carine LELOIR : Safari quad, puis
-- Le Caire en bus).
--
-- reprise_activite_ids accumule CHAQUE activité explicitement reliée au fil
-- des pop-up de reprise successifs (un par activité ajoutée, voir
-- confirmerReprise dans ClientDetail.tsx) — reprise_activite_id reste tel
-- quel, pointant sur la dernière choisie, pour le rappel unique affiché à
-- côté du titre (voir acompteWaitingWarning/activitePaiementWarning).
alter table clients
  add column if not exists reprise_activite_ids uuid[] not null default '{}'::uuid[];

notify pgrst, 'reload schema';
