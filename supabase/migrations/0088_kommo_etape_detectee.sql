-- Étape du dossier détectée automatiquement par l'IA à partir des messages
-- WhatsApp/Instagram (voir kommoExtraction.ts) : "Devis donné", "Programme
-- envoyé", "Infos demandées" ou "Réservé". Sert de base à la vue "dossiers
-- en attente de réponse client depuis plus de 48h" (croisée avec
-- kommo_last_client_message_at / kommo_last_team_reply_at, déjà en place
-- depuis 0027_kommo_integration.sql).

alter table clients add column if not exists kommo_etape_detectee text not null default '';

notify pgrst, 'reload schema';
