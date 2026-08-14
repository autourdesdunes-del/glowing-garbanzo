-- La page HELP > Taxes de transfert est en lecture seule pour l'équipe
-- (voir 0074) — comme pour le catalogue (0044), elle doit pouvoir demander
-- une correction à la Direction plutôt que de modifier elle-même un chiffre
-- lié à l'argent. Même schéma/traitement que
-- catalogue_modification_requests, adapté aux tranches de taxe.
create table if not exists transfert_taxe_modification_requests (
  id uuid primary key default gen_random_uuid(),
  transfert_taxe_id uuid references transfert_taxes(id) on delete set null,
  ville text not null default '',
  tranche_label text not null default '',
  explication text not null default '',
  demandeur_id uuid not null references auth.users(id) on delete cascade,
  demandeur_nom text not null default '',
  statut text not null default 'En attente' check (statut in ('En attente', 'Traité')),
  created_at timestamptz not null default now()
);

alter table transfert_taxe_modification_requests enable row level security;
create policy "team full access" on transfert_taxe_modification_requests for all to authenticated using (true) with check (true);
