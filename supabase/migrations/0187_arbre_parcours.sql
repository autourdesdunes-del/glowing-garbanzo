-- Journalisation des parcours dans l'arbre d'aide (BRIEF_MESSAGERIE.md) —
-- sans cette table l'arbre reste figé à sa version 1 : les chemins qui
-- terminent le plus souvent en escalade sont la liste de ce qu'il faut
-- écrire ensuite.
create table if not exists arbre_parcours (
  id uuid primary key default gen_random_uuid(),
  -- Libellés traversés, pas des ids — reste lisible même après que
  -- Mélanie ait réorganisé ou supprimé des nœuds.
  chemin text[] not null default '{}',
  termine_par text not null check (termine_par in ('oui', 'escalade')),
  client_id uuid references clients(id) on delete set null,
  catalogue_item_id uuid references catalogue_activites(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table arbre_parcours enable row level security;

create policy "arbre_parcours_insert_anon"
  on arbre_parcours for insert
  to anon
  with check (true);

create policy "arbre_parcours_select_authenticated"
  on arbre_parcours for select
  to authenticated
  using (true);
