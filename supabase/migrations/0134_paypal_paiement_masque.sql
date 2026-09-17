alter table paypal_paiements
  add column if not exists masque boolean not null default false;
