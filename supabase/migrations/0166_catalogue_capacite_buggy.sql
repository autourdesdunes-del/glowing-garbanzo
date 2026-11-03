-- Applique la capacité 2 places aux 3 variantes de Buggy (même véhicule),
-- avec Safari Buggy Famille en alternative (jusqu'à 4 pers.) et Safari quad
-- en complément pour la ou les personnes en trop — à ajuster si ce n'est pas
-- le bon duo (ex. Safari Quad Makadi à la place de Safari quad).
update catalogue_activites
set
  capacite_max_personnes = 2,
  activite_alternative_id = (select id from catalogue_activites where nom = 'Safari Buggy Famille'),
  activite_complement_id = (select id from catalogue_activites where nom = 'Safari quad')
where nom in ('Buggy', 'Buggy Sunset', 'Buggy et dîner spectacle');
