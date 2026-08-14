-- L'extraction Kommo capte désormais aussi ce que le prospect a dit
-- explicitement ne pas vouloir faire (ex. "pas envie de désert",
-- "on évite la plongée") — jamais déduit, seulement ce qui est refusé noir
-- sur blanc dans la conversation. Utilisé par le Générateur de programme
-- pour ne jamais proposer ces activités-là.
alter table clients
  add column if not exists kommo_activites_a_eviter text not null default '';
