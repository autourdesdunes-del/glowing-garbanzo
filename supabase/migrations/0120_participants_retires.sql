alter table reservations add column if not exists participants_retires integer not null default 0;
alter table reservations add column if not exists participants_retires_motif text not null default '';
