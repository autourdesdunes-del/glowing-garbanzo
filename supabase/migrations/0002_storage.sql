-- Bucket de stockage pour les photos d'activités (catalogue + réservations).
-- L'"Aperçu client" reste pour l'instant une vue interne (onglet de l'app équipe,
-- pas un lien public envoyé aux clients) -> accès reste réservé aux comptes
-- authentifiés de l'équipe, comme le reste des données.

insert into storage.buckets (id, name, public)
values ('activity-photos', 'activity-photos', false)
on conflict (id) do nothing;

create policy "team read activity photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'activity-photos');

create policy "team upload activity photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-photos');

create policy "team update activity photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'activity-photos');

create policy "team delete activity photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'activity-photos');
