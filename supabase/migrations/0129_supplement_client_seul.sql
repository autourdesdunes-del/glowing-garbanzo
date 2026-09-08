-- Sur certaines activités, l'agence organise elle-même le transfert : un
-- client seul mobilise donc un véhicule entier, d'où un supplément (5€ par
-- défaut, vécu sur chameau/cheval/city tour/Aqua Park/spa/Mini Egypt/
-- parachute ascensionnel — voir Formation ADD, module "Nos produits"). Cette
-- règle n'était documentée que dans la formation, jamais dans le CRM lui-même
-- : rien n'alertait l'employée au moment de créer la réservation.
alter table catalogue_activites
  add column if not exists supplement_solo_actif boolean not null default false;
alter table catalogue_activites
  add column if not exists supplement_solo_prix numeric not null default 5;

notify pgrst, 'reload schema';
