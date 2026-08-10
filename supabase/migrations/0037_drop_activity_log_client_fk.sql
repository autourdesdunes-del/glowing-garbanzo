-- Root cause of 0035/0036 not actually fixing deletion : la FK sur
-- activity_log.client_id ne peut JAMAIS être satisfaite quand on
-- enregistre une action 'delete' pour un client (ou tout ce qui est
-- supprimé en cascade avec lui), car par définition la ligne client
-- référencée a déjà disparu au moment où on essaie d'enregistrer qu'elle a
-- été supprimée — aucun réglage de timing de trigger ne change ça une
-- fois que le mécanisme de cascade de Postgres retire d'abord la ligne
-- parente, puis cascade vers les enfants (reservations, paiements,
-- remboursements), dont les propres insertions de log référencent alors
-- un client_id déjà parti. Le but même d'un journal d'audit est de
-- survivre aux données qu'il décrit, il ne devrait donc pas imposer
-- l'intégrité référentielle contre des lignes encore vivantes. On
-- supprime la FK ; client_id reste un uuid (nullable) simple.
alter table activity_log drop constraint if exists activity_log_client_id_fkey;

