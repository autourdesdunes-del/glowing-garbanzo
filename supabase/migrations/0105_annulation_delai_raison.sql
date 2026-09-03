-- Trace le résultat du calcul de délai d'annulation (ex. "Annulé à 24h ou
-- plus — remboursable" / "Annulé à moins de 48h — non remboursable")
-- au moment exact de l'annulation, pour l'afficher ensuite sur le
-- remboursement/avoir sans le recalculer avec une date qui a changé.
alter table reservations
  add column if not exists annulation_delai_raison text not null default '';

notify pgrst, 'reload schema';
