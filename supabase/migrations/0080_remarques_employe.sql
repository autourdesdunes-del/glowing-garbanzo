-- Remarque privée et discrète de Sylvie/Direction à une employée (ex :
-- trop de flyers envoyés, réponse pas assez soignée) — pensé pour éviter
-- la confrontation en personne : l'employée la voit seule à sa prochaine
-- connexion, comme un rappel à l'ordre feutré plutôt qu'un reproche public.
create table if not exists remarques_employe (
  id uuid primary key default gen_random_uuid(),
  employe_id uuid not null references auth.users(id) on delete cascade,
  employe_nom text not null default '',
  auteur_id uuid references auth.users(id) on delete set null,
  auteur_nom text not null default '',
  message text not null default '',
  client_id uuid references clients(id) on delete set null,
  client_nom text not null default '',
  lu boolean not null default false,
  lu_at timestamptz,
  created_at timestamptz not null default now()
);

alter table remarques_employe enable row level security;
create policy "team full access" on remarques_employe for all to authenticated using (true) with check (true);

-- Pour le rapport "qui rentre le plus de réservations" côté Manager — le
-- comptage démarre à partir de maintenant, pas de reprise rétroactive de
-- l'historique (personne n'a encore attribué les réservations existantes).
alter table reservations
  add column if not exists cree_par_id uuid references auth.users(id) on delete set null,
  add column if not exists cree_par_nom text not null default '';

notify pgrst, 'reload schema';
