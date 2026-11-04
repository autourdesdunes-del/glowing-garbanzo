-- Zone où se déroule l'activité — permet l'exonération de taxe de
-- transfert quand elle est égale à la zone de l'hôtel du client, plutôt
-- que de remplir 91 x 5 montants à la main. Vide = pas d'exonération
-- (comportement actuel), à valider activité par activité avec Mélanie.
alter table catalogue_activites
  add column zone_activite text not null default '';

update catalogue_activites set zone_activite = 'Makadi Bay' where nom = 'Mini Egypt';
