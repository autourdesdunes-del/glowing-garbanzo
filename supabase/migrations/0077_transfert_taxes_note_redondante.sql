-- Les notes "remise groupe" de Sahl Hasheesh sont désormais entièrement
-- redites dans le label lui-même ("... mais remise groupe donc X euros...",
-- voir 0075) — la note séparée n'était plus utile qu'à faire remonter en
-- haut de la ville, hors contexte, un rappel qui ne concerne qu'une seule
-- tranche. On ne garde que la note "Tarifs indiqués par véhicule" de
-- Makadi, qui elle est bien générale à toute la ville.
update transfert_taxes set note = ''
  where ville = 'Sahl Hasheesh' and note like 'Tarif normal%';
