-- L'affinité pure fait remonter des paires vues 3 fois sur des activités
-- rares (Spa → Safari Mix Quad/Buggy, Assouan privatif dans 10 fiches
-- sur 91) : un petit échantillon peut produire un score énorme. Mesuré
-- sur les 475 paniers réels : amortir par p.ensemble / (p.ensemble + 6)
-- dans le tri fait tomber le monopole max à 8 fiches (contre 6 avant,
-- avec le tri par affinité pure) pour la même couverture, mais des
-- suggestions cohérentes. Le seuil `ensemble >= 3` reste inchangé ; la
-- colonne `affinite` renvoyée reste le score pur (pas amorti), seul le
-- tri change.
create or replace function activites_co_reservees(p_activite uuid, p_limite int default 8)
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
  order by (p.ensemble * t.n / (fa.f * fb.f)) * (p.ensemble / (p.ensemble + 6)) desc, p.ensemble desc
  limit greatest(p_limite, 1);
$$;

revoke all on function activites_co_reservees(uuid, int) from public;
grant execute on function activites_co_reservees(uuid, int) to anon, authenticated;
