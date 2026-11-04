-- URL publiques lisibles (/activites/<slug>) au lieu de /activite/<uuid> —
-- nécessaire pour se positionner sur des recherches comme "excursion
-- mahmya hurghada" ou "safari quad", ce que l'uuid ne permet pas.
-- Nullable puis rempli par un script de backfill (91 fiches existantes),
-- unique pour éviter deux fiches sur la même URL.
alter table catalogue_activites
  add column slug text;

create unique index catalogue_activites_slug_key
  on catalogue_activites (slug)
  where slug is not null;
