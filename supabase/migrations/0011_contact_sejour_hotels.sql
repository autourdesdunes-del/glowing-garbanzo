-- Fiche client : passeport en photos (plus un lien), bébés + ados dans le
-- PAX, options "infos manquantes" partagées par toute l'équipe (y compris
-- celles ajoutées via le "+"), hôtels multiples pour les circuits, et une
-- table de référence HELP pour savoir si un hôtel est bien sur Hurghada
-- (sinon taxe de transfert en plus, par ville).

alter table clients
  add column if not exists passeport_photos text[] not null default '{}',
  add column if not exists bebes int not null default 0,
  add column if not exists ages_bebes text not null default '',
  add column if not exists ados_presents boolean not null default false,
  add column if not exists ages_ados text not null default '';

-- Le lien passeport est remplacé par des photos réelles ; on garde la
-- colonne un temps pour ne rien perdre côté anciens dossiers, mais l'UI ne
-- l'utilise plus. Idem pour le champ "noms des participants" du séjour.
comment on column clients.lien_passeport is 'Obsolète — remplacé par passeport_photos. Conservé pour ne pas perdre de données existantes.';
comment on column clients.participant_noms is 'Obsolète — champ retiré de l''UI.';
comment on column clients.info_manquante_autre is 'Obsolète — remplacé par infos_manquantes_options (le "+" ajoute une option partagée).';

-- ---------------------------------------------------------------------------
-- Options "infos manquantes" — partagées par toute l'équipe, pour que le "+"
-- d'une personne enrichisse le menu déroulant de tout le monde.
-- ---------------------------------------------------------------------------
create table if not exists infos_manquantes_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

insert into infos_manquantes_options (label) values
  ('Complet'), ('Room number'), ('Date de RDV'), ('Numéro WhatsApp'),
  ('Billets d''avion'), ('Passeport'), ('Acompte PayPal'), ('Localisation'),
  ('Ticket de train')
on conflict (label) do nothing;

alter table infos_manquantes_options enable row level security;
create policy "team full access" on infos_manquantes_options for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Hôtels multiples (circuits : Caire, Louxor, Assouan, Marsa Alam, Siwa...).
-- L'hôtel "principal" reste sur clients.hotel/chambre pour ne rien casser ;
-- ceux-ci sont les étapes additionnelles, dans l'ordre.
-- ---------------------------------------------------------------------------
create table if not exists client_hotels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  ordre int not null default 0,
  nom text not null default '',
  ville text not null default '',
  chambre text not null default '',
  date_arrivee date,
  date_depart date,
  created_at timestamptz not null default now()
);

alter table client_hotels enable row level security;
create policy "team full access" on client_hotels for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- HELP — référence hôtels (sur Hurghada ou non) et taxes de transfert par
-- ville, saisies et maintenues par Mélanie. Utilisées pour pré-cocher/alerter
-- automatiquement sur le transfert dans les activités.
-- ---------------------------------------------------------------------------
create table if not exists hotels_reference (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text not null default 'Hurghada',
  sur_hurghada boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hotels_reference_nom_key on hotels_reference (lower(nom));

create table if not exists transfert_taxes (
  id uuid primary key default gen_random_uuid(),
  ville text not null unique,
  montant numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hotels_reference enable row level security;
alter table transfert_taxes enable row level security;
create policy "team full access" on hotels_reference for all to authenticated using (true) with check (true);
create policy "team full access" on transfert_taxes for all to authenticated using (true) with check (true);

create trigger hotels_reference_set_updated_at before update on hotels_reference
  for each row execute function set_updated_at();
create trigger transfert_taxes_set_updated_at before update on transfert_taxes
  for each row execute function set_updated_at();

-- Bucket privé pour les photos de passeport (données sensibles — mêmes
-- règles d'accès que le reste : équipe authentifiée uniquement).
insert into storage.buckets (id, name, public)
values ('passport-photos', 'passport-photos', false)
on conflict (id) do nothing;

create policy "team read passport photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'passport-photos');
create policy "team upload passport photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'passport-photos');
create policy "team update passport photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'passport-photos');
create policy "team delete passport photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'passport-photos');
