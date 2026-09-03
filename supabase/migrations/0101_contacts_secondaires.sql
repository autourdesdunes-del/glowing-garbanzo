-- Certains clients communiquent depuis un deuxième numéro WhatsApp, pseudo
-- Instagram/TikTok ou email (ex. couple qui alterne, numéro/compte
-- secondaire) — jamais obligatoire, juste une info de contact
-- supplémentaire à côté du contact principal.
alter table clients
  add column if not exists telephone_2 text not null default '',
  add column if not exists pseudo_contact_2 text not null default '',
  add column if not exists email_2 text not null default '';

notify pgrst, 'reload schema';
