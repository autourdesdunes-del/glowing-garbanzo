-- Les remboursements doivent porter l'explication complète (pas seulement
-- une raison présélectionnée) pour que la Direction comprenne pourquoi sans
-- devoir redemander à l'employée.
alter table remboursements add column if not exists details text not null default '';

notify pgrst, 'reload schema';
