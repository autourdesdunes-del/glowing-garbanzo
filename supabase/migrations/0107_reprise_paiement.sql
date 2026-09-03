alter table clients add column if not exists reprise_montant numeric not null default 0;
alter table clients add column if not exists reprise_mode text not null default '';
alter table clients add column if not exists reprise_activite_id uuid references reservations(id) on delete set null;

notify pgrst, 'reload schema';
