-- Certaines options (ex. Parachute ascensionnel en supplément d'un
-- speedboat) se vendent par participant, pas en montant forfaitaire fixe —
-- prix reste le prix unitaire, quantite est le nombre de participants
-- (défaut 1, donc aucun changement pour les options existantes).
alter table reservation_options add column if not exists quantite integer not null default 1;
