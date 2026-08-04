-- Tarifs supplémentaires par activité (au-delà d'adulte/enfant) : ex.
-- "Accompagnateur" pour la plongée, "Passager" pour le quad, "Bébé" pour
-- Mahmya ou Le Caire en avion. Définis en modèle dans le catalogue (PU par
-- défaut), puis appliqués avec une quantité propre à chaque réservation.

create table if not exists catalogue_tarifs (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_id uuid not null references catalogue_activites(id) on delete cascade,
  label text not null default '',
  pu numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists reservation_tarifs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  label text not null default '',
  pu numeric not null default 0,
  quantite int not null default 0,
  created_at timestamptz not null default now()
);

alter table catalogue_tarifs enable row level security;
alter table reservation_tarifs enable row level security;
create policy "team full access" on catalogue_tarifs for all to authenticated using (true) with check (true);
create policy "team full access" on reservation_tarifs for all to authenticated using (true) with check (true);
