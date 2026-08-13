-- Suite de 0056_kommo_prospect_extraction.sql : deux champs supplémentaires
-- demandés pour suivre les prospects au-delà de la première étape Kommo.
--
-- kommo_demande_infos_envoyee_le : date à laquelle le lead est entré dans
-- l'étape "Demande d'infos envoyée" côté Kommo — posée par le webhook
-- classique (changement de statut), pas par l'IA, pour rester fiable.
--
-- kommo_programme_envoye_resume : résumé du programme/de l'itinéraire
-- envoyé au prospect, déduit au mieux par l'IA à partir des messages
-- qu'on reçoit du prospect (l'IA ne voit jamais les messages envoyés par
-- l'équipe elle-même, seulement les réponses du prospect qui en parlent).

alter table clients add column if not exists kommo_demande_infos_envoyee_le date;
alter table clients add column if not exists kommo_programme_envoye_resume text not null default '';

notify pgrst, 'reload schema';
