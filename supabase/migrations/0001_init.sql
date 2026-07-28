-- Autour des Dunes CRM — schéma initial
-- Reflète le modèle de données du brief (section 3), avec les règles métier
-- encodées directement dans le schéma plutôt que laissées à la convention :
--   * un seul "solde" et un seul "billet d'avion" par client -> colonnes sur clients,
--     pas des tables séparées avec possibilité de doublons.
--   * horaire_approx (interne) et pickup_reel (client) sont deux colonnes distinctes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),

  nom text not null default '',
  canal text not null default 'WhatsApp'
    check (canal in ('Instagram','WhatsApp','TikTok','Email','Autre')),
  canal_autre text not null default '',
  pseudo_contact text not null default '',

  relation_grace_a text not null default 'Instagram'
    check (relation_grace_a in (
      'Bouche à oreille','Instagram','TikTok','Influenceurs','Google','Site internet',
      'Le Petit Futé','Élodie Gossuin','VIP Mélanie','Agence de voyage','TripAdvisor',
      'ChatGPT','GetYourGuide','Autre'
    )),
  relation_autre text not null default '',

  statut text not null default 'Prospect'
    check (statut in ('Prospect','En négociation','Client confirmé','Perdu')),

  telephone text not null default '',
  email text not null default '',
  hotel text not null default '',
  chambre text not null default '',
  date_debut date,
  date_fin date,

  adultes int not null default 2,
  enfants int not null default 0,
  ages_enfants text not null default '',
  participant_noms text not null default '',

  lien_passeport text not null default '',

  infos_manquantes text[] not null default '{}',
  info_manquante_autre text not null default '',

  commentaires text not null default '',

  -- solde unique du séjour (jamais un solde par activité)
  solde_montant numeric not null default 0,
  solde_mode text not null default 'Espèces EUR',
  solde_date date,
  solde_paye boolean not null default false,
  -- soit rattaché à une activité (première où il est encaissé), soit un RDV dédié
  solde_activite_id uuid,
  solde_rdv_heure text not null default '',
  solde_rdv_lieu text not null default '',
  solde_assigne_a text not null default '',

  -- billet d'avion (géré par Hossam) — un seul par client
  billet_requis boolean not null default false,
  billet_acompte_paye boolean not null default false,
  billet_envoye boolean not null default false,
  billet_lien text not null default '',
  billet_statut text not null default 'En attente',
  billet_notes text not null default '',
  billet_date date,
  billet_activite_id uuid,

  au_revoir_envoye boolean not null default false,
  avis_envoye boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reservations (une activité réservée pour un client)
-- ---------------------------------------------------------------------------
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  nom_activite text not null default '',
  date_debut date,
  date_fin date,
  moment text not null default 'Journée'
    check (moment in ('Matin','Après-midi','Journée','Plusieurs jours')),

  pu_adulte numeric not null default 0,
  pu_enfant numeric not null default 0,

  participants_mode text not null default 'tous' check (participants_mode in ('tous','custom')),
  participants_adultes int not null default 0,
  participants_enfants int not null default 0,
  participants_noms text not null default '',
  pax_override text not null default '', -- remplace l'affichage calculé quand rempli

  transfert_inclus boolean not null default true,
  transfert_montant numeric not null default 0,

  horaire_approx text not null default '', -- INTERNE, jamais montré au client
  pickup_reel text not null default '',    -- visible client, rempli la veille

  point_rdv text not null default '',
  inclus text not null default '',
  non_inclus text not null default '',
  a_prevoir text not null default '',
  info_importante text not null default '', -- encadré rouge interne

  cout_reel numeric not null default 0, -- pour calcul de marge
  photo_path text not null default '',  -- chemin dans le bucket Supabase Storage

  statut_resa text not null default 'Brouillon' check (statut_resa in ('Brouillon','Confirmée')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients
  add constraint clients_solde_activite_fk foreign key (solde_activite_id) references reservations(id) on delete set null,
  add constraint clients_billet_activite_fk foreign key (billet_activite_id) references reservations(id) on delete set null;

create table if not exists reservation_options (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  nom text not null default '',
  prix numeric not null default 0
);

-- ---------------------------------------------------------------------------
-- paiements (acomptes uniquement — le solde vit sur clients, jamais ici)
-- ---------------------------------------------------------------------------
create table if not exists paiements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  montant numeric not null default 0,
  mode text not null default 'PayPal'
    check (mode in ('PayPal','Espèces EUR','Espèces EGP','Carte bleue','Virement bancaire')),
  date date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- catalogue d'activités (types réutilisables)
-- ---------------------------------------------------------------------------
create table if not exists catalogue_activites (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '',
  disponibilites text not null default '',
  pu_adulte numeric not null default 0,
  pu_enfant numeric not null default 0,
  pu_bebe numeric not null default 0,
  marge_pct numeric not null default 0,
  horaire_approx text not null default '',
  inclus text not null default '',
  non_inclus text not null default '',
  a_prevoir text not null default '',
  point_rdv text not null default '',
  photo_path text not null default '',
  valide boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- remboursements
-- ---------------------------------------------------------------------------
create table if not exists remboursements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  montant numeric not null default 0,
  raison text not null default 'Annulation'
    check (raison in ('Annulation','Problème activité','Dédommagement','Autre')),
  raison_autre text not null default '',
  activite_id uuid references reservations(id) on delete set null,
  date_probleme date,
  mode text not null default 'Virement bancaire',
  par text not null default '',
  date_remboursement date,
  statut text not null default 'En attente' check (statut in ('En attente','Effectué')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vérifications de dossier
-- ---------------------------------------------------------------------------
create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  nom text not null default '',
  date date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at auto
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger reservations_set_updated_at before update on reservations
  for each row execute function set_updated_at();
create trigger catalogue_set_updated_at before update on catalogue_activites
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — un seul espace de travail partagé : tout utilisateur authentifié
-- (compte créé dans Supabase Auth pour l'équipe) a accès complet.
-- Pas de cloisonnement par utilisateur, conformément au brief.
-- ---------------------------------------------------------------------------
alter table clients enable row level security;
alter table reservations enable row level security;
alter table reservation_options enable row level security;
alter table paiements enable row level security;
alter table catalogue_activites enable row level security;
alter table remboursements enable row level security;
alter table verifications enable row level security;

create policy "team full access" on clients for all to authenticated using (true) with check (true);
create policy "team full access" on reservations for all to authenticated using (true) with check (true);
create policy "team full access" on reservation_options for all to authenticated using (true) with check (true);
create policy "team full access" on paiements for all to authenticated using (true) with check (true);
create policy "team full access" on catalogue_activites for all to authenticated using (true) with check (true);
create policy "team full access" on remboursements for all to authenticated using (true) with check (true);
create policy "team full access" on verifications for all to authenticated using (true) with check (true);
