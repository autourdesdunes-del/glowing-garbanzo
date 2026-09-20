-- Copie de secours automatique vers Notion (Mélanie, 2026-09-20) : un job
-- planifié pousse chaque client modifié vers la base Notion "nouvel essai
-- bdd client 1", pour garder Notion à jour en cas de problème sur le CRM.
-- notion_page_id mémorise la page Notion déjà créée pour ce client (évite
-- les doublons à chaque exécution) ; notion_synced_at n'est plus utilisé
-- pour filtrer (le job se base sur updated_at + une fenêtre de sécurité),
-- gardé uniquement à titre d'information/diagnostic.
alter table clients
  add column if not exists notion_page_id text,
  add column if not exists notion_synced_at timestamptz;
