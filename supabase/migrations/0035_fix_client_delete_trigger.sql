-- La suppression d'un client échouait toujours : le trigger log_activity
-- tournait AFTER DELETE et tentait d'insérer dans activity_log une ligne
-- référençant client_id = old.id, mais la ligne clients venait déjà d'être
-- supprimée — la contrainte de clé étrangère la rejetait et annulait toute
-- la suppression (l'UI l'affichait comme supprimée en local, mais elle
-- revenait au prochain chargement). On sépare le trigger clients en deux :
-- AFTER pour insert/update (comportement inchangé), BEFORE pour delete
-- (la ligne existe encore au moment de l'insertion dans activity_log).
drop trigger if exists log_clients on clients;

create trigger log_clients_insert_update after insert or update on clients
  for each row execute function log_activity();

create trigger log_clients_delete before delete on clients
  for each row execute function log_activity();

