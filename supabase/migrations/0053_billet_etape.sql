-- Remplace les 4 champs indépendants du billet d'avion (billet_statut,
-- billet_acompte_paye, billet_envoye, billet_envoye_hossam) par une seule
-- progression à étapes (billet_etape), qui reflète le vrai déroulé métier :
-- acompte en attente -> à envoyer à Hossam -> envoyé, en attente du billet
-- -> billet reçu, à envoyer au client -> terminé. Ça évite les cases
-- cochées dans le désordre et les oublis d'étape.
alter table reservations
  add column if not exists billet_etape text not null default 'attente_acompte';
alter table reservations
  add column if not exists billet_demande_envoyee_le date;

update reservations set billet_etape = case
  when billet_envoye then 'termine'
  when billet_envoye_hossam then 'attente_hossam'
  when billet_acompte_paye then 'a_envoyer_hossam'
  else 'attente_acompte'
end
where billet_requis = true;

alter table reservations drop column if exists billet_statut;
alter table reservations drop column if exists billet_acompte_paye;
alter table reservations drop column if exists billet_envoye;
alter table reservations drop column if exists billet_envoye_hossam;

notify pgrst, 'reload schema';
