-- "Envoyés récemment" doit se baser sur la date RÉELLE où l'employée a
-- coché "Envoyé", pas sur la date cible théorique (J+1 / J+7) — sinon un
-- message envoyé en retard (coché aujourd'hui alors qu'il était dû il y a
-- 6 jours) disparaît immédiatement au lieu d'apparaître comme "envoyé
-- aujourd'hui".
alter table clients add column if not exists au_revoir_envoye_le date;
alter table clients add column if not exists avis_envoye_le date;

notify pgrst, 'reload schema';
