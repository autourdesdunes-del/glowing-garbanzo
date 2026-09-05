-- Pseudo Instagram/TikTok du second canal (canal_secondaire) — jusqu'ici
-- seul pseudo_contact (canal principal) existait, donc impossible de
-- renseigner le pseudo quand le canal secondaire était Instagram/TikTok.
alter table clients
  add column if not exists pseudo_contact_secondaire text not null default '';

notify pgrst, 'reload schema';
