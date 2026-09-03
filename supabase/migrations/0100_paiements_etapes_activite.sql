-- Pour les étapes de paiement en espèces ou en carte bleue, l'équipe
-- confirme sur quelle activité l'argent a été récolté (proposé
-- automatiquement selon la date de l'étape, modifiable) — affiché dans le
-- "Résumé des paiements" pour retrouver le contexte d'un règlement en
-- espèces des mois plus tard. Pas pertinent pour PayPal/virement (l'argent
-- n'est pas remis en main propre sur une activité précise).
alter table paiements_etapes add column if not exists activite_nom text not null default '';

notify pgrst, 'reload schema';
