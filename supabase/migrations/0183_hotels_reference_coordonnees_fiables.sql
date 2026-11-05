-- 4 hôtels dont Google a renvoyé des coordonnées en doublon (même point
-- pour plusieurs établissements distincts) ou clairement erronées — voir
-- Mélanie, 2026-11-05 (164 m d'un hôtel de Makadi Bay pour Funday
-- Aquapark, qui est en réalité à Hurghada ; 3 hôtels de zones différentes
-- au même point exact pour Ajira Boutique hotel/Ajira Resort/Zen Resort).
-- Un hôtel non fiable reste cherchable par nom (hotels_reference_nom_*)
-- mais est exclu du référentiel de classement géographique (lib/geo.ts
-- côté vitrine), sinon il fausserait la zone de tout hôtel inconnu aux
-- alentours.
alter table hotels_reference
  add column if not exists coordonnees_fiables boolean not null default true;

update hotels_reference
set coordonnees_fiables = false
where nom in ('Ajira Boutique hotel', 'Ajira Resort', 'Zen Resort', 'Funday Aquapark');
