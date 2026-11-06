-- Corrige 0195 : `create or replace function` ne peut pas changer la
-- structure de retour d'une fonction qui renvoie une table (Postgres
-- l'interdit — "cannot change return type of existing function"). 0195
-- ajoutait la colonne `affinite` à une fonction qui n'en avait pas : la
-- commande a donc échoué silencieusement pour cette partie, et la
-- fonction restait celle de 0194 (tri par popularité, pas d'affinité).
-- Vérifié en direct le 2026-11-06 : Louxor en mini-bus toujours dans le
-- top 3 de 27 fiches sur 91.
--
-- Cette fois : DROP explicite puis CREATE, pour que le changement de
-- structure passe réellement.
drop function if exists activites_co_reservees(uuid, int);

create function activites_co_reservees(p_activite uuid, p_limite int default 8)
returns table (id uuid, nom text, slug text, photo_path text, clients bigint, affinite numeric)
language sql stable security definer
set search_path = public
as $$
  with resa as (
    select distinct r.client_id,
           coalesce(r.catalogue_item_id, c0.id) as activite_id
    from reservations r
    left join catalogue_activites c0 on c0.nom = btrim(r.nom_activite)
    where r.client_id is not null
      and coalesce(r.catalogue_item_id, c0.id) is not null
  ),
  tot as (select count(distinct client_id)::numeric as n from resa),
  freq as (select activite_id, count(distinct client_id)::numeric as f from resa group by 1),
  paires as (
    select a.activite_id, count(distinct a.client_id)::numeric as ensemble
    from resa a
    join resa b on b.client_id = a.client_id and b.activite_id = p_activite
    where a.activite_id <> p_activite
    group by 1
  )
  select c.id,
         coalesce(nullif(c.nom_affichage, ''), c.nom),
         c.slug,
         c.photo_path,
         p.ensemble::bigint,
         round(p.ensemble * t.n / (fa.f * fb.f), 2) as affinite
  from paires p
  join catalogue_activites c on c.id = p.activite_id
  cross join tot t
  join freq fa on fa.activite_id = p_activite
  join freq fb on fb.activite_id = p.activite_id
  where c.valide
    and not c.exclu_suggestions
    and p.ensemble >= 3
  order by affinite desc, p.ensemble desc
  limit greatest(p_limite, 1);
$$;

revoke all on function activites_co_reservees(uuid, int) from public;
grant execute on function activites_co_reservees(uuid, int) to anon, authenticated;
