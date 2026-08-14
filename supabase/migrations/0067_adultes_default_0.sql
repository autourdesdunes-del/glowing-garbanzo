-- Suite du bug "2 pax par défaut" : le code (EMPTY_CLIENT) a été corrigé,
-- mais la colonne elle-même avait encore "default 2" côté Postgres — donc
-- toute création qui n'envoie pas explicitement `adultes` (ex. les fiches
-- auto-créées par l'intégration Kommo) retombait quand même dessus.

alter table clients alter column adultes set default 0;
