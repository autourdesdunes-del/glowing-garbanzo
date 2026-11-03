-- Note client visible sur la fiche activité publique pour une information
-- importante à connaître avant de réserver (ex. "Minimum 2 personnes requises",
-- "Réservation 48h à l'avance obligatoire") — distincte de `specificites`, qui
-- mélange des consignes internes et ne doit jamais partir sur la vitrine.
alter table catalogue_activites
  add column info_importante text not null default '';
