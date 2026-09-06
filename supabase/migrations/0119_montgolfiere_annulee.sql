alter table reservations add column if not exists montgolfiere_annulee boolean not null default false;
alter table reservations add column if not exists montgolfiere_annulee_date date;
