-- Pour les activités type spa/massage, le "moment" (matin/après-midi/journée)
-- ne veut rien dire — on demande plutôt un horaire précis souhaité par le
-- client, affiché ensuite à côté du nom de l'activité (ex. "Spa (18:00)").
alter table reservations add column if not exists horaire_souhaite text not null default '';
