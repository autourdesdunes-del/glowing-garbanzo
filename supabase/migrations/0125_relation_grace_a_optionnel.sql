-- "Relation grâce à" ne doit plus être présélectionné sur "Instagram" par
-- défaut (un nouveau client vide, si l'employée oublie de le renseigner,
-- se comptait silencieusement comme un lead Instagram et faussait les
-- statistiques d'acquisition — voir infosManquantes.ts, où ce champ vide
-- est désormais signalé comme info manquante, comme Hôtel ou Passeport).
--
-- URGENT : sans cette migration, la création de client échoue en
-- production (contrainte clients_relation_grace_a_check qui n'autorise pas
-- la chaîne vide '' — l'app envoie déjà relation_grace_a: "" par défaut
-- depuis le dernier déploiement).

alter table clients
  drop constraint if exists clients_relation_grace_a_check;

alter table clients
  add constraint clients_relation_grace_a_check
  check (relation_grace_a in (
    '', 'Bouche à oreille','Instagram','TikTok','Groupe Facebook','Influenceurs','Google','Site internet',
    'Le Petit Futé','Élodie Gossuin','VIP Mélanie','Agence de voyage','TripAdvisor',
    'ChatGPT','GetYourGuide','Autre'
  ));

alter table clients
  alter column relation_grace_a set default '';
