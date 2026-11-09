-- BRIEF_COMPTE_CLIENT.md étape 4 — deux ajustements avant de brancher la
-- fiche/l'arbre/le tunnel sur le profil :
--
-- 1. `jeton_hotel` gagne les dates du séjour et la composition complète
--    (enfants, bébés — `personnes` ne couvrait que les adultes), pour la
--    même raison que l'hôtel (migration 0202) : le tunnel et le nœud
--    `planning_sejour` de l'arbre les redemandent à chaque fois alors
--    qu'ils sont déjà connus une fois saisis une première fois.
alter table jeton_hotel
  add column if not exists date_debut date,
  add column if not exists date_fin date,
  add column if not exists enfants integer not null default 0,
  add column if not exists bebes integer not null default 0;

-- 2. `profils_clients.enfants_ages` (migration 0204) supposait un âge par
--    enfant, mais rien dans l'appli ne collecte cet âge aujourd'hui — le
--    tunnel ne connaît qu'un nombre d'enfants (`pu_enfant_age` n'est qu'un
--    texte affiché, jamais une saisie). Stocker des âges inventés serait
--    une donnée fausse ; un compteur, comme pour les adultes et les
--    bébés, correspond à ce que l'appli sait réellement.
alter table profils_clients
  add column if not exists enfants integer not null default 0;

update profils_clients set enfants = coalesce(array_length(enfants_ages, 1), 0) where enfants = 0;

alter table profils_clients drop column if exists enfants_ages;
