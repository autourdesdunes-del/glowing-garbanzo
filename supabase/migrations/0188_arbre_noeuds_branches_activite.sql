-- Branches résolues directement depuis l'activité affichée (pas besoin
-- d'un compte client) — les thèmes les plus fréquents dans les messages
-- WhatsApp entrants AVANT réservation, mesurés sur 1 377 messages extraits
-- de Kommo le 2026-11-06 (BRIEF_MESSAGERIE.md §2/§4) : âge des enfants
-- 20,5 %, prix/inclus 7,1 %, guide francophone 7,1 %, privatif ou partagé
-- 5,9 %. Nouvelle rubrique "Enfants et bébés" en tête, avant "Ma
-- réservation" qui reste pour l'après-réservation (espace client).
insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000030', null, 'Enfants et bébés', 'menu', '', '', 0),
  ('a0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000030', 'Peut-on venir avec un bébé ou un enfant ?', 'donnee', 'bebe', '', 1),

  ('a0000000-0000-0000-0000-000000000040', null, 'Prix, inclus et guide', 'menu', '', '', 0),
  ('a0000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000040', 'Prix et ce qui est inclus', 'donnee', 'prixEtInclus', '', 1),
  ('a0000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000040', 'Y a-t-il un guide francophone ?', 'donnee', 'guide', '', 2),
  ('a0000000-0000-0000-0000-000000000043', 'a0000000-0000-0000-0000-000000000040', 'C''est privatif ou partagé avec d''autres clients ?', 'donnee', 'modePax', '', 3),
  ('a0000000-0000-0000-0000-000000000044', 'a0000000-0000-0000-0000-000000000040', 'Quel est le programme ?', 'donnee', 'programme', '', 4)
on conflict (id) do nothing;

-- Réordonne les rubriques existantes pour laisser "Enfants et bébés" et
-- "Prix, inclus et guide" en tête (les deux thèmes les plus demandés).
update arbre_noeuds set ordre = 2 where id = 'a0000000-0000-0000-0000-000000000001'; -- Les transferts et horaires
update arbre_noeuds set ordre = 3 where id = 'a0000000-0000-0000-0000-000000000010'; -- Ma réservation
update arbre_noeuds set ordre = 4 where id = 'a0000000-0000-0000-0000-000000000020'; -- Paiement
update arbre_noeuds set ordre = 1 where id = 'a0000000-0000-0000-0000-000000000040'; -- Prix, inclus et guide
