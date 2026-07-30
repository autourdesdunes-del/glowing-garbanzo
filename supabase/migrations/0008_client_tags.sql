-- Étiquettes libres sur les clients (VIP, Récurrent, Urgent...).

alter table clients add column if not exists tags text[] not null default '{}';
