-- BRIEF_MESSAGERIE.md §4 (correction du 2026-11-06) : la 6e branche
-- prioritaire ("Je veux organiser tout mon séjour", 5,4 % des 1 377
-- messages) manquait encore — les cinq autres (enfants/bébés, prix,
-- guide, programme, privatif ou partagé) existent déjà depuis la
-- migration 0188. Type texte (pas une donnée) : simple renvoi vers le
-- catalogue, pas de fait d'agence à inventer.
insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000050', null, 'Je veux organiser tout mon séjour', 'texte', '',
   'Vous pouvez découvrir toutes nos activités dans notre catalogue et composer votre séjour au fil de vos envies. Si vous préférez qu''on vous propose un programme clé en main, écrivez-nous juste en dessous : nous serions ravies de nous en occuper avec vous.',
   2)
on conflict (id) do nothing;

-- Réordonne pour refléter les volumes mesurés (§4) : Enfants et bébés
-- (20,5 %), Prix/inclus/guide/programme/privatif (bundle), organiser le
-- séjour (5,4 %), puis les sujets de logistique (transferts) et
-- d'après-réservation (espace client uniquement).
update arbre_noeuds set ordre = 3 where id = 'a0000000-0000-0000-0000-000000000001'; -- Les transferts et horaires
update arbre_noeuds set ordre = 4 where id = 'a0000000-0000-0000-0000-000000000010'; -- Ma réservation (espace)
update arbre_noeuds set ordre = 5 where id = 'a0000000-0000-0000-0000-000000000020'; -- Paiement (espace)
