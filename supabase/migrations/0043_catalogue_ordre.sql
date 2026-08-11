alter table catalogue_activites add column if not exists ordre integer not null default 0;

-- Initialise l'ordre existant sur la date de création (le plus ancien
-- d'abord) pour que l'affichage ne bouge pas au premier chargement après
-- la migration — la Direction peut ensuite glisser-déposer pour réordonner.
with numbered as (
  select id, row_number() over (order by created_at asc) - 1 as rn
  from catalogue_activites
)
update catalogue_activites
set ordre = numbered.rn
from numbered
where catalogue_activites.id = numbered.id;
