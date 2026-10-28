-- Distingue un coût confirmé à la main ("manuel") d'un coût simplement
-- estimé automatiquement depuis les tarifs prestataires fournis par
-- Mélanie le 2026-10-19 ("estime", voir src/lib/coutPrestataire.ts) — sans
-- ça, impossible de savoir si une marge affichée est vérifiée ou juste une
-- approximation. Déclenché par le constat du 2026-10-28 : la fonction de
-- calcul existait mais rien n'écrivait jamais dans reservation_couts à
-- grande échelle, elle restait vide (0 ligne), aucune marge visible nulle
-- part dans le CRM alors que les tarifs avaient bien été donnés.

alter table reservation_couts
  add column if not exists source text not null default 'manuel'
  check (source in ('manuel', 'estime'));

notify pgrst, 'reload schema';
