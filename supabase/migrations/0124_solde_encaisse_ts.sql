-- Horodatage exact (date + heure) de l'encaissement du solde en PayPal —
-- même principe que acompte_encaisse_ts. solde_date reste une simple date
-- pour l'affichage/tri existant.
alter table clients add column if not exists solde_encaisse_ts timestamptz;

notify pgrst, 'reload schema';
