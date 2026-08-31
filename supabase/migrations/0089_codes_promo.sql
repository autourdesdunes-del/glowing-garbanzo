-- Codes de réduction/promo que la Direction ajoute (onglet Direction) et
-- que l'équipe peut consulter en lecture seule (HELP > Codes promo) pour
-- vérifier qu'un code donné par un client est valide.
create table if not exists codes_promo (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null default '',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table codes_promo enable row level security;
create policy "team full access" on codes_promo for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
