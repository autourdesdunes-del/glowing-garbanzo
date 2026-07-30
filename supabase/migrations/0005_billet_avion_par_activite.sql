-- Un billet d'avion n'est pas une catégorie de client à part : n'importe
-- quelle activité peut en inclure un (le vol international pour Hossam, ou
-- un billet inclus dans une excursion comme "Le Caire en avion"). On déplace
-- donc les champs billet_* de clients vers reservations, comme un attribut
-- optionnel togglable sur chaque activité.

alter table reservations
  add column if not exists billet_requis boolean not null default false,
  add column if not exists billet_statut text not null default 'En attente',
  add column if not exists billet_date date,
  add column if not exists billet_acompte_paye boolean not null default false,
  add column if not exists billet_envoye boolean not null default false,
  add column if not exists billet_lien text not null default '',
  add column if not exists billet_notes text not null default '';

alter table clients drop constraint if exists clients_billet_activite_fk;
alter table clients drop column if exists billet_requis;
alter table clients drop column if exists billet_statut;
alter table clients drop column if exists billet_date;
alter table clients drop column if exists billet_acompte_paye;
alter table clients drop column if exists billet_envoye;
alter table clients drop column if exists billet_lien;
alter table clients drop column if exists billet_notes;
alter table clients drop column if exists billet_activite_id;
