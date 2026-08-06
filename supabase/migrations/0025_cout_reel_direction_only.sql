-- Le coût réel (cout_reel) sert au calcul de marge et ne doit être lisible
-- qu'en base par la Direction — pas seulement masqué côté UI. Jusqu'ici la
-- policy "team full access" sur reservations exposait cout_reel en SELECT à
-- tout compte authentifié (canSeeMargins n'est qu'un flag React), donc
-- n'importe quel membre équipe pouvait lire les coûts/marges via le réseau.
-- On déplace la colonne dans une table à part protégée par sa propre policy
-- réservée au rôle 'direction'.

create table if not exists reservation_couts (
  reservation_id uuid primary key references reservations(id) on delete cascade,
  cout_reel numeric not null default 0
);

alter table reservation_couts enable row level security;

drop policy if exists "direction full access couts" on reservation_couts;
create policy "direction full access couts" on reservation_couts
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

insert into reservation_couts (reservation_id, cout_reel)
select id, cout_reel from reservations
where cout_reel is not null and cout_reel <> 0
on conflict (reservation_id) do nothing;

alter table reservations drop column if exists cout_reel;

notify pgrst, 'reload schema';
