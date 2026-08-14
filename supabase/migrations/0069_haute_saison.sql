-- Tarif haute saison par activité (ex. croisières Nil : 20 décembre au 7
-- janvier) — période récurrente chaque année, définie en jour/mois (MM-DD),
-- avec un tarif adulte/enfant dédié qui remplace le tarif normal quand la
-- date de l'activité tombe dans cette période.

alter table catalogue_activites add column if not exists haute_saison_debut text not null default '';
alter table catalogue_activites add column if not exists haute_saison_fin text not null default '';
alter table catalogue_activites add column if not exists haute_saison_pu_adulte numeric not null default 0;
alter table catalogue_activites add column if not exists haute_saison_pu_enfant numeric not null default 0;

notify pgrst, 'reload schema';
