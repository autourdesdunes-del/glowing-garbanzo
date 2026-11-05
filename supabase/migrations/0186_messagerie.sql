-- Messagerie : escalade depuis l'arbre d'aide quand le client ne trouve pas
-- sa réponse (BRIEF_MESSAGERIE.md) — jamais de cul-de-sac. Une conversation
-- par escalade, rattachée au client si on la connaît (espace client) ou à
-- des coordonnées saisies à la volée (visiteur anonyme sur une fiche).
create table if not exists messagerie_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  nom text not null default '',
  email text not null default '',
  telephone text not null default '',
  catalogue_item_id uuid references catalogue_activites(id) on delete set null,
  -- "A consulté : Transferts → Horaire de prise en charge" — pour que
  -- l'équipe ne repose pas une question déjà tentée par le client.
  chemin_parcouru text not null default '',
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'traitee')),
  created_at timestamptz not null default now()
);

create table if not exists messagerie_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references messagerie_conversations(id) on delete cascade,
  auteur text not null check (auteur in ('client', 'equipe')),
  contenu text not null default '',
  created_at timestamptz not null default now()
);

alter table messagerie_conversations enable row level security;
alter table messagerie_messages enable row level security;

-- Écriture anon : c'est le visiteur/client qui crée sa conversation et son
-- premier message depuis la vitrine. Pas de lecture anon (une conversation
-- ne doit pas être listable publiquement).
create policy "messagerie_conversations_insert_anon"
  on messagerie_conversations for insert
  to anon
  with check (true);

create policy "messagerie_messages_insert_anon"
  on messagerie_messages for insert
  to anon
  with check (true);

create policy "messagerie_conversations_all_authenticated"
  on messagerie_conversations for all
  to authenticated
  using (true)
  with check (true);

create policy "messagerie_messages_all_authenticated"
  on messagerie_messages for all
  to authenticated
  using (true)
  with check (true);
