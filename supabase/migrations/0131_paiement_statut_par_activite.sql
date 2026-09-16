-- Badge de paiement indépendant par activité, au lieu de toujours dériver
-- du solde unique du client — permet de rétablir un menu déroulant par
-- activité sans reproduire l'incident Carine LELOIR (changer une activité
-- déclarait tout le séjour réglé et effaçait en silence une reprise due
-- ailleurs, voir commits 679262e / 7ca1fd2 du 14/09). Demande de Mélanie du
-- 16/09 : chaque badge modifiable indépendamment, sans jamais toucher au
-- solde partagé.
--
-- Défaut "attente" pour toute NOUVELLE activité — jamais hérité d'un solde
-- déjà marqué payé. Les activités déjà existantes sont réattribuées en une
-- fois par un script (service-role, hors migration) qui recalcule leur
-- statut actuel avant bascule, pour ne rien changer visuellement au moment
-- du déploiement.
alter table reservations
  add column if not exists paiement_statut text not null default 'attente';
