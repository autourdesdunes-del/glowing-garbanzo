-- Le billet d'avion ne tenait qu'un seul fichier (billet_lien) — insuffisant
-- quand il y a plusieurs billets/photos à joindre pour une même activité.
-- Nouvelle colonne tableau, backfillée avec l'éventuel billet_lien existant.
alter table reservations add column if not exists billet_liens text[] not null default '{}';

update reservations
set billet_liens = array[billet_lien]
where billet_lien is not null and billet_lien != '' and billet_liens = '{}';

notify pgrst, 'reload schema';
