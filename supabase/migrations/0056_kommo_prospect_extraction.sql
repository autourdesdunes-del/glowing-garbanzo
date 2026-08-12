-- Fiche prospect enrichie automatiquement à partir de la conversation Kommo
-- (WhatsApp/Instagram) : au lieu de dupliquer les messages eux-mêmes dans
-- Supabase (Kommo reste le seul endroit où on lit/écrit la messagerie, cf.
-- 0027_kommo_integration.sql), on stocke uniquement l'état structuré déduit
-- par l'IA à chaque nouveau message — dates de séjour, hôtel, PAX, âges
-- enfants/ados, résumé de la demande, activités qui intéressent le
-- prospect. Ces champs restent vides tant que l'info n'a pas été donnée.

alter table clients add column if not exists kommo_resume text not null default '';
alter table clients add column if not exists kommo_sejour_debut_estime date;
alter table clients add column if not exists kommo_sejour_fin_estime date;
alter table clients add column if not exists kommo_hotel_estime text not null default '';
alter table clients add column if not exists kommo_nb_adultes_estime int;
alter table clients add column if not exists kommo_nb_enfants_estime int;
alter table clients add column if not exists kommo_ages_enfants_estime text not null default '';
alter table clients add column if not exists kommo_activites_interet text not null default '';
alter table clients add column if not exists kommo_extraction_updated_at timestamptz;

notify pgrst, 'reload schema';
