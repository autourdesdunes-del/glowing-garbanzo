-- Recherche tolérante aux fautes de frappe sur hotels_reference.nom — un
-- client qui tape "jaz aquaviva", "Jazz Aqua Viva", "desert rose" ou
-- "alibaba" doit retrouver son hôtel malgré la faute (voir Mélanie,
-- 2026-11-05). pg_trgm est natif sur Supabase, pas d'extension externe à
-- payer ou héberger.
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Normalisation commune au nom stocké et à la saisie du client :
-- minuscules, accents retirés, espaces et ponctuation entièrement
-- supprimés (pas réduits à un espace — "alibaba" doit retrouver "Ali Baba
-- Palace Hotel", testé et corrigé le 2026-11-05). Déclarée immutable pour
-- servir dans l'index GIN ci-dessous — unaccent() dépend d'un dictionnaire
-- qui ne change pas en pratique, pattern standard pour l'indexer malgré sa
-- volatilité STABLE déclarée. search_path explicite : Supabase installe
-- ses extensions dans le schéma "extensions", pas "public" — sans ça
-- unaccent() est introuvable au moment de l'exécution.
create or replace function normaliser_nom_hotel(texte text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select regexp_replace(lower(unaccent(coalesce(texte, ''))), '[^a-z0-9]+', '', 'g');
$$;

-- La fonction a changé de définition : l'index construit sur son ancienne
-- sortie (espaces conservés) doit être reconstruit, sinon il reste bâti
-- sur des valeurs obsolètes.
drop index if exists hotels_reference_nom_normalise_trgm_idx;
create index hotels_reference_nom_normalise_trgm_idx
  on hotels_reference using gin (normaliser_nom_hotel(nom) gin_trgm_ops);

-- similarity() seule rate parfois une correspondance partielle évidente
-- (ex. "aquaviva" contre "Jaz Aqua Viva Resort & Spa", nom bien plus long
-- que la saisie) — le OR avec une correspondance substring sur le nom
-- normalisé couvre ce cas, tout en gardant similarity() pour les fautes de
-- frappe proprement dites.
create or replace function rechercher_hotels_flou(recherche text, seuil real default 0.3, limite int default 8)
returns table(nom text, ville text, score real)
language sql
stable
set search_path = public, extensions
as $$
  select nom, ville,
    greatest(
      similarity(normaliser_nom_hotel(nom), normaliser_nom_hotel(recherche)),
      case when normaliser_nom_hotel(nom) like '%' || normaliser_nom_hotel(recherche) || '%'
        then 1.0 else 0.0 end
    ) as score
  from hotels_reference
  where similarity(normaliser_nom_hotel(nom), normaliser_nom_hotel(recherche)) > seuil
     or normaliser_nom_hotel(nom) like '%' || normaliser_nom_hotel(recherche) || '%'
  order by score desc, nom
  limit limite;
$$;
