-- Fuite de texte interne (CLAUDE.md, règle "specificites ne doit jamais
-- partir au client") : certaines fiches affichaient specificites côté
-- vitrine publique, y compris des consignes internes ("à annoncer dans le
-- devis, jamais découvert sur place"). info_importante est le champ déjà
-- prévu pour le contenu public — reprise telle quelle du contenu actuel de
-- specificites (aucune fiche ne l'utilisait encore), à nettoyer ensuite
-- fiche par fiche dans le CRM, notamment les 10 lignes du supplément solo.
update catalogue_activites
  set info_importante = specificites
  where specificites <> '' and info_importante = '';
