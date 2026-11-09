-- BRIEF_COMPTE_CLIENT.md étape 3 — fusion du jeton anonyme vers le compte.
-- `favoris` et `messagerie_conversations` restent indexées par `jeton`
-- (texte, navigateur) ; on y ajoute `compte_id` pour pouvoir, une fois la
-- visiteuse connectée, continuer à retrouver ces lignes même si elle
-- change d'appareil ou vide son stockage local. Le rapatriement lui-même
-- (UPDATE ... SET compte_id) se fait côté API au moment de la connexion
-- (/api/compte/fusionner), pas ici — cette migration ne pose que la
-- colonne.
alter table favoris
  add column if not exists compte_id uuid references comptes_clients(id) on delete set null;

alter table messagerie_conversations
  add column if not exists compte_id uuid references comptes_clients(id) on delete set null;

create index if not exists favoris_compte_id_idx on favoris (compte_id) where compte_id is not null;
create index if not exists messagerie_conversations_compte_id_idx
  on messagerie_conversations (compte_id) where compte_id is not null;
