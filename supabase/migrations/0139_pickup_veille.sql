-- Certaines activités (ex. "Le Caire en mini-bus") ont un pick-up réel très
-- tôt le matin, donc en pratique récupéré la VEILLE au soir (ex. 23:35),
-- pas le jour même de l'activité (Mélanie, 2026-09-19). Sans ce marqueur,
-- le tri par heure de pick-up traitait "23:35" comme tard le soir DU jour
-- de l'activité au lieu de la veille — l'activité se retrouvait triée en
-- dernier au lieu d'en premier. L'activité reste affichée le jour J
-- (date_debut inchangée), seul le marqueur et le tri changent.
alter table reservations
  add column if not exists pickup_veille boolean not null default false;
