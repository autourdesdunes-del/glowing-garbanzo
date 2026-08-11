-- Remboursements : mode PayPal → adresse PayPal du client à laquelle
-- envoyer l'argent ; mode Virement bancaire (RIB) → capture d'écran du RIB
-- envoyé par le client, pour ne plus dépendre de WhatsApp.
alter table remboursements add column if not exists paypal_email text not null default '';
alter table remboursements add column if not exists rib_photo_path text;

-- Avoirs : crédit "à utiliser pendant le séjour" du client, même logique de
-- suivi qu'un remboursement (raison / date du problème / montant / activité
-- liée) mais qui se consomme au fil des activités ajoutées (montant_restant)
-- au lieu d'être versé une fois. La date de fin d'utilisation suit toujours
-- la date de fin de séjour du client — pas de colonne dédiée, jamais désynchronisée.
create table if not exists avoirs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  montant numeric not null default 0,
  montant_restant numeric not null default 0,
  raison text not null default 'Annulation'
    check (raison in ('Annulation','Problème activité','Dédommagement','Autre')),
  raison_autre text not null default '',
  activite_id uuid references reservations(id) on delete set null,
  date_probleme date,
  created_at timestamptz not null default now()
);

alter table avoirs enable row level security;
create policy "team full access" on avoirs for all to authenticated using (true) with check (true);

-- Bucket privé pour les captures d'écran de RIB (données bancaires sensibles
-- — mêmes règles d'accès que le reste : équipe authentifiée uniquement).
insert into storage.buckets (id, name, public)
values ('rib-screenshots', 'rib-screenshots', false)
on conflict (id) do nothing;

create policy "team read rib screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'rib-screenshots');
create policy "team upload rib screenshots"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'rib-screenshots');
create policy "team update rib screenshots"
  on storage.objects for update to authenticated
  using (bucket_id = 'rib-screenshots');
create policy "team delete rib screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'rib-screenshots');

notify pgrst, 'reload schema';
