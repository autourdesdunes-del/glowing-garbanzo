-- Option "2ème île" (speedboat privé) : le client peut ajouter une seconde
-- île à sa formule — ce champ garde ce choix distinct de la première île
-- (ile_selectionnee), et alimente le titre affiché.
alter table reservations add column if not exists ile_selectionnee_2 text not null default '';
