alter table reservations
  add column if not exists reduction_montant numeric not null default 0,
  add column if not exists reduction_motif text not null default '',
  add column if not exists activite_offerte boolean not null default false;

notify pgrst, 'reload schema';
