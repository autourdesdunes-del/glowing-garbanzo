-- Feu vert de Mélanie le 2026-11-09 — préalable obligatoire avant
-- l'inscription libre par email de BRIEF_COMPTE_CLIENT.md.
--
-- Jusqu'ici, "to authenticated" voulait dire "l'équipe" par construction :
-- seule l'équipe pouvait créer un compte Supabase Auth. BRIEF_COMPTE_
-- CLIENT.md fait tomber cette hypothèse — un compte client (comptes_
-- clients) est lui aussi "authenticated". Toute règle "to authenticated
-- using (true)" (ou "with check (true)") sans autre condition devenait
-- donc un accès complet au CRM pour n'importe quel visiteur créant un
-- compte sur la vitrine.
--
-- Cette migration ne change AUCUNE règle qui vérifie déjà un rôle précis
-- (reservation_couts le fait depuis 0025_cout_reel_direction_only.sql —
-- la seule table correctement protégée avant ce chantier, laissée
-- intacte) : seules les règles littéralement "true" sont concernées.

-- Fonctions utilitaires — security definer pour ne jamais redéclencher
-- les policies de `profiles` elles-mêmes (pas de récursion), même une
-- fois que la policy de lecture de `profiles` est elle-même réécrite
-- ci-dessous.
create or replace function est_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where profiles.id = auth.uid())
$$;

create or replace function est_direction()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where profiles.id = auth.uid() and role = 'direction')
$$;

-- Parcourt toutes les règles "to authenticated" dont la seule condition
-- était littéralement "true", et leur ajoute est_equipe() — sur l'état
-- réel de la base au moment de l'exécution, pas une liste figée à la
-- main (plus sûr qu'un copier-coller de 88 "alter policy"). Affiche
-- chaque règle modifiée (NOTICE) pour qu'on ait la liste exacte dans le
-- panneau de résultats du SQL Editor au lieu de devoir me la redonner.
do $$
declare
  pol record;
  total int := 0;
begin
  for pol in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and 'authenticated' = any(roles)
      and (
        (cmd = 'INSERT' and with_check = 'true')
        or (cmd in ('SELECT', 'DELETE') and qual = 'true')
        -- UPDATE/ALL sans WITH CHECK explicite : Postgres réutilise alors
        -- USING comme condition de vérification, donc with_check vaut
        -- NULL dans pg_policies même si la règle est bien "true" partout.
        or (cmd in ('UPDATE', 'ALL') and qual = 'true' and (with_check = 'true' or with_check is null))
      )
  loop
    if pol.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (est_equipe())', pol.policyname, pol.tablename);
    elsif pol.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on public.%I using (est_equipe())', pol.policyname, pol.tablename);
    else
      execute format('alter policy %I on public.%I using (est_equipe()) with check (est_equipe())', pol.policyname, pol.tablename);
    end if;
    total := total + 1;
    raise notice 'Restreinte à l''équipe : % . % (%)', pol.tablename, pol.policyname, pol.cmd;
  end loop;
  raise notice '--- % règle(s) restreinte(s) à l''équipe (profiles) ---', total;
end $$;
