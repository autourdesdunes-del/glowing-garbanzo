-- Bucket public séparé pour les photos du catalogue affichées sur la
-- vitrine publique — le bucket "activity-photos" existant reste privé
-- (voir migration 0002) car il est partagé avec des photos liées aux
-- réservations clients, qui ne doivent jamais être exposées publiquement.
-- Celui-ci ne contient qu'une copie des photos d'activités déjà validées.
insert into storage.buckets (id, name, public)
values ('catalogue-photos', 'catalogue-photos', true)
on conflict (id) do nothing;

create policy "public read catalogue photos"
  on storage.objects for select to anon
  using (bucket_id = 'catalogue-photos');

create policy "team manage catalogue photos"
  on storage.objects for all to authenticated
  using (bucket_id = 'catalogue-photos')
  with check (bucket_id = 'catalogue-photos');
