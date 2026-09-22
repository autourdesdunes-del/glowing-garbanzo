-- Les 5 "centres" de notifications (alertes acompte, remarques employée,
-- escalades bus/jour/Assouan) interrogent chacun leur table toutes les 20
-- secondes, en continu, pour chaque employée connectée — plus, pour un
-- client ouvert, deux requêtes de plus filtrées par client_id
-- (ClientDetail.tsx). Aucune de ces tables n'avait d'index au-delà de la
-- clé primaire : chaque interrogation faisait un scan complet de la table,
-- répété en boucle par tout le monde. Avec l'historique qui s'accumule
-- (ces tables ne sont jamais vidées), ce bruit de fond permanent a
-- probablement contribué à la saturation CPU constatée le 2026-09-22
-- (CPU à 88% avec une seule employée connectée). Aucun changement de
-- comportement pour l'équipe — juste rendre ces mêmes requêtes bon marché.

-- acompte_alertes : toujours filtré sur vu = false (AcompteAlerteCenter).
create index if not exists idx_acompte_alertes_vu
  on acompte_alertes (vu)
  where vu = false;

-- bus_escalations : "en_attente" (BusEscalationCenter, vue Direction/Sylvie),
-- par employé (BusEscalationCenter, "mes résultats"), par client
-- (ClientDetail).
create index if not exists idx_bus_escalations_statut
  on bus_escalations (statut)
  where statut = 'en_attente';
create index if not exists idx_bus_escalations_employe
  on bus_escalations (employe_id, statut);
create index if not exists idx_bus_escalations_client
  on bus_escalations (client_id);

-- jour_escalations : mêmes trois filtres que bus_escalations.
create index if not exists idx_jour_escalations_statut
  on jour_escalations (statut)
  where statut = 'en_attente';
create index if not exists idx_jour_escalations_employe
  on jour_escalations (employe_id, statut);
create index if not exists idx_jour_escalations_client
  on jour_escalations (client_id);

-- assouan_verifications : mêmes trois filtres.
create index if not exists idx_assouan_verifications_statut
  on assouan_verifications (statut)
  where statut = 'en_attente';
create index if not exists idx_assouan_verifications_employe
  on assouan_verifications (employe_id, statut);
create index if not exists idx_assouan_verifications_client
  on assouan_verifications (client_id);

-- remarques_employe : toujours filtré sur (employe_id, lu = false).
create index if not exists idx_remarques_employe_employe_lu
  on remarques_employe (employe_id, lu)
  where lu = false;
