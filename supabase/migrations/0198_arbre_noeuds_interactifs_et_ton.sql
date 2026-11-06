-- BRIEF_MESSAGERIE.md §4 (2026-11-06) : nouveau type de nœud
-- `interactif` — contrairement à `texte`/`donnee`, il pose une question
-- et attend une réponse avant de pouvoir répondre (hotel_zone, choix_ile,
-- planning_sejour). Élargit la contrainte posée par la migration 0185.
alter table arbre_noeuds drop constraint if exists arbre_noeuds_type_reponse_check;
alter table arbre_noeuds add constraint arbre_noeuds_type_reponse_check
  check (type_reponse in ('menu', 'texte', 'donnee', 'interactif'));

-- "Je veux organiser tout mon séjour" (ajoutée en 0197 en type `texte`)
-- devient le nœud interactif planning_sejour — c'est la branche la plus
-- rentable du brief (§4) : collecte dates/personnes/envies et propose un
-- plan jour par jour (voir /api/arbre/planning côté vitrine).
update arbre_noeuds
set type_reponse = 'interactif', source = 'planning_sejour', reponse_texte = ''
where id = 'a0000000-0000-0000-0000-000000000050';

-- hotel_zone — "Mon hôtel est-il compris dans le transfert ?" : tout
-- existe déjà côté vitrine (HotelAutocomplete, /api/hotels/zone, grille
-- de taxes), c'est du câblage. Enfant de "Les transferts et horaires".
insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
   'Quelle taxe pour mon hôtel ?', 'interactif', 'hotel_zone', '', 6)
on conflict (id) do nothing;

-- choix_ile — "Quelle île choisir ?" : logique dictée par Mélanie le
-- 2026-11-06 (détente/snorkeling/privatif, paliers de budget, jamais la
-- bouée ou la banane tractée comme argument).
insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000060', null, 'Quelle île choisir ?', 'interactif', 'choix_ile', '', 2)
on conflict (id) do nothing;

-- Réordonne la racine (fiche publique) selon les volumes mesurés, choix_ile
-- et planning_sejour intercalés avec les branches existantes.
update arbre_noeuds set ordre = 3 where id = 'a0000000-0000-0000-0000-000000000050'; -- Je veux organiser tout mon séjour
update arbre_noeuds set ordre = 4 where id = 'a0000000-0000-0000-0000-000000000001'; -- Les transferts et horaires
update arbre_noeuds set ordre = 5 where id = 'a0000000-0000-0000-0000-000000000010'; -- Ma réservation (espace)
update arbre_noeuds set ordre = 6 where id = 'a0000000-0000-0000-0000-000000000020'; -- Paiement (espace)

-- Le ton : chaleureux et humain, jamais administratif (§4, 2026-11-06) —
-- "tous les textes déjà en base sont à repasser avec cette grille, pas
-- seulement les nouveaux." On/nous (jamais "je"), féminin pluriel,
-- phrases courtes, pas de "il convient de" ni "veuillez noter".
update arbre_noeuds
set reponse_texte = 'On part toujours de Hurghada, donc selon votre hôtel, un petit supplément de transfert peut s''ajouter. On le calcule pour vous dans le tunnel de réservation — le barème complet est sur chaque fiche, à « Suppléments ».'
where id = 'a0000000-0000-0000-0000-000000000003';

update arbre_noeuds
set reponse_texte = 'Pas de souci : on dessert aussi Sahl Hasheesh, Makadi Bay, El Gouna, Safaga et Soma Bay. Juste un petit supplément selon la zone, qu''on vous indique clairement avant de réserver.'
where id = 'a0000000-0000-0000-0000-000000000004';
