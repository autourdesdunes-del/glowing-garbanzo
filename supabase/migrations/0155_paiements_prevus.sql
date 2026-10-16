-- Paiements à venir, en nombre libre — jusqu'ici, un seul paiement futur
-- pouvait être prévu à la fois (client.reprise_montant/mode/activite_id,
-- un seul montant/mode/activité). Certains séjours ont besoin de PLUSIEURS
-- tranches futures distinctes (ex. Clélia Malardenti : 825€ le 17/10 à une
-- activité, 1355€ le 20/10 au Caire à une autre — impossible à représenter
-- avec une seule case, la deuxième tranche écrasait toujours la première,
-- demande de Mélanie 2026-10-16).
--
-- N'affecte pas les champs reprise_* existants (client), qui restent
-- utilisés tels quels par la détection automatique "activité ajoutée après
-- un solde déjà réglé" (checkRepriseApresAjout) — cette table ne sert que
-- le bouton manuel "+ Ajouter un paiement à effectuer", qui peut désormais
-- être cliqué plusieurs fois pour empiler plusieurs tranches indépendantes.
create table if not exists paiements_prevus (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  montant numeric not null default 0,
  mode text not null default '',
  date_prevue date,
  activite_id uuid references reservations(id) on delete set null,
  activite_nom text not null default '',
  statut text not null default 'en_attente' check (statut in ('en_attente', 'regle')),
  regle_le timestamptz,
  note text not null default '',
  created_par_nom text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists paiements_prevus_client_idx on paiements_prevus (client_id);

alter table paiements_prevus enable row level security;
create policy "team full access" on paiements_prevus for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
