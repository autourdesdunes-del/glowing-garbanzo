-- Date du tout premier échange (dans un sens ou l'autre) avec un prospect,
-- posée une seule fois. Les dates de dernier échange existent déjà
-- (kommo_last_client_message_at / kommo_last_team_reply_at, migration
-- 0027) mais n'étaient jamais alimentées — corrigé dans
-- /api/kommo/message/route.ts en même temps que ce champ.

alter table clients add column if not exists kommo_premier_echange_le timestamptz;

notify pgrst, 'reload schema';
