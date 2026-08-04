-- "Paiement à la première activité en EGP" : le taux de conversion et le
-- montant total en EGP sont confirmés/ajustables à la main par l'employée
-- (via une fenêtre dédiée) plutôt que recalculés silencieusement à chaque
-- affichage — on les stocke donc pour rester stables une fois validés.
alter table clients
  add column if not exists egp_taux numeric not null default 0,
  add column if not exists egp_montant numeric not null default 0;
