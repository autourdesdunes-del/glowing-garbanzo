alter table clients
  add column if not exists acompte_montant_prevu numeric;

notify pgrst, 'reload schema';
