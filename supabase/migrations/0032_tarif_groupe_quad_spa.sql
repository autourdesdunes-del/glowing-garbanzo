-- Forfait groupe (ex. speedboat, yacht) : le prix n'est pas par personne
-- mais un forfait de base pour un nombre de personnes inclus, plus un tarif
-- par personne supplémentaire (jusqu'à 2 paliers) et par enfant
-- supplémentaire. tarif_mode bascule entre l'ancien calcul "par personne"
-- et ce nouveau calcul "forfait".

alter table catalogue_activites
  add column if not exists tarif_mode text not null default 'personne';
alter table catalogue_activites
  add column if not exists prix_groupe_base numeric not null default 0;
alter table catalogue_activites
  add column if not exists prix_groupe_base_pax integer not null default 0;
alter table catalogue_activites
  add column if not exists prix_groupe_extra1 numeric not null default 0;
alter table catalogue_activites
  add column if not exists prix_groupe_extra2 numeric not null default 0;
alter table catalogue_activites
  add column if not exists prix_groupe_extra_enfant numeric not null default 0;

alter table reservations
  add column if not exists tarif_mode text not null default 'personne';
alter table reservations
  add column if not exists prix_groupe_base numeric not null default 0;
alter table reservations
  add column if not exists prix_groupe_extra1 numeric not null default 0;
alter table reservations
  add column if not exists prix_groupe_extra2 numeric not null default 0;
alter table reservations
  add column if not exists prix_groupe_extra_enfant numeric not null default 0;
alter table reservations
  add column if not exists participants_extra1 integer not null default 0;
alter table reservations
  add column if not exists participants_extra2 integer not null default 0;
alter table reservations
  add column if not exists participants_extra_enfants integer not null default 0;

notify pgrst, 'reload schema';

