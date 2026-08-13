-- Annulation d'activité / de client — règles validées avec Mélanie :
-- billet d'avion requis ou croisière = non remboursable sauf exception
-- Hossam ; Siwa/Désert Blanc = non remboursable si annulé à moins de 10
-- jours ; le reste = non remboursable sous 24h (48h pour les excursions
-- "culturelles" hors Hurghada). La règle se règle une fois par activité
-- dans le Catalogue plutôt que d'être devinée depuis le nom en texte
-- libre — trop risqué sur une histoire d'argent.

alter table catalogue_activites
  add column if not exists regle_annulation text not null default 'hurghada_24h'
    check (regle_annulation in ('hurghada_24h', 'culturelle_48h', 'siwa_desert_10j', 'non_remboursable'));

alter table reservations drop constraint if exists reservations_statut_resa_check;
alter table reservations
  add constraint reservations_statut_resa_check
  check (statut_resa in ('Brouillon', 'Confirmée', 'Annulée'));

alter table reservations add column if not exists annulation_raison text not null default '';
alter table reservations add column if not exists annulation_date date;
-- '' tant que rien de choisi, puis 'rembourse' ou 'avoir' une fois l'employée
-- passée par la pop-up d'annulation.
alter table reservations add column if not exists annulation_remb_avoir text not null default ''
  check (annulation_remb_avoir in ('', 'rembourse', 'avoir'));
alter table reservations add column if not exists annulation_exception_hossam boolean not null default false;
-- true dès l'annulation d'une activité billet/croisière — consommé par le
-- pop-up de notification Hossam (voir AnnulationHossamAlert), qui le
-- repasse à false une fois vu.
alter table reservations add column if not exists annulation_prevenir_hossam boolean not null default false;

alter table clients add column if not exists annulation_raison text not null default '';
alter table clients add column if not exists annulation_date date;

notify pgrst, 'reload schema';
