-- BRIEF_MESSAGERIE.md, section "Chaque réponse doit proposer une suite"
-- (2026-11-06) : chaque nœud porte sa propre liste de suites — un réseau,
-- pas une arborescence. Remplace le "Oui, merci / Non" systématique par
-- 2-3 questions pertinentes après la réponse (voir ArbreAide.tsx).
alter table arbre_noeuds
  add column if not exists suites uuid[] not null default '{}';

-- Catégorie "Préparer son voyage" — treize réponses validées par Mélanie
-- le 2026-11-06, insérées telles quelles (ne pas les reformuler).
insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000070', null, 'Préparer son voyage', 'menu', '', '', 7)
on conflict (id) do nothing;

insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000071', 'a0000000-0000-0000-0000-000000000070',
   'Quelle est la meilleure période pour venir ?', 'texte', '',
   'Hurghada se visite toute l''année, il y a du soleil même en janvier. Nos périodes préférées sont le printemps et l''automne : il fait bon pour la mer, et c''est encore supportable au Caire et à Louxor. En plein été la mer Rouge reste parfaite, mais les journées à Louxor sont très chaudes, cela dépend de si vous supportez facilement la chaleur ou pas 😊',
   1),
  ('a0000000-0000-0000-0000-000000000072', 'a0000000-0000-0000-0000-000000000070',
   'Quels mois exactement ?', 'texte', '',
   'Nos deux meilleures fenêtres : mars à mai, et septembre à novembre. Décembre à février reste très agréable pour Le Caire et Louxor, avec une mer un peu plus fraîche. Juin à août, la mer Rouge est parfaite mais les sites de Haute-Égypte sont écrasants.',
   2),
  ('a0000000-0000-0000-0000-000000000073', 'a0000000-0000-0000-0000-000000000070',
   'Et les températures ?', 'texte', '',
   'À Hurghada il fait beau toute l''année. En plein hiver, comptez 22 à 25 °C en journée et une mer autour de 22 °C — on s''y baigne encore. L''été monte à 35-37 °C avec une mer à 28-29 °C. Le printemps et l''automne sont le meilleur compromis : 26 à 32 °C dehors, 24 à 27 °C dans l''eau.',
   3),
  ('a0000000-0000-0000-0000-000000000074', 'a0000000-0000-0000-0000-000000000070',
   'Faut-il un visa ? Quelles formalités ?', 'texte', '',
   'Oui, un visa est nécessaire. Il se prend à l''arrivée à l''aéroport de Hurghada ou en ligne avant le départ, et coûte 30 € par personne, enfants compris. Prévoyez de le régler en espèces à l''arrivée, c''est le plus simple.',
   4),
  -- Pose la nationalité avant de répondre : les règles diffèrent selon le
  -- passeport. Trois réponses distinctes (FR/BE/CH), escalade pour toute
  -- autre nationalité — ne jamais extrapoler une règle d'entrée sur le
  -- territoire à partir d'une autre nationalité.
  ('a0000000-0000-0000-0000-000000000075', 'a0000000-0000-0000-0000-000000000070',
   'Et si je n''ai pas de passeport ?', 'interactif', 'sans_passeport', '',
   5),
  ('a0000000-0000-0000-0000-000000000076', 'a0000000-0000-0000-0000-000000000070',
   'Quelle monnaie prévoir ? Les euros sont-ils acceptés ?', 'texte', '',
   'La monnaie locale est la livre égyptienne pour le quotidien, mais prévoyez aussi des euros : c''est en euros que se règle le solde de vos activités avec nous. Pour le reste, mieux vaut retirer des livres sur place (distributeurs à Hurghada) que changer des euros, le taux est rarement intéressant. Gardez quelques petites coupures pour les pourboires 😊',
   6),
  ('a0000000-0000-0000-0000-000000000077', 'a0000000-0000-0000-0000-000000000070',
   'Les pourboires, combien ?', 'texte', '',
   'Les pourboires font partie des usages en Égypte, mais ils ne sont jamais obligatoires — c''est vous qui voyez, selon ce que vous aurez pensé de la journée. Si ça peut vous aider : pour le chauffeur, on donne plutôt pour le groupe, comptez 5 à 7 € sur une demi-journée. Pour le guide c''est plutôt par personne, autour de 3 € chacun sur une journée complète 😊',
   7),
  -- Donnée, pas texte : dépend de l'activité (haute_saison_* côté
  -- catalogue), donc seulement résoluble depuis une fiche.
  ('a0000000-0000-0000-0000-000000000078', 'a0000000-0000-0000-0000-000000000070',
   'Les prix changent-ils selon la saison ?', 'donnee', 'hauteSaison', '',
   8)
on conflict (id) do nothing;

-- Suites — "n'en afficher que trois" (brief), le réseau pointe où c'est
-- pertinent, pas seulement vers les nœuds frères.
update arbre_noeuds set suites = array[
  'a0000000-0000-0000-0000-000000000072'::uuid,
  'a0000000-0000-0000-0000-000000000073'::uuid,
  'a0000000-0000-0000-0000-000000000078'::uuid
] where id = 'a0000000-0000-0000-0000-000000000071'; -- meilleure période

update arbre_noeuds set suites = array[
  'a0000000-0000-0000-0000-000000000073'::uuid,
  'a0000000-0000-0000-0000-000000000071'::uuid
] where id = 'a0000000-0000-0000-0000-000000000072'; -- quels mois

update arbre_noeuds set suites = array[
  'a0000000-0000-0000-0000-000000000071'::uuid,
  'a0000000-0000-0000-0000-000000000072'::uuid
] where id = 'a0000000-0000-0000-0000-000000000073'; -- températures

update arbre_noeuds set suites = array[
  'a0000000-0000-0000-0000-000000000075'::uuid,
  'a0000000-0000-0000-0000-000000000076'::uuid,
  'a0000000-0000-0000-0000-000000000050'::uuid -- planning_sejour ("Aidez-moi à organiser mon séjour")
] where id = 'a0000000-0000-0000-0000-000000000074'; -- visa

update arbre_noeuds set suites = array[
  'a0000000-0000-0000-0000-000000000077'::uuid,
  'a0000000-0000-0000-0000-000000000074'::uuid
] where id = 'a0000000-0000-0000-0000-000000000076'; -- monnaie

update arbre_noeuds set suites = array[
  'a0000000-0000-0000-0000-000000000076'::uuid,
  'a0000000-0000-0000-0000-000000000074'::uuid
] where id = 'a0000000-0000-0000-0000-000000000077'; -- pourboires
