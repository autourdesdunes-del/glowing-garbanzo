-- Lier l'escalade à l'activité (réservation) concernée, pour pouvoir
-- afficher un badge "en attente de validation" directement sur sa carte
-- dans le dossier client — l'activité est ajoutée tout de suite (l'employée
-- n'attend pas), mais reste visiblement signalée tant que ce n'est pas
-- tranché par la Direction/Sylvie.
alter table bus_escalations
  add column if not exists reservation_id uuid references reservations(id) on delete cascade;

notify pgrst, 'reload schema';
