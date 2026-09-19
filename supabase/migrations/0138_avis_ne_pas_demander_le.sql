-- Horodate le moment où l'avis d'un client passe à "À ne pas demander", pour
-- pouvoir le ranger dans une catégorie "À ne pas demander récemment" (3
-- derniers jours) dans Suivis > Avis clients, au même titre que les envois
-- récents.
alter table clients
  add column if not exists avis_ne_pas_demander_le date;
