-- Tarif enfant 3 ans (ex. "Le Caire en avion") : jusqu'ici ce tarif était
-- détourné dans le champ "accompagnateur", ce qui n'était pas clair. On lui
-- donne son propre champ, et on migre les données déjà en place.

alter table catalogue_activites
  add column if not exists pu_enfant_3ans numeric not null default 0;

alter table reservations
  add column if not exists pu_enfant_3ans numeric not null default 0;
alter table reservations
  add column if not exists participants_enfants_3ans integer not null default 0;

update catalogue_activites
  set pu_enfant_3ans = pu_accompagnateur,
      pu_accompagnateur = 0
  where nom ilike '%caire%avion%' and pu_accompagnateur > 0;

notify pgrst, 'reload schema';

