-- Étend le rappel personnel (RelanceNudgeAlert -> nudges pluriels) aux "au
-- revoir" (J+1), demandes d'avis Google et vérifications de dossier — même
-- principe que dernier_contact_par_id pour les relances (migration 0088) :
-- on trace qui a fait l'action pour pouvoir dire "ça fait X jours que TU
-- n'as rien fait ici". Rempli à partir de maintenant seulement.
alter table clients
  add column if not exists au_revoir_envoye_par_id uuid references auth.users(id) on delete set null,
  add column if not exists au_revoir_envoye_par_nom text not null default '',
  add column if not exists avis_envoye_par_id uuid references auth.users(id) on delete set null,
  add column if not exists avis_envoye_par_nom text not null default '';

-- La "vérification de dossier" garde son champ libre "nom" (signature
-- tapée à la main par l'employée, comme avant) — verifie_par_id s'y ajoute
-- en plus, rempli automatiquement avec le vrai compte connecté, pour que
-- le calcul du rappel personnel soit fiable même si la signature contient
-- une coquille.
alter table verifications
  add column if not exists verifie_par_id uuid references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
