-- Bucket privé pour uploader le billet d'avion lui-même (PDF/photo), depuis
-- l'activité "Le Caire en avion" de la fiche client — pour un suivi propre
-- du document reçu, en plus des infos gérées dans Suivis > Billets d'avion.
insert into storage.buckets (id, name, public)
values ('billets-avion', 'billets-avion', false)
on conflict (id) do nothing;

create policy "team read billets avion"
  on storage.objects for select to authenticated
  using (bucket_id = 'billets-avion');
create policy "team upload billets avion"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'billets-avion');
create policy "team update billets avion"
  on storage.objects for update to authenticated
  using (bucket_id = 'billets-avion');
create policy "team delete billets avion"
  on storage.objects for delete to authenticated
  using (bucket_id = 'billets-avion');

notify pgrst, 'reload schema';
