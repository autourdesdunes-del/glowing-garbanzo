-- Prochain appel programmé : en plus de la date/heure existantes, il faut
-- savoir sur quel fuseau se cale l'heure saisie (France ou Égypte, souvent
-- décalées) et sur quelle plateforme l'appel a lieu.
alter table clients
  add column if not exists prochain_appel_fuseau text not null default 'france',
  add column if not exists prochain_appel_plateforme text not null default '';
