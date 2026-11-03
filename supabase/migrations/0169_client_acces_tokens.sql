-- Compte client en lecture seule côté vitrine publique (chantier 4) — lien à
-- usage temporaire envoyé par email, complètement isolé du système
-- d'authentification de l'équipe (qui reste email+mot de passe, table
-- profiles). Cette table n'est accessible par AUCUN rôle public (anon,
-- authenticated) : uniquement via la clé service_role, utilisée seulement
-- dans deux routes serveur dédiées du projet vitrine (jamais côté
-- navigateur). Volontairement séparé de auth.users pour ne jamais toucher
-- aux règles de sécurité existantes de l'équipe sur clients/reservations.
create table if not exists client_acces_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists client_acces_tokens_client_id_idx
  on client_acces_tokens(client_id);

alter table client_acces_tokens enable row level security;
-- Aucune policy = aucun accès pour anon/authenticated, seul service_role
-- (qui contourne RLS) peut lire/écrire cette table.
