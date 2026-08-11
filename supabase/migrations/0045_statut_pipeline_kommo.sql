-- La pipeline Prospects passe au vocabulaire Kommo (Prospect → À relancer →
-- Programme envoyé → Demande d'infos envoyée), fermeture en Client confirmé
-- ou Client perdu. La contrainte check sur clients.statut datait des 4
-- anciennes valeurs et bloque toute écriture des nouvelles — on l'élargit,
-- puis on migre les fiches déjà sur l'ancien vocabulaire.

alter table clients drop constraint if exists clients_statut_check;

update clients set statut = 'À relancer' where statut = 'En négociation';
update clients set statut = 'Client perdu' where statut = 'Perdu';

alter table clients add constraint clients_statut_check
  check (statut in (
    'Prospect',
    'À relancer',
    'Programme envoyé',
    'Demande d''infos envoyée',
    'Client confirmé',
    'Client perdu'
  ));

notify pgrst, 'reload schema';
