-- Pour les activités concernées par Assouan (transferts, visites, croisières
-- qui commencent/finissent à Assouan) : l'hôtel du client peut être sur la
-- rive "ville" (accessible directement en voiture) ou sur une île/presqu'île/
-- côté Village Nubien (le chauffeur doit attendre de l'autre côté de la rive,
-- le client prend une navette bateau gratuite réservée auprès de son hôtel).
-- L'employée doit informer le client de vérifier ça, et Sylvie/Direction
-- doit valider que ça a bien été fait avant que l'activité puisse être
-- confirmée — contrairement à bus_escalations/jour_escalations qui ne
-- bloquent jamais rien, ici la validation de Sylvie est une condition pour
-- passer l'activité en "Confirmée".

alter table catalogue_activites add column if not exists necessite_verif_hebergement_assouan boolean not null default false;

create table if not exists assouan_verifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  client_nom text not null default '',
  reservation_id uuid not null references reservations(id) on delete cascade,
  nom_activite text not null default '',
  employe_id uuid not null references auth.users(id) on delete cascade,
  employe_nom text not null default '',
  statut text not null default 'en_attente' check (statut in ('en_attente', 'validee', 'refusee')),
  resolu_par uuid references auth.users(id) on delete set null,
  resolu_par_nom text not null default '',
  resolu_message text not null default '',
  resolu_at timestamptz,
  created_at timestamptz not null default now()
);

alter table assouan_verifications enable row level security;

create policy "team full access" on assouan_verifications for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
