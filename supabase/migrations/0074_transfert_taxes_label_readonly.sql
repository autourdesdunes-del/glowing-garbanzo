-- Affichage HELP fidèle au texte exact envoyé par Mélanie (page Notion
-- "Taxes de transfert") plutôt qu'un libellé recalculé à partir des
-- tranches — ce champ est ce que l'équipe voit, en lecture seule.
alter table transfert_taxes add column if not exists label text not null default '';

update transfert_taxes set label = '2 adultes, ou 2 adultes et 1 enfant : 10 euros'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 2 and nb_enfants_max = 1;
update transfert_taxes set label = '2 adultes et 2 enfants, ou 3 adultes et plus : 15 euros'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 2 and nb_enfants_min = 2;
update transfert_taxes set label = '4 adultes : 15 euros (voiture)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 3 and nb_adultes_max = 4;
update transfert_taxes set label = '5 adultes : 20 euros (tarif normal 25 euros, remise groupe appliquée)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 5 and nb_adultes_max = 5;
update transfert_taxes set label = '6 adultes : 20 euros (tarif normal 30 euros, remise groupe appliquée)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 6 and nb_adultes_max = 6;
update transfert_taxes set label = '7 adultes : 20 euros (tarif normal 35 euros, remise groupe appliquée)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 7 and nb_adultes_max = 7;
update transfert_taxes set label = 'De 8 à 10 personnes : 30 euros (tarif normal 40 euros, remise groupe appliquée)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 8;

update transfert_taxes set label = '2 à 4 adultes (avec ou sans enfants) : 15 euros — tarifs indiqués par véhicule'
  where ville = 'Makadi' and nb_adultes_min = 2 and nb_adultes_max = 4;
update transfert_taxes set label = 'De 5 à 10 adultes : 30 euros'
  where ville = 'Makadi' and nb_adultes_min = 5;

update transfert_taxes set label = '2 à 4 adultes (avec ou sans enfants) : 20 euros'
  where ville = 'El Gouna' and nb_adultes_min = 2 and nb_adultes_max = 4;
update transfert_taxes set label = 'De 5 à 10 adultes : 40 euros'
  where ville = 'El Gouna' and nb_adultes_min = 5;

update transfert_taxes set label = '2 à 4 personnes : 25 euros'
  where ville = 'Soma Bay' and nb_total_min = 2 and nb_total_max = 4;
update transfert_taxes set label = 'De 5 à 10 personnes : 35 euros'
  where ville = 'Soma Bay' and nb_total_min = 5;

update transfert_taxes set label = '2 à 4 personnes : 25 euros'
  where ville = 'Safaga' and nb_total_min = 2 and nb_total_max = 4;
update transfert_taxes set label = 'De 5 à 10 personnes : 35 euros'
  where ville = 'Safaga' and nb_total_min = 5;

update transfert_taxes set label = 'Personne seule — faire une demande pour connaître le montant'
  where nb_adultes_min = 1 and nb_adultes_max = 1;
