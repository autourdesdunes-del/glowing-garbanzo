-- Correction : la première version de cette migration échouait — 25
-- fiches utilisent déjà "Groupe Facebook" (la colonne n'était donc déjà
-- plus limitée aux 13 valeurs d'origine en pratique) et 482 fiches ont
-- relation_grace_a = '' (jamais renseigné). Le nouveau check doit
-- couvrir ce qui existe réellement en base, pas seulement la liste
-- d'origine de 0001_init.sql.
alter table clients drop constraint if exists clients_relation_grace_a_check;

alter table clients add constraint clients_relation_grace_a_check
  check (relation_grace_a in (
    '','Bouche à oreille','Instagram','TikTok','Influenceurs','Google','Site internet',
    'Le Petit Futé','Élodie Gossuin','VIP Mélanie','Agence de voyage','TripAdvisor',
    'ChatGPT','GetYourGuide','Groupe Facebook','Autre'
  ));
