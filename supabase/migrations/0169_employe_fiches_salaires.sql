-- Fiches employés (conditions d'emploi + historique des salaires versés) —
-- demande de Mélanie, 2026-11-03, dans Planning équipe. Données sensibles :
-- volontairement PAS sur `profiles` (lisible par toute l'équipe via "team
-- read profiles"), mais dans des tables à part réservées au rôle
-- 'direction' — même schéma que reservation_couts (0025).

create table if not exists employe_fiches (
  user_id uuid primary key references profiles(id) on delete cascade,
  conditions_emploi text not null default '',
  updated_at timestamptz not null default now()
);

alter table employe_fiches enable row level security;

create policy "direction full access employe_fiches" on employe_fiches
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

create table if not exists employe_salaires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- Toujours le 1er du mois concerné (ex. 2026-10-01 pour octobre) — jamais
  -- la date de versement réelle, pour trier/dédupliquer proprement.
  mois date not null,
  montant numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, mois)
);

alter table employe_salaires enable row level security;

create policy "direction full access employe_salaires" on employe_salaires
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

notify pgrst, 'reload schema';
