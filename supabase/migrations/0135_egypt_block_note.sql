-- Le bloc équipe Égypte est modifiable avant l'envoi (commit e3013d7,
-- 2026-09-17) mais l'édition n'était gardée qu'en état React local : elle
-- se perdait en changeant d'activité, en fermant la fiche ou en rechargeant
-- la page. Mélanie veut que la modification soit réellement conservée.
alter table reservations
  add column if not exists egypt_block_note text not null default '';
