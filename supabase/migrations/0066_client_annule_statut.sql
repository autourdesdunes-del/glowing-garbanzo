-- Bug trouvé en test : annuler un client échouait silencieusement (revenait
-- à "Client confirmé" au rechargement) — la contrainte check sur
-- clients.statut (posée en 0045) listait encore les anciennes valeurs et
-- rejetait "Client annulé", ajouté depuis en code (0064) sans mettre à jour
-- cette contrainte. L'écriture échouait en base, l'UI restait optimiste
-- jusqu'au prochain fetch.

alter table clients drop constraint if exists clients_statut_check;

alter table clients add constraint clients_statut_check
  check (statut in (
    'Prospect',
    'À relancer',
    'Programme envoyé',
    'Demande d''infos envoyée',
    'Client confirmé',
    'Client perdu',
    'Client annulé'
  ));

notify pgrst, 'reload schema';
