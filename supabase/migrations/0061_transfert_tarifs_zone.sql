-- Tarifs forfaitaires des transferts (aéroport, etc.) selon la zone de
-- l'hôtel et le véhicule utilisé : le prix n'est jamais par personne, c'est
-- un forfait pour le trajet, qui varie selon la zone (plus ou moins loin)
-- et le véhicule (voiture jusqu'à 3 pers., van à partir de 4 pers.). Propre
-- à chaque activité de catalogue de type "Transfert".

create table if not exists transfert_tarifs (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_id uuid not null references catalogue_activites(id) on delete cascade,
  zone text not null default '',
  vehicule text not null default '',
  prix numeric not null default 0,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

alter table transfert_tarifs enable row level security;

create policy "team full access" on transfert_tarifs for all to authenticated using (true) with check (true);

-- Sur la réservation : quelle zone et quel véhicule ont été choisis (sert à
-- retrouver/réappliquer le tarif forfaitaire correspondant depuis
-- transfert_tarifs, et à l'afficher sur la fiche).
alter table reservations add column if not exists zone_transfert text not null default '';
alter table reservations add column if not exists vehicule_transfert text not null default '';

notify pgrst, 'reload schema';
