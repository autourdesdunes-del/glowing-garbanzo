-- Vente additionnelle, chantier 1 (BRIEF_VENTE_ADDITIONNELLE.md,
-- 2026-11-06) : "À découvrir aussi" sous chaque fiche, calculé en direct
-- depuis les réservations réelles plutôt qu'une table de 91 liens à
-- maintenir à la main (se périmerait, et au-delà de 4 paires chaque
-- paire ne repose que sur 3 à 5 clients).
--
-- security definer : la fonction lit `reservations` (table interne) mais
-- ne renvoie que des activités et un compte de clients — jamais de
-- client_id, jamais de donnée personnelle. Exécutable par anon : c'est
-- voulu, elle sert la fiche publique.
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
  group by c.id, c.nom, c.nom_affichage, c.slug, c.photo_path
  having count(distinct a.client_id) >= 3
  order by 5 desc
  limit greatest(p_limite, 1);
$$;

revoke all on function activites_co_reservees(uuid, int) from public;
grant execute on function activites_co_reservees(uuid, int) to anon, authenticated;

-- Mesure : sans ça impossible de savoir si le bloc rapporte (brief, 2026-11-06).
-- type: 'affichage' | 'clic'. Pas de reservation_id : l'attribution exacte
-- d'une vente à une suggestion demanderait un suivi de session bien plus
-- lourd, hors périmètre de ce chantier — voir le reporting avec Mélanie
-- avant de l'ajouter.
create table if not exists vente_additionnelle_evenements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('affichage', 'clic')),
  activite_source_id uuid not null references catalogue_activites(id) on delete cascade,
  activite_suggeree_id uuid not null references catalogue_activites(id) on delete cascade,
  mode text not null default 'sociale' check (mode in ('sociale', 'repli')),
  created_at timestamptz not null default now()
);

alter table vente_additionnelle_evenements enable row level security;

create policy "vente_additionnelle_evenements_insert_anon"
  on vente_additionnelle_evenements for insert
  to anon
  with check (true);

create policy "vente_additionnelle_evenements_select_authenticated"
  on vente_additionnelle_evenements for select
  to authenticated
  using (true);
