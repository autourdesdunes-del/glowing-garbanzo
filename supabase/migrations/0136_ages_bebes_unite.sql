-- Les âges des bébés (ages_bebes) se comptent parfois en mois plutôt qu'en
-- années (ex. "8 mois") — ajoute une unité par client pour que le
-- sélecteur d'âge sache quelle échelle proposer (0-3 ans ou 0-35 mois) et
-- que l'affichage (agesLabel) sache quel mot accoler sans deviner.
alter table clients
  add column if not exists ages_bebes_unite text not null default 'ans'
    check (ages_bebes_unite in ('ans', 'mois'));
