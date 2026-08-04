-- Étape Paiements : type de paiement (intégral vs acompte + arrivée), et
-- pour le cas "RDV paiement planifié" un état validé/finalisé distinct du
-- simple champ solde_paye, pour piloter l'affichage de la carte RDV et le
-- badge "rendez-vous paiement finalisé" sur les activités.

alter table clients
  add column if not exists paiement_type text not null default '',
  add column if not exists paiement_integral_mode text not null default '',
  add column if not exists solde_rdv_valide boolean not null default false,
  add column if not exists solde_rdv_finalise boolean not null default false;
