-- Le correctif précédent (0035) ne couvrait que la suppression directe
-- d'un client. Mais supprimer un client dont le dossier contient des
-- réservations, paiements ou remboursements cascade AUTOMATIQUEMENT sur
-- ces tables (on delete cascade) — et leurs propres triggers log_activity
-- tournaient encore AFTER DELETE, avec le même problème : au moment où le
-- trigger insère dans activity_log (client_id = old.client_id), la ligne
-- clients parente est déjà partie, la contrainte de clé étrangère rejette
-- l'insertion et annule TOUTE la suppression en cascade. En pratique, ça
-- bloquait la suppression de quasi tous les clients réels (ceux qui ont au
-- moins une activité, un paiement ou un remboursement enregistré).
drop trigger if exists log_reservations on reservations;
create trigger log_reservations_insert_update after insert or update on reservations
  for each row execute function log_activity();
create trigger log_reservations_delete before delete on reservations
  for each row execute function log_activity();

drop trigger if exists log_paiements on paiements;
create trigger log_paiements_insert_update after insert or update on paiements
  for each row execute function log_activity();
create trigger log_paiements_delete before delete on paiements
  for each row execute function log_activity();

drop trigger if exists log_remboursements on remboursements;
create trigger log_remboursements_insert_update after insert or update on remboursements
  for each row execute function log_activity();
create trigger log_remboursements_delete before delete on remboursements
  for each row execute function log_activity();

