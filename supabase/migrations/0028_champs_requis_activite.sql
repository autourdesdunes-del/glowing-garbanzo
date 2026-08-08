-- Champs obligatoires par type d'activité (brief section "réservations") :
-- le Catalogue définit quels champs additionnels sont requis pour une
-- activité (pointure pour le snorkeling/plongée, créneau pour les sorties
-- coucher de soleil, conducteurs/passagers pour les quads, vol pour les
-- transferts), et l'employée ne doit pas pouvoir valider une réservation
-- tant que ces champs ne sont pas remplis.

alter table catalogue_activites
  add column if not exists champs_requis_liste text[] not null default '{}';

alter table reservations add column if not exists pointure text not null default '';
alter table reservations add column if not exists creneau text not null default '';
alter table reservations add column if not exists nb_conducteurs integer;
alter table reservations add column if not exists nb_passagers integer;
alter table reservations add column if not exists numero_vol text not null default '';
alter table reservations add column if not exists horaire_vol text not null default '';

notify pgrst, 'reload schema';
