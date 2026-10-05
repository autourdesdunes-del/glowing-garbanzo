-- Flyer pick-up : un visuel (PDF ou photo) par activité catalogue, envoyé en
-- complément du message pick-up au client — demande de Mélanie du 2026-10-05,
-- pour que l'équipe puisse le télécharger directement depuis l'onglet Pick-up
-- au lieu d'aller le chercher ailleurs à chaque fois.
insert into storage.buckets (id, name, public)
values ('flyer-pickups', 'flyer-pickups', false)
on conflict (id) do nothing;

create policy "team read flyer pickups"
  on storage.objects for select to authenticated
  using (bucket_id = 'flyer-pickups');
create policy "team upload flyer pickups"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'flyer-pickups');
create policy "team update flyer pickups"
  on storage.objects for update to authenticated
  using (bucket_id = 'flyer-pickups');
create policy "team delete flyer pickups"
  on storage.objects for delete to authenticated
  using (bucket_id = 'flyer-pickups');

alter table catalogue_activites
  add column if not exists flyer_pickup_path text not null default '';

notify pgrst, 'reload schema';
