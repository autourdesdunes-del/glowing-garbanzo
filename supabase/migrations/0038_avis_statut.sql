-- Les avis clients (J+7) passent d'une simple case "Envoyé" à un statut à
-- trois états, pour distinguer les clients qu'on ne veut pas relancer
-- (mauvaise expérience) de ceux déjà publiés.

alter table clients add column if not exists avis_statut text not null default 'À demander';

alter table clients add constraint clients_avis_statut_check
  check (avis_statut in ('À demander', 'À ne pas demander', 'Déjà publié'));

update clients set avis_statut = 'Déjà publié' where avis_envoye = true and avis_statut = 'À demander';

notify pgrst, 'reload schema';
