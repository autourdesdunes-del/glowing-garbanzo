-- Photo du vol du client (transferts aéroport) — en plus du numéro de vol
-- et de l'horaire déjà existants (r.numero_vol / r.horaire_vol), pour que
-- le chauffeur/l'équipe puisse vérifier le vol exact si besoin.
alter table reservations add column if not exists photo_vol_path text;

insert into storage.buckets (id, name, public)
values ('photos-vol', 'photos-vol', false)
on conflict (id) do nothing;

create policy "team read photos vol"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos-vol');
create policy "team upload photos vol"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-vol');
create policy "team update photos vol"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos-vol');
create policy "team delete photos vol"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos-vol');

notify pgrst, 'reload schema';
