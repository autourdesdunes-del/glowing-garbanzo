-- "Paiement acompte + règlement à l'arrivée" : un acompte unique géré comme
-- une carte (montant + mode, validé puis encaissable), distinct de la liste
-- libre "Acompte(s) à la réservation" existante.
alter table clients
  add column if not exists acompte_montant numeric not null default 0,
  add column if not exists acompte_mode text not null default 'PayPal',
  add column if not exists acompte_valide boolean not null default false,
  add column if not exists acompte_paye boolean not null default false;
