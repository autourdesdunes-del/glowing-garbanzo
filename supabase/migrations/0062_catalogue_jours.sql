-- Programme jour par jour pour les activités/circuits qui se déroulent sur
-- plusieurs jours (ex. Le Caire 2 jours, Abu Simbel...) — en complément du
-- champ libre "programme" existant, utile pour les activités simples d'une
-- seule journée.

create table if not exists catalogue_jours (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_id uuid not null references catalogue_activites(id) on delete cascade,
  titre text not null default '',
  description text not null default '',
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

alter table catalogue_jours enable row level security;

create policy "team full access" on catalogue_jours for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
