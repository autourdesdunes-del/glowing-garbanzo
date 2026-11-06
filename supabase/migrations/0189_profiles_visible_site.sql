-- Carte "conseillères" publique (BRIEF_MESSAGERIE.md §5, 2026-11-06) —
-- jamais les prénoms en dur dans le code : alimentée depuis profiles,
-- pour que l'équipe change l'affichage sans déploiement. photo_path vide
-- = repli monogramme (cercle plein, initiale), décision explicite de
-- Justine/Sylvie qui ne veulent pas figurer en photo sur le site public.
alter table profiles
  add column if not exists photo_path text not null default '',
  add column if not exists visible_site boolean not null default false;

-- Justine et Sylvie, confirmées par Mélanie le 2026-11-06 — les deux
-- ensemble, jamais une seule (elles ne travaillent jamais en même temps).
-- Aucune photo pour l'instant (elles ne souhaitent pas figurer en photo
-- sur le site public) : photo_path reste vide, le monogramme s'affiche.
update profiles set visible_site = true
  where id in ('072b3693-9cd2-455f-b59b-7b26c3a0a8b5', '1755bbad-62eb-4a75-b509-dda3d4dc5843');
