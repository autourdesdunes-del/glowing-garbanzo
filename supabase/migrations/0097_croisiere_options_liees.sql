alter table reservations
  add column if not exists parent_reservation_id uuid references reservations(id) on delete set null;

alter table reservation_options
  add column if not exists prix_compte_ailleurs boolean not null default false;

alter table catalogue_options
  add column if not exists description text not null default '';

notify pgrst, 'reload schema';
