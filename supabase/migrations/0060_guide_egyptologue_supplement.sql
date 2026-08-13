-- Ajoute au catalogue deux nouveaux champs pour la partie "Guide" :
-- un toggle "Guide francophone égyptologue" (distinct de la langue du guide
-- déjà existante) et une option "Guide en supplément" avec son propre tarif.

alter table catalogue_activites add column if not exists guide_egyptologue boolean not null default false;
alter table catalogue_activites add column if not exists guide_supplement boolean not null default false;
alter table catalogue_activites add column if not exists guide_supplement_prix numeric not null default 0;

notify pgrst, 'reload schema';
