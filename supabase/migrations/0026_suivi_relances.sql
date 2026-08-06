-- Suivi de devis/prospects : jusqu'ici "prospect à relancer" se basait sur
-- l'ancienneté de la fiche (created_at), pas sur le dernier contact réel —
-- ce qui gardait un prospect "à relancer" même juste après une relance, et
-- ne donnait aucun historique du nombre de relances déjà faites.

alter table clients add column if not exists dernier_contact_date date;
alter table clients add column if not exists nb_relances integer not null default 0;

notify pgrst, 'reload schema';
