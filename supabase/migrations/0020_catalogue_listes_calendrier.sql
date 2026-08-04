-- "Non inclus" et "à prévoir" passent en listes à sélectionner (comme
-- "inclus"), et "prochaine disponibilité" devient un vrai calendrier :
-- prochaines_dispo_dates stocke les dates précises confirmées (affichées en
-- vert), en plus du motif hebdomadaire déjà en place (jours_disponibles,
-- affiché en bleu, calculé à la volée).

alter table catalogue_activites
  add column if not exists non_inclus_liste text[] not null default '{}',
  add column if not exists a_prevoir_liste text[] not null default '{}',
  add column if not exists prochaines_dispo_dates date[] not null default '{}';
