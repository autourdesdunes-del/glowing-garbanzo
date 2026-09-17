alter table reservations
  add column if not exists nb_quad integer,
  add column if not exists nb_buggy_normal integer,
  add column if not exists nb_buggy_famille integer;
