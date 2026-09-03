-- Preuve photo obligatoire au moment de marquer un remboursement
-- "Effectué", + l'horodatage exact du clic (date_remboursement restait une
-- simple date, sans heure) — pour que l'équipe puisse retrouver la preuve
-- de paiement sans repasser par WhatsApp, et savoir précisément quand
-- l'argent est parti.
alter table remboursements
  add column if not exists preuve_photo_path text,
  add column if not exists date_remboursement_ts timestamptz;

-- Bucket privé pour les preuves de remboursement (captures d'écran PayPal,
-- virement...) — mêmes règles d'accès que le reste : équipe authentifiée
-- uniquement.
insert into storage.buckets (id, name, public)
values ('remboursement-preuves', 'remboursement-preuves', false)
on conflict (id) do nothing;

create policy "team read remboursement preuves"
  on storage.objects for select to authenticated
  using (bucket_id = 'remboursement-preuves');
create policy "team upload remboursement preuves"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'remboursement-preuves');
create policy "team update remboursement preuves"
  on storage.objects for update to authenticated
  using (bucket_id = 'remboursement-preuves');
create policy "team delete remboursement preuves"
  on storage.objects for delete to authenticated
  using (bucket_id = 'remboursement-preuves');

notify pgrst, 'reload schema';
