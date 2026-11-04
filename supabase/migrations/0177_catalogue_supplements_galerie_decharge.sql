-- Suppléments par zone d'hôtel (zone -> montant en €), remplis à la main
-- par l'équipe une fois le vrai barème communiqué — vide = rien affiché
-- côté public, jamais de valeur inventée.
alter table catalogue_activites
  add column supplements_zones jsonb not null default '{}'::jsonb;

-- Plusieurs photos par activité pour le carrousel vitrine — photo_path
-- reste la photo de couverture (compat avec l'existant), galerie contient
-- les photos supplémentaires dans l'ordre d'affichage.
alter table catalogue_activites
  add column galerie text[] not null default '{}';

-- Décharge de responsabilité à signer sur place (ex. sports à risque) —
-- simple drapeau par activité, pas d'assurance annulation (décision du
-- 2026-11-04 : pas de politique d'assurance annulation chez nous).
alter table catalogue_activites
  add column decharge_requise boolean not null default false;
