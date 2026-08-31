-- Hébergement en Airbnb plutôt qu'à l'hôtel : remplace la ligne
-- Hôtel/Chambre par Airbnb + adresse/GPS + appartement/bâtiment.
alter table clients
  add column if not exists type_hebergement text not null default 'hotel',
  add column if not exists airbnb_adresse text not null default '',
  add column if not exists airbnb_appartement text not null default '',
  add column if not exists airbnb_building text not null default '';
