-- Corrections du 2026-11-06 (BRIEF_MESSAGERIE.md §8) : la v2 avait
-- INVENTÉ deux réponses sur des faits marqués "à obtenir de Mélanie" —
-- jamais combler un trou par une phrase plausible. Les deux nœuds
-- deviennent des données résolues côté vitrine (ArbreAide.tsx), plus
-- un texte statique inventé.
update arbre_noeuds
set type_reponse = 'donnee', source = 'transfertDeroule', reponse_texte = ''
where id = 'a0000000-0000-0000-0000-000000000002'; -- "Comment se passent les transferts ?"

update arbre_noeuds
set type_reponse = 'donnee', source = 'soldeModalite', reponse_texte = ''
where id = 'a0000000-0000-0000-0000-000000000022'; -- "Quels sont les moyens et échéances de paiement ?"
