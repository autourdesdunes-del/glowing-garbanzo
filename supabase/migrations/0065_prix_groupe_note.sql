-- Note libre affichée à la place de "0€"/"Sur demande" quand le forfait
-- groupe n'a pas de prix fixe (ex. Safari Mix Quad/Buggy : 25€/quad,
-- 110€/buggy selon le nombre choisi).

alter table catalogue_activites add column if not exists prix_groupe_note text not null default '';

notify pgrst, 'reload schema';
