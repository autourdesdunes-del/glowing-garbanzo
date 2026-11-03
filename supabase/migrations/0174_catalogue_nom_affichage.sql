-- Nom public distinct du nom interne catalogue — le nom interne contient
-- parfois des détails internes (casse incohérente, parenthèses longues :
-- "Le Caire en mini-bus ViP (avec Grand Egyptian Museum)") qui cassent
-- l'alignement des cartes vitrine. Vide par défaut = on affiche le nom
-- interne tel quel (comportement actuel inchangé tant que rien n'est saisi).
alter table catalogue_activites
  add column nom_affichage text not null default '';
