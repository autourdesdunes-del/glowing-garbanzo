-- Choix impératif du site visité pour les activités Le Caire (musée,
-- Saqqarah, citadelle, ou Grand Egyptian Museum) — même mécanisme que
-- champs_requis_liste / creneau pour cheval/quad (migration 0028).

alter table reservations add column if not exists site_caire text not null default '';

notify pgrst, 'reload schema';
