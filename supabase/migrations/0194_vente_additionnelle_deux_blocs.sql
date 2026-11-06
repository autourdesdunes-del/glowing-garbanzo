-- Vente additionnelle, chantier 1 réécrit le 2026-11-06 : deux blocs
-- distincts sous la fiche, pas un seul.
--
-- Bloc 1 "Pour compléter votre voyage" — choisi à la main par Mélanie
-- (logique d'itinéraire, ne se devine pas depuis l'historique).
-- `activite_complement_id` ne porte qu'un lien et sert déjà à autre chose
-- côté CRM (remplacement en cas de dépassement de capacité, voir
-- CatalogueView.tsx) : nouvelle colonne dédiée, une liste ordonnée.
alter table catalogue_activites
  add column if not exists complements uuid[] not null default '{}';

update catalogue_activites
   set complements = array[activite_complement_id]
 where activite_complement_id is not null
   and complements = '{}';

-- Bloc 2 "À découvrir" — jamais les versions bus, circuits, croisières
-- (cannibalisent le mini-bus/VIP/avion ou diluent la marge) ni les
-- transferts (n'ont de sens que choisis à la main, dans le bloc 1).
-- Pas codé en dur : Mélanie ajuste depuis la fiche catalogue, sans
-- déploiement. Le filtre doit s'appliquer partout où une activité est
-- suggérée automatiquement — en le portant sur cette seule colonne,
-- la fonction ci-dessous, le repli côté vitrine et la relance email du
-- chantier 2 l'appliquent tous en lisant la même valeur.
alter table catalogue_activites
  add column if not exists exclu_suggestions boolean not null default false;

update catalogue_activites set exclu_suggestions = true
 where categorie = 'Transfert'
    or nom in (
      'Le Caire en bus',
      'Louxor en bus',
      'Circuit Découverte & Mer Rouge (Le Caire / Louxor / Hurghada)',
      'Circuit Merveilles d''Égypte & Mer Rouge (Le Caire / Assouan / Louxor / Hurghada)',
      'Croisière au fil du Nil de Assouan vers Louxor (4 jours et 3 nuits)',
      'Croisière au fil du Nil de Louxor vers Assouan (5 jours et 4 nuits)'
    );

-- Remplace la fonction de 0190 : ajoute le filtre exclu_suggestions.
-- security definer : lit `reservations` mais ne renvoie que des
-- activités et un compte de clients — jamais de client_id.
create or replace function activites_co_reservees(p_activite uuid, p_limite int default 3)
returns table (id uuid, nom text, slug text, photo_path text, clients bigint)
language sql stable security definer
set search_path = public
as $$
  with resa as (
    select r.client_id,
           coalesce(r.catalogue_item_id, c0.id) as activite_id
    from reservations r
    left join catalogue_activites c0 on c0.nom = btrim(r.nom_activite)
    where r.client_id is not null
  )
  select c.id,
         coalesce(nullif(c.nom_affichage, ''), c.nom),
         c.slug,
         c.photo_path,
         count(distinct a.client_id)
  from resa a
  join resa b on b.client_id = a.client_id and b.activite_id = p_activite
  join catalogue_activites c on c.id = a.activite_id
  where a.activite_id is distinct from p_activite
    and c.valide
    and not c.exclu_suggestions
  group by c.id, c.nom, c.nom_affichage, c.slug, c.photo_path
  having count(distinct a.client_id) >= 3
  order by 5 desc
  limit greatest(p_limite, 1);
$$;

revoke all on function activites_co_reservees(uuid, int) from public;
grant execute on function activites_co_reservees(uuid, int) to anon, authenticated;
