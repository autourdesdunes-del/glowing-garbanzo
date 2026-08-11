-- L'avoir utilisé doit se voir directement sur l'activité qui en a
-- bénéficié ("avoir de X € utilisé sur cette activité"), pas seulement
-- comme une réduction globale invisible du solde du séjour.
alter table reservations add column if not exists avoir_utilise numeric not null default 0;

notify pgrst, 'reload schema';
