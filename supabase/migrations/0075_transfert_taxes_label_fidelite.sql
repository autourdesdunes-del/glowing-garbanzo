-- L'affichage HELP doit reproduire le détail exact de la page Notion,
-- bullet par bullet (y compris les cas redondants comme "4 adultes" listé
-- séparément de "2 adultes et 2 enfants ou 3 adultes et (+)" alors que les
-- deux valent 15€) — pas un résumé condensé. Un label peut désormais
-- contenir plusieurs lignes (séparées par \n), une par bullet Notion,
-- affichées chacune sur sa propre ligne côté HELP.
update transfert_taxes set label = '2 adultes : 10 euros' || chr(10) || '2 adultes et 1 enfant : 10 euros'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 2 and nb_enfants_max = 1;
update transfert_taxes set label = '2 adultes et 2 enfants ou 3 adultes et (+) : 15 euros'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 2 and nb_enfants_min = 2;
update transfert_taxes set label = '4 adultes : 15 euros (voiture)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 3 and nb_adultes_max = 4;
update transfert_taxes set label = '5 adultes : 25 euros mais remise groupe donc 20 euros (indiquer que l''on fait une remise)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 5 and nb_adultes_max = 5;
update transfert_taxes set label = '6 adultes : 30 euros mais remise groupe donc 20 euros (indiquer que l''on fait une remise)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 6 and nb_adultes_max = 6;
update transfert_taxes set label = '7 adultes : 35 euros mais remise groupe donc 20 euros (indiquer que l''on fait une remise)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 7 and nb_adultes_max = 7;
update transfert_taxes set label = 'De 8 à 10 personnes : 40 euros mais remise groupe donc 30 euros (indiquer que l''on fait une remise)'
  where ville = 'Sahl Hasheesh' and nb_adultes_min = 8;

update transfert_taxes set
  label = '2 adultes : 15 euros' || chr(10) || '2 adultes et 1 enfant : 15 euros' || chr(10) || '2 adultes et 2 enfants ou 3 adultes et (+) : 15 euros' || chr(10) || '4 adultes : 15 euros',
  note = 'Tarifs indiqués par véhicule'
  where ville = 'Makadi' and nb_adultes_min = 2 and nb_adultes_max = 4;
update transfert_taxes set label = 'De 5 à 10 adultes : 30 euros'
  where ville = 'Makadi' and nb_adultes_min = 5;

update transfert_taxes set
  label = '2 adultes : 20 euros' || chr(10) || '2 adultes et 1 enfant : 20 euros' || chr(10) || '2 adultes et 2 enfants ou 3 adultes et (+) : 20 euros' || chr(10) || '4 adultes : 20 euros'
  where ville = 'El Gouna' and nb_adultes_min = 2 and nb_adultes_max = 4;
update transfert_taxes set label = 'De 5 à 10 adultes : 40 euros'
  where ville = 'El Gouna' and nb_adultes_min = 5;
