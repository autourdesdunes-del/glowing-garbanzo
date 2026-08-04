-- Tags libres par activité (ex. "Activités en mer", "Activités désert",
-- "Activités Le Caire") pour trier/filtrer le catalogue par thème,
-- indépendamment de la catégorie (Excursion/Transfert/…).

alter table catalogue_activites
  add column if not exists tags text[] not null default '{}';
