-- Le Catalogue permet désormais d'ajouter des champs obligatoires
-- personnalisés en plus des 4 champs préréglés (Pointure, Créneau,
-- Conducteurs & passagers, Vol & horaire). Ces champs personnalisés n'ont
-- pas de saisie dédiée dans ReservationCard — ils bloquent la validation
-- via une simple case à cocher que l'employée coche manuellement.

alter table reservations
  add column if not exists champs_requis_coches text[] not null default '{}';

notify pgrst, 'reload schema';

