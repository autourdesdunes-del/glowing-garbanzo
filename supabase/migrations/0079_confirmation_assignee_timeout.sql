-- Horodatage du renvoi "Nouveau client confirmé" à quelqu'un d'autre — sert
-- à faire revenir le popup pour toute l'équipe si la personne désignée n'a
-- rien fait dans les 30 minutes (cf. NouveauClientConfirmeAlert).
alter table clients
  add column if not exists confirmation_assignee_a_le timestamptz;
