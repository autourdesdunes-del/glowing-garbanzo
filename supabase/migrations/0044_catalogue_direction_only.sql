-- Le catalogue ne doit être modifiable que par la Direction — l'équipe le
-- consulte en lecture seule. Jusqu'ici "team full access" laissait
-- n'importe quel compte authentifié écrire directement en base (le
-- masquage des boutons côté UI n'est pas une vraie protection). On
-- remplace par : lecture ouverte à toute l'équipe, écriture réservée au
-- rôle 'direction' — même schéma que reservation_couts (0025).

drop policy if exists "team full access" on catalogue_activites;
create policy "team read catalogue_activites" on catalogue_activites for select to authenticated using (true);
create policy "direction write catalogue_activites" on catalogue_activites for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction update catalogue_activites" on catalogue_activites for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction delete catalogue_activites" on catalogue_activites for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

drop policy if exists "team full access" on catalogue_tarifs;
create policy "team read catalogue_tarifs" on catalogue_tarifs for select to authenticated using (true);
create policy "direction write catalogue_tarifs" on catalogue_tarifs for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction update catalogue_tarifs" on catalogue_tarifs for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction delete catalogue_tarifs" on catalogue_tarifs for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

drop policy if exists "team full access" on catalogue_options;
create policy "team read catalogue_options" on catalogue_options for select to authenticated using (true);
create policy "direction write catalogue_options" on catalogue_options for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction update catalogue_options" on catalogue_options for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction delete catalogue_options" on catalogue_options for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

drop policy if exists "team full access" on catalogue_faq;
create policy "team read catalogue_faq" on catalogue_faq for select to authenticated using (true);
create policy "direction write catalogue_faq" on catalogue_faq for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction update catalogue_faq" on catalogue_faq for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
create policy "direction delete catalogue_faq" on catalogue_faq for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));

-- Demande de modification d'une ou plusieurs activités, faite par un
-- membre de l'équipe qui n'a pas la main sur le catalogue — visible et
-- marquable "Traité" par toute l'équipe (même logique que les
-- remboursements), pas bloquant comme les escalades bus.
create table if not exists catalogue_modification_requests (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_ids uuid[] not null default '{}',
  catalogue_item_noms text[] not null default '{}',
  type_modification text not null default 'Autre' check (type_modification in ('Tarif', 'Horaire', 'Programme', 'Autre')),
  autre_detail text not null default '',
  explication text not null default '',
  demandeur_id uuid not null references auth.users(id) on delete cascade,
  demandeur_nom text not null default '',
  statut text not null default 'En attente' check (statut in ('En attente', 'Traité')),
  created_at timestamptz not null default now()
);

alter table catalogue_modification_requests enable row level security;
create policy "team full access" on catalogue_modification_requests for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
