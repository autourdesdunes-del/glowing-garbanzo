-- Journal des hôtels saisis côté vitrine (tunnel de réservation) qui
-- n'étaient pas dans hotels_reference — la vitrine les détecte via Google
-- Places + classement par proximité (voir lib/geo.ts côté vitrine), puis
-- les journalise ici pour que l'équipe valide et les ajoute à
-- hotels_reference. La base se complète ainsi toute seule au fil des
-- réservations, sans maintenance manuelle d'une liste d'hôtels.
create table if not exists hotels_non_references (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '',
  latitude numeric,
  longitude numeric,
  -- Zone déduite par proximité, '' si la détection a échoué ou dépassait
  -- le seuil de distance (voir classerZone() côté vitrine).
  zone_detectee text not null default '',
  distance_km numeric,
  valide boolean not null default false,
  created_at timestamptz not null default now()
);

alter table hotels_non_references enable row level security;

-- Écriture par la vitrine (anon, via la clé publique) — c'est elle qui
-- journalise la détection au moment de la réservation.
create policy "hotels_non_references_insert_anon"
  on hotels_non_references for insert
  to anon
  with check (true);

-- Lecture/écriture équipe (authenticated) pour la validation côté CRM.
create policy "hotels_non_references_all_authenticated"
  on hotels_non_references for all
  to authenticated
  using (true)
  with check (true);
