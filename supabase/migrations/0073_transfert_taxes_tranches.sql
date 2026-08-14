-- Les taxes de transfert ne sont pas un montant fixe par ville : elles
-- varient par tranche de personnes (et parfois par nombre d'adultes vs
-- enfants précisément — voir Sahl Hasheesh), avec des cas où l'agence fait
-- une remise groupe, et un cas où la personne est seule et où il faut
-- demander le montant à l'équipe plutôt que de le deviner. La table
-- (jusqu'ici vide, un simple ville→montant) est étendue pour porter ces
-- tranches, remplie avec les montants donnés par Mélanie.
alter table transfert_taxes drop constraint if exists transfert_taxes_ville_key;
alter table transfert_taxes alter column montant drop not null;
alter table transfert_taxes alter column montant drop default;
alter table transfert_taxes
  add column if not exists nb_adultes_min int,
  add column if not exists nb_adultes_max int,
  add column if not exists nb_enfants_min int,
  add column if not exists nb_enfants_max int,
  add column if not exists nb_total_min int,
  add column if not exists nb_total_max int,
  add column if not exists note text not null default '',
  add column if not exists ordre int not null default 0;

comment on table transfert_taxes is
  'Tranches de taxe de transfert par ville. Une tranche compte soit sur (nb_adultes_min/max [+ nb_enfants_min/max en filtre additionnel]), soit sur (nb_total_min/max = adultes+enfants) — les deux systèmes ne sont jamais combinés sur une même ligne. montant NULL = cas particulier (ex. voyageur seul) où le tarif doit être demandé à l''équipe, jamais deviné.';

delete from transfert_taxes;

insert into transfert_taxes (ville, nb_adultes_min, nb_adultes_max, nb_enfants_min, nb_enfants_max, montant, note, ordre) values
  ('Sahl Hasheesh', 1, 1, null, null, null, 'Personne seule — faire une demande pour connaître le montant', 0),
  ('Sahl Hasheesh', 2, 2, 0, 1, 10, '', 1),
  ('Sahl Hasheesh', 2, 2, 2, null, 15, '', 2),
  ('Sahl Hasheesh', 3, 4, null, null, 15, '', 3),
  ('Sahl Hasheesh', 5, 5, null, null, 20, 'Tarif normal 25€, remise groupe appliquée', 4),
  ('Sahl Hasheesh', 6, 6, null, null, 20, 'Tarif normal 30€, remise groupe appliquée', 5),
  ('Sahl Hasheesh', 7, 7, null, null, 20, 'Tarif normal 35€, remise groupe appliquée', 6),
  ('Sahl Hasheesh', 8, 10, null, null, 30, 'Tarif normal 40€, remise groupe appliquée', 7);

insert into transfert_taxes (ville, nb_adultes_min, nb_adultes_max, montant, note, ordre) values
  ('Makadi', 1, 1, null, 'Personne seule — faire une demande pour connaître le montant', 0),
  ('Makadi', 2, 4, 15, 'Tarif par véhicule', 1),
  ('Makadi', 5, 10, 30, 'Tarif par véhicule', 2);

insert into transfert_taxes (ville, nb_adultes_min, nb_adultes_max, montant, note, ordre) values
  ('El Gouna', 1, 1, null, 'Personne seule — faire une demande pour connaître le montant', 0),
  ('El Gouna', 2, 4, 20, '', 1),
  ('El Gouna', 5, 10, 40, '', 2);

insert into transfert_taxes (ville, nb_total_min, nb_total_max, montant, note, ordre) values
  ('Soma Bay', 1, 1, null, 'Personne seule — faire une demande pour connaître le montant', 0),
  ('Soma Bay', 2, 4, 25, '', 1),
  ('Soma Bay', 5, 10, 35, '', 2);

insert into transfert_taxes (ville, nb_total_min, nb_total_max, montant, note, ordre) values
  ('Safaga', 1, 1, null, 'Personne seule — faire une demande pour connaître le montant', 0),
  ('Safaga', 2, 4, 25, '', 1),
  ('Safaga', 5, 10, 35, '', 2);
