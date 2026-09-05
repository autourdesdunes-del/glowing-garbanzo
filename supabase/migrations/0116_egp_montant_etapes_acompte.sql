-- Montant EGP par étape de paiement (résumé des paiements) + montant EGP
-- de l'acompte quand il est réglé en espèces égyptiennes.
alter table paiements_etapes add column if not exists montant_egp numeric not null default 0;
alter table clients add column if not exists acompte_egp_montant numeric not null default 0;
