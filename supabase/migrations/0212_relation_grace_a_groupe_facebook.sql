-- Ajoute "Groupe Facebook" aux valeurs autorisées de clients.relation_
-- grace_a (demande de Mélanie le 2026-11-10) — un CHECK ne se modifie
-- pas en place, on le remplace par le même avec la valeur en plus.
alter table clients drop constraint if exists clients_relation_grace_a_check;

alter table clients add constraint clients_relation_grace_a_check
  check (relation_grace_a in (
    'Bouche à oreille','Instagram','TikTok','Influenceurs','Google','Site internet',
    'Le Petit Futé','Élodie Gossuin','VIP Mélanie','Agence de voyage','TripAdvisor',
    'ChatGPT','GetYourGuide','Groupe Facebook','Autre'
  ));
