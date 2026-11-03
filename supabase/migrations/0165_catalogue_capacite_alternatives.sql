-- Capacité physique par réservation (ex. Buggy = 2 places) et suggestions
-- d'alternative quand le groupe du client la dépasse — affiché côté vitrine
-- publique pour éviter qu'un client réserve 4 adultes sur un véhicule à 2
-- places sans le savoir.
alter table catalogue_activites
  add column capacite_max_personnes integer,
  add column activite_alternative_id uuid references catalogue_activites(id),
  add column activite_complement_id uuid references catalogue_activites(id);

comment on column catalogue_activites.capacite_max_personnes is
  'Nombre max d''adultes + enfants pour une réservation (bébés non comptés) ; null = pas de limite physique.';
comment on column catalogue_activites.activite_alternative_id is
  'Activité à proposer en remplacement si le groupe dépasse la capacité (ex. Buggy -> Safari Buggy Famille).';
comment on column catalogue_activites.activite_complement_id is
  'Activité à proposer en complément pour la partie du groupe en trop (ex. Buggy -> Safari quad).';
