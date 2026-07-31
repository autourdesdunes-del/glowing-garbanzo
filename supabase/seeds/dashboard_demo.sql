-- Faux clients pour visualiser le dashboard rempli. Sans risque : ce sont de
-- vraies lignes normales, identifiables par leur email en @example.com,
-- supprimables à tout moment (voir la requête de suppression en bas).

insert into clients
  (nom, statut, telephone, email, hotel, chambre, date_debut, date_fin,
   infos_manquantes, solde_date, solde_paye, au_revoir_envoye, avis_envoye,
   prochain_appel_date, prochain_appel_heure, created_at)
values
  ('Sophie Martin', 'Client confirmé', '+33 6 11 22 33 44', 'sophie.martin@example.com',
   'Steigenberger Aqua Magic', '412', current_date - 2, current_date + 3,
   '{}', null, false, false, false, null, '', now()),

  ('Karim Haddad', 'Client confirmé', '+33 6 22 33 44 55', 'karim.haddad@example.com',
   'Jaz Aquamarine', '', current_date + 1, current_date + 6,
   array['Room number'], null, false, false, false, null, '', now()),

  ('Julie Dupont', 'Client confirmé', '+33 6 33 44 55 66', 'julie.dupont@example.com',
   'Pickalbatros Aqua Blu', '215', current_date + 1, current_date + 5,
   '{}', current_date, false, false, false, null, '', now()),

  ('Ahmed Ali', 'Prospect', '+33 6 44 55 66 77', 'ahmed.ali@example.com',
   '', '', current_date + 10, current_date + 15,
   '{}', null, false, false, false, null, '', now() - interval '5 days'),

  ('Emma Rousseau', 'Client confirmé', '+33 6 55 66 77 88', 'emma.rousseau@example.com',
   'Continental Hurghada', '318', current_date - 6, current_date - 1,
   '{}', null, false, false, false, null, '', now()),

  ('Lucas Bernard', 'Client confirmé', '+33 6 66 77 88 99', 'lucas.bernard@example.com',
   'Sunrise Grand Select', '221', current_date - 12, current_date - 7,
   '{}', null, false, false, false, null, '', now()),

  ('Nina Perrot', 'Client confirmé', '+33 6 77 88 99 00', 'nina.perrot@example.com',
   'Sunny Days El Palacio', '108', current_date + 8, current_date + 13,
   '{}', current_date, true, false, false, null, '', now()),

  ('Marc Petit', 'Client confirmé', '+33 6 88 99 00 11', 'marc.petit@example.com',
   'Titanic Beach Spa', '305', current_date + 9, current_date + 14,
   '{}', null, false, false, false, current_date, '14:30', now());

-- Une activité pour Julie Dupont, demain, sans pick-up réel renseigné —
-- fait apparaître "Pick-ups à ajouter" dans les actions rapides.
insert into reservations (client_id, nom_activite, date_debut, moment, statut_resa)
select id, 'Excursion Le Caire en avion', current_date + 1, 'Journée', 'Confirmée'
from clients where email = 'julie.dupont@example.com';

-- Pour tout supprimer d'un coup une fois le rendu vérifié :
-- delete from clients where email like '%@example.com';
