-- Chaque paiement (ajouté ou supprimé) apparaissait deux fois dans
-- l'historique — l'ancien trigger combiné "log_paiements_etapes" (AFTER
-- insert/update/delete, créé avant 0112) était resté actif en même temps
-- que les deux nouveaux triggers séparés (insert_update / delete), les
-- deux se déclenchant sur le même événement. On les redéclare tous les
-- trois proprement pour repartir d'un état net.

drop trigger if exists log_paiements_etapes on paiements_etapes;
drop trigger if exists log_paiements_etapes_insert_update on paiements_etapes;
drop trigger if exists log_paiements_etapes_delete on paiements_etapes;

create trigger log_paiements_etapes_insert_update after insert or update on paiements_etapes
  for each row execute function log_activity();
create trigger log_paiements_etapes_delete before delete on paiements_etapes
  for each row execute function log_activity();
