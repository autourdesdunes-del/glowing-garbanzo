-- Nouveau mode de règlement du solde "à la première activité, mixte € +
-- EGP" (ex. 200€ en cash + 1200 EGP en cash, à la même activité) — jusqu'ici
-- seuls "en €" ou "en EGP" existaient séparément, aucun ne couvrait un
-- règlement réparti sur les deux devises. Deux montants indépendants (pas
-- liés par un taux de change comme egp_taux/egp_montant) puisque c'est le
-- client qui choisit la répartition, pas une simple conversion.

alter table clients
  add column if not exists solde_mixte_eur numeric not null default 0,
  add column if not exists solde_mixte_egp numeric not null default 0;
