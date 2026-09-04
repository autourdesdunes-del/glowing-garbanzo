-- Note libre facultative sur un avoir : où il a été utilisé (ex. "25 € sur
-- le transfert hôtel Sheraton"). Purement manuel, affiché sur la carte de
-- l'activité annulée qui a généré l'avoir quand le champ est renseigné.
alter table avoirs add column if not exists utilise_sur text not null default '';
