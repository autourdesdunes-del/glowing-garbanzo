-- Suivi du dernier "montant à payer" communiqué (bloc équipe Égypte ou
-- message pick-up client) pour l'activité de collecte du solde — sert à
-- déclencher un pop-up bloquant si ce montant change ensuite sans que
-- personne n'ait prévenu qui a déjà communiqué l'ancien montant (vécu :
-- Baptiste Mahieux, Florence Houel, 2026-10-15/16 — un montant envoyé puis
-- devenu faux sans que l'équipe Égypte ne soit jamais rattrapée).
alter table clients add column if not exists montant_communique_montant numeric;
alter table clients add column if not exists montant_communique_le timestamptz;
alter table clients add column if not exists montant_communique_par_nom text;
alter table clients add column if not exists montant_communique_activite_id uuid references reservations(id) on delete set null;
alter table clients add column if not exists montant_communique_activite_nom text;

notify pgrst, 'reload schema';
