-- Cheval / chameau : pour chaque enfant participant, l'équipe précise s'il
-- monte seul (son propre animal) ou derrière un adulte (accompagnateur) —
-- une réponse par enfant, pas une seule réponse pour tous.
alter table reservations add column if not exists enfants_monte text[] not null default '{}';

notify pgrst, 'reload schema';
