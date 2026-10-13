-- Revu : l'outil de vérification de dossier n'est plus un détecteur
-- d'erreurs avec un mécanisme "passer" à tracer (0152) — Mélanie ne veut
-- pas que le CRM juge ce qui est juste ou faux, juste qu'il rappelle une
-- checklist de points à relire (voir src/lib/dossierChecklist.ts). Cette
-- table n'a donc plus d'usage.
drop table if exists verification_erreurs_passees;
