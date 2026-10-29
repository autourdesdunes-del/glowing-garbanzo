-- Case "validé" par ligne dans Direction > Comptabilité > Bénéfices —
-- demande de Mélanie, 2026-10-29 : cocher une fois que coût réel et
-- bénéfice ont été vérifiés pour cette réservation.
alter table reservation_couts
  add column if not exists verifie boolean not null default false;

notify pgrst, 'reload schema';
