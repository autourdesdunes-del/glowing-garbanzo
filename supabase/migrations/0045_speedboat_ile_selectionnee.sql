-- L'île choisie pour les formules speedboat privé "journée complète avec 1
-- île" et "demi-journée avec 1 île" — pilote le titre affiché et le
-- supplément automatique Oziréa (+30€/adulte, +15€/enfant) côté frontend.
alter table reservations add column if not exists ile_selectionnee text not null default '';
