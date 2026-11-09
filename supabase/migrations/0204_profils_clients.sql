-- BRIEF_COMPTE_CLIENT.md étape 2 — profil "Mon voyage" (hôtel, dates du
-- séjour, composition), rattaché au compte téléphone de l'étape 1
-- (comptes_clients, migration 0203). Remplissage progressif, jamais un
-- formulaire : chaque champ est écrit au geste qui en a besoin — fiche,
-- arbre, tunnel. Cette migration ne pose que le schéma ; le branchement
-- de ces écrans sur le profil est l'étape 4 du brief, pas celle-ci.
create table if not exists profils_clients (
  compte_id uuid primary key references comptes_clients(id) on delete cascade,
  hotel_texte text not null default '',
  zone_hotel text not null default '',
  date_debut date,
  date_fin date,
  -- Composition : adultes + âges des enfants (chaque entrée = un enfant,
  -- pour les tarifs par âge) + nombre de bébés, même décomposition que le
  -- calcul de prix (pu_enfant_age, pu_bebe) plutôt qu'un simple compteur.
  adultes integer not null default 0,
  enfants_ages integer[] not null default '{}',
  bebes integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table profils_clients enable row level security;

-- Même principe que comptes_clients : lecture directe réservée au
-- titulaire, l'écriture passe par l'API en service role.
create policy "profils_clients_self_select" on profils_clients
  for select using (auth.uid() = compte_id);
