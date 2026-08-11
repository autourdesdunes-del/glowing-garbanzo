-- Tarif "accompagnateur" (ex. plongée : personne qui ne plonge pas mais
-- fait du snorkeling en accompagnement) : un vrai 4e palier de tarif au
-- même titre qu'adulte/enfant/bébé, pas une note en texte libre.

alter table catalogue_activites
  add column if not exists pu_accompagnateur numeric not null default 0;
alter table catalogue_activites
  add column if not exists pu_accompagnateur_age text not null default '';

alter table reservations
  add column if not exists pu_accompagnateur numeric not null default 0;
alter table reservations
  add column if not exists participants_accompagnateurs integer not null default 0;

notify pgrst, 'reload schema';
