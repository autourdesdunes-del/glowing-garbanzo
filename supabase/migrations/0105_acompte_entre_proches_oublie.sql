alter table clients
  add column if not exists acompte_entre_proches_oublie boolean not null default false;

notify pgrst, 'reload schema';
