-- Quand un lead Kommo bascule "Réservé" (nouvelle confirmation, pas un
-- simple re-sync), le CRM le marque "à traiter" pour que l'équipe voie
-- une pop-up bloquante tant que la fiche n'a pas été complétée à la main
-- (infos hôtel/dates/activités réelles) — cf. NouveauClientConfirmeAlert
-- côté app, et /api/kommo/webhook + /api/cron/kommo-reconcile côté serveur.
alter table clients
  add column if not exists confirmation_a_traiter boolean not null default false;

-- Nom de la personne à qui la fiche a été renvoyée pour traitement (liste
-- libre, même esprit que solde_assigne_a) — n'efface pas confirmation_a_traiter,
-- sert seulement à indiquer qui s'en occupe.
alter table clients
  add column if not exists confirmation_assignee_a text;
