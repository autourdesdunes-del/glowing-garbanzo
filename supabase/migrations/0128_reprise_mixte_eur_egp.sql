-- Même principe que solde_mixte_eur/solde_mixte_egp (migration 0126) mais
-- pour une "reprise" (nouvelle activité ajoutée après un solde déjà
-- clôturé, réglée à part — voir checkRepriseApresAjout dans
-- ClientDetail.tsx) : jusqu'ici cette reprise ne pouvait se régler qu'en un
-- seul mode (PayPal/Espèces EUR/Espèces EGP/Carte bleue/Virement), pas en
-- mixte € + EGP cash, alors que c'est un cas réel (ex. client qui paie une
-- excursion ajoutée sur place moitié en euros, moitié en livres
-- égyptiennes). reprise_montant reste le total dû en €, ces deux colonnes
-- portent la répartition réelle quand reprise_mode = "Modes différents".

alter table clients
  add column if not exists reprise_mixte_eur numeric not null default 0,
  add column if not exists reprise_mixte_egp numeric not null default 0;
