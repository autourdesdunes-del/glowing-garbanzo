-- Une option catalogue peut être facturée par personne (ex. dîner
-- spectacle +5€/personne) ou en prix groupe fixe (ex. privatif +10€ pour
-- toute la réservation) — même logique que tarif_mode sur les activités.
alter table catalogue_options
  add column if not exists mode text not null default 'personne';

notify pgrst, 'reload schema';

