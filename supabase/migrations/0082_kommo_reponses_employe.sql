-- Temps de réponse par employée côté Kommo — chaque employée a son propre
-- compte Kommo (confirmé le 15/08/2026), donc l'API Kommo peut attribuer
-- chaque message sortant à la bonne personne via son "created_by".
--
-- kommo_user_id mappe le compte Kommo de chaque employée à son profil CRM.
-- Valeurs figées pour ce compte Kommo précis (Réglages > Utilisateurs) —
-- à corriger à la main si un compte est recréé/renommé :
--   Sylvie   -> 15677419
--   Laura    -> 15680027
--   Justine  -> 15680035
-- (Mélanie/Hossam utilisent le compte partagé "Autour des dunes"
-- 15660491, non mappé ici : le rapport par employée ne concerne que
-- l'équipe, pas la Direction.)
alter table profiles add column if not exists kommo_user_id bigint;

update profiles set kommo_user_id = 15677419 where lower(trim(prenom)) = 'sylvie' and kommo_user_id is null;
update profiles set kommo_user_id = 15680027 where lower(trim(prenom)) = 'laura' and kommo_user_id is null;
update profiles set kommo_user_id = 15680035 where lower(trim(prenom)) = 'justine' and kommo_user_id is null;

-- Un enregistrement par échange apparié (message entrant suivi du prochain
-- message sortant) — calculé par le cron, jamais en direct depuis le
-- navigateur (limite Kommo : 7 requêtes/s). kommo_event_id (celui du
-- message SORTANT) sert de clé de dédup pour ne jamais recompter le même
-- échange deux fois d'un run à l'autre (le cron relit toujours les
-- dernières 48h par sécurité).
create table if not exists kommo_reponses_employe (
  id uuid primary key default gen_random_uuid(),
  kommo_event_id text not null unique,
  client_id uuid references clients(id) on delete set null,
  kommo_lead_id bigint not null,
  kommo_user_id bigint not null,
  employe_id uuid references auth.users(id) on delete set null,
  employe_nom text not null default '',
  message_client_at timestamptz not null,
  reponse_at timestamptz not null,
  delai_secondes integer not null,
  created_at timestamptz not null default now()
);

create index if not exists kommo_reponses_employe_employe_idx on kommo_reponses_employe (employe_id);

alter table kommo_reponses_employe enable row level security;
create policy "team read kommo reponses" on kommo_reponses_employe
  for select to authenticated using (true);

notify pgrst, 'reload schema';
