-- Une fois qu'un appel programmé est confirmé par l'équipe, la ligne se
-- transforme en carte compacte (même logique que les réservations
-- "Confirmée" dans la fiche client).
alter table clients
  add column if not exists prochain_appel_confirme boolean not null default false;
