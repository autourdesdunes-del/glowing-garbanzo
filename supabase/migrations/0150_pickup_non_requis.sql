-- Certaines activités n'ont jamais de pick-up à envoyer côté agence : le
-- guide contacte le client directement (ex. certaines excursions), ou un
-- chauffeur attend déjà au point convenu (transferts aéroport). Ces
-- réservations s'affichaient à tort dans "Pick-ups manquants" pour
-- toujours, puisque pickup_reel n'est jamais rempli — ce champ permet de
-- les retirer explicitement de la liste (demande de Mélanie, 2026-10-12).
alter table reservations add column if not exists pickup_non_requis boolean not null default false;

notify pgrst, 'reload schema';
