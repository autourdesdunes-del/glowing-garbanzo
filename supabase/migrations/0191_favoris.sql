-- Vente additionnelle, chantier 2 (BRIEF_VENTE_ADDITIONNELLE.md,
-- 2026-11-06) : persiste les favoris côté serveur sous un jeton
-- anonyme de navigateur, pour pouvoir relancer par email — aujourd'hui
-- jetés (localStorage uniquement, perdus au changement d'appareil).
--
-- consentement : case à cocher explicite au moment de la saisie de
-- l'email ("recevoir des suggestions") — ajoutée par rapport au schéma
-- du brief, nécessaire pour que la relance (chantier 2b) ait une base
-- légale, le brief la demandant par ailleurs dans l'UI.
--
-- Aucun accès anon direct à cette table : toute écriture passe par une
-- route API côté serveur (service role), comme le demande le brief —
-- RLS ci-dessous n'autorise donc rien côté anon.
create table if not exists favoris (
  id uuid primary key default gen_random_uuid(),
  jeton text not null,
  activite_id uuid not null references catalogue_activites(id) on delete cascade,
  email text,
  prenom text,
  consentement boolean not null default false,
  relance_envoyee_le timestamptz,
  desinscrit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (jeton, activite_id)
);

create index if not exists favoris_jeton_idx on favoris (jeton);

alter table favoris enable row level security;

create policy "favoris_all_authenticated"
  on favoris for all
  to authenticated
  using (true)
  with check (true);
