-- Montant réellement reçu pour le solde (peut différer de ce qui était
-- attendu — frais PayPal notamment) + oubli "Entre proches" associé, sur le
-- même principe que acompte_montant/acompte_entre_proches_oublie.
alter table clients add column if not exists solde_montant_recu numeric not null default 0;
alter table clients add column if not exists solde_entre_proches_oublie boolean not null default false;
