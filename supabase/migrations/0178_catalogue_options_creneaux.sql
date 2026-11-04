-- Options supplémentaires génériques par activité (ex. "Spa privé"),
-- remplace à terme supplement_solo_actif/prix et guide_supplement/prix
-- qui restent en place pour compat mais ne sont plus la seule façon
-- d'ajouter une option payante.
-- Forme : [{ "nom": "...", "description": "...", "prix": 15, "unite": "par_personne" | "par_groupe" }]
alter table catalogue_activites
  add column options_supplementaires jsonb not null default '[]'::jsonb;

-- Créneaux horaires proposés au client pour cette activité (sous-ensemble
-- de "Matin" / "Début d'après-midi" / "Fin d'après-midi") — n'a de sens
-- que si "Créneau souhaité" figure dans champs_requis_liste.
alter table catalogue_activites
  add column creneaux_disponibles text[] not null default '{}';
