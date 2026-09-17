-- Troisième canal optionnel — certains clients arrivent par trois canaux à
-- la fois (ex. WhatsApp + Email + Instagram), au-delà des deux déjà permis
-- par canal/canal_secondaire. Même structure que canal_secondaire (demande
-- de Mélanie du 17/09).
alter table clients
  add column if not exists canal_tertiaire text not null default '',
  add column if not exists canal_tertiaire_autre text not null default '',
  add column if not exists pseudo_contact_tertiaire text not null default '';
