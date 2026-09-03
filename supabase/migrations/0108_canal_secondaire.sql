-- Certains clients arrivent par deux canaux à la fois (ex. WhatsApp +
-- Email, WhatsApp + Instagram) — plutôt que de convertir la colonne `canal`
-- existante en tableau (gros chantier, 7 fichiers comparent aujourd'hui
-- `canal === "X"`), un second canal optionnel suffit à couvrir ce cas réel
-- sans rien casser côté code existant.

alter table clients add column if not exists canal_secondaire text not null default '';
alter table clients add column if not exists canal_secondaire_autre text not null default '';

notify pgrst, 'reload schema';
