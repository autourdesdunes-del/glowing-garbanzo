-- Demandes de réservation venues de la vitrine publique (projet séparé
-- "autour-des-dunes-vitrine") — une table de "staging" distincte de
-- `clients`/`reservations` : l'équipe la consulte et transforme une demande
-- en vrai dossier à la main, exactement comme elle traite aujourd'hui une
-- demande reçue par WhatsApp. Rien n'écrit jamais directement dans
-- `clients`/`reservations` depuis la vitrine.
create table if not exists demandes_reservation (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '',
  email text not null default '',
  telephone text not null default '',
  panier jsonb not null default '[]',
  -- [{catalogue_item_id, nom, prix, adultes, enfants, date_souhaitee}, ...]
  message text not null default '',
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle', 'traitee', 'ignoree')),
  created_at timestamptz not null default now()
);

alter table demandes_reservation enable row level security;

-- La vitrine publique (clé anon) peut UNIQUEMENT créer une demande — jamais
-- lire, modifier ou supprimer quoi que ce soit, y compris ses propres lignes.
create policy "public insert demandes_reservation" on demandes_reservation
  for insert to anon with check (true);

-- L'équipe authentifiée voit et traite les demandes, comme pour le reste du CRM.
create policy "team full access demandes_reservation" on demandes_reservation
  for all to authenticated using (true) with check (true);
