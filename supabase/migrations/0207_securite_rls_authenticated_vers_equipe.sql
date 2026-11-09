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

-- ⚠️ Correction du 2026-11-09 (relecture de Mélanie) : la boucle
-- générique ci-dessous était indiscriminée. Elle aurait restreint à
-- est_equipe() des tables de la vitrine où "authenticated" ne désigne
-- pas l'équipe mais la cliente elle-même (favoris, jeton_hotel,
-- demandes_reservation) — perte des favoris, de l'hôtel mémorisé, et de
-- la visibilité sur une demande en attente, soit l'inverse de ce que
-- BRIEF_COMPTE_CLIENT.md demande. Ces tables (plus deux tables d'analyse
-- interne, bénignes mais traitées explicitement plutôt que par la boucle
-- pour qu'elles n'apparaissent jamais dans ses NOTICES) sont donc
-- exclues de la boucle et corrigées une par une juste après.
--
-- Pas touchées non plus (déjà sur le bon modèle) : comptes_clients et
-- profils_clients, qui vérifient déjà `auth.uid() = id` / `= compte_id`
-- — jamais "true" — donc hors du filtre de toute façon.
--
-- ⚠️ Tables de la même famille (jeton/compte_id d'un visiteur) repérées
-- en écrivant cette migration mais PAS encore corrigées, faute de
-- mandat explicite : messagerie_conversations, messagerie_messages,
-- notifications_client. Je ne les ai pas touchées — à trancher avec
-- Mélanie avant de les inclure, voir le message qui accompagne cette
-- migration.
do $$
declare
  pol record;
  total int := 0;
  tables_exclues text[] := array[
    'favoris', 'jeton_hotel', 'demandes_reservation',
    'arbre_parcours', 'vente_additionnelle_evenements',
    -- Même famille, pas encore tranchées (voir le commentaire plus haut) —
    -- volontairement laissées de côté, pas un oubli : la vérification
    -- finale les signalera donc comme "restantes", c'est attendu.
    'messagerie_conversations', 'messagerie_messages', 'notifications_client'
  ];
begin
  for pol in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and 'authenticated' = any(roles)
      and tablename <> all(tables_exclues)
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

-- ── favoris : auth.uid() = compte_id, jamais est_equipe() ──────────────
-- L'équipe n'a aucun usage légitime de cette table (lue/écrite
-- uniquement par les routes API de la vitrine, jamais depuis le CRM) —
-- seule la cliente propriétaire de la ligne doit pouvoir la voir/modifier.
drop policy if exists "favoris_all_authenticated" on favoris;
create policy "favoris_self_access" on favoris
  for all to authenticated
  using (auth.uid() = compte_id)
  with check (auth.uid() = compte_id);

-- ── jeton_hotel : même principe, après lui avoir donné un compte_id ────
-- N'avait pas encore de compte_id (seul favoris/messagerie_conversations
-- l'ont reçu en 0205) — ajouté ici pour pouvoir écrire la même règle.
alter table jeton_hotel
  add column if not exists compte_id uuid references comptes_clients(id) on delete set null;

create index if not exists jeton_hotel_compte_id_idx on jeton_hotel (compte_id) where compte_id is not null;

drop policy if exists "jeton_hotel_all_authenticated" on jeton_hotel;
create policy "jeton_hotel_self_access" on jeton_hotel
  for all to authenticated
  using (auth.uid() = compte_id)
  with check (auth.uid() = compte_id);

-- ── demandes_reservation : l'équipe garde tout, la cliente voit les siennes ──
-- L'équipe doit garder l'accès complet (traiter les demandes de tout le
-- monde, pas seulement les siennes) — restreint à est_equipe() plutôt
-- qu'à "tout authentifié", jamais à auth.uid() = compte_id qui aurait
-- exclu l'équipe elle-même (elle n'a pas de ligne dans comptes_clients).
-- La cliente connectée, elle, n'avait jusqu'ici AUCUNE visibilité sur sa
-- propre demande (§4 de la correction du brief) : deux règles neuves
-- pour couvrir la lecture et, le panier étant désormais soumis en
-- authentifié une fois connectée, l'écriture (l'ancienne règle "insert
-- to anon" ne s'applique plus à elle une fois son compte créé).
alter table demandes_reservation
  add column if not exists compte_id uuid references comptes_clients(id) on delete set null;

create index if not exists demandes_reservation_compte_id_idx on demandes_reservation (compte_id) where compte_id is not null;

drop policy if exists "team full access demandes_reservation" on demandes_reservation;
create policy "team full access demandes_reservation" on demandes_reservation
  for all to authenticated
  using (est_equipe())
  with check (est_equipe());

create policy "demandes_reservation_select_self" on demandes_reservation
  for select to authenticated
  using (auth.uid() = compte_id);

create policy "demandes_reservation_insert_self" on demandes_reservation
  for insert to authenticated
  with check (auth.uid() = compte_id);

-- ── arbre_parcours / vente_additionnelle_evenements : analyse interne ──
-- Aucune colonne personnelle (ni jeton, ni compte_id) : une visiteuse
-- n'a jamais eu, et n'a toujours pas, de raison de lire ces tables —
-- seule l'équipe les consulte (reporting). Même résultat que la boucle
-- générique, mais écrit à la main pour ne jamais dépendre d'elle sur ces
-- deux tables.
drop policy if exists "arbre_parcours_select_authenticated" on arbre_parcours;
create policy "arbre_parcours_select_authenticated" on arbre_parcours
  for select to authenticated
  using (est_equipe());

drop policy if exists "vente_additionnelle_evenements_select_authenticated" on vente_additionnelle_evenements;
create policy "vente_additionnelle_evenements_select_authenticated" on vente_additionnelle_evenements
  for select to authenticated
  using (est_equipe());

-- ── Vérification finale ─────────────────────────────────────────────
-- Après la boucle ET les corrections à la main ci-dessus, il ne doit
-- plus rester nulle part une règle "to authenticated" sans aucune
-- condition — ni est_equipe(), ni auth.uid() = compte_id, rien. S'il en
-- reste une, c'est qu'une table a échappé à la fois à la boucle et à la
-- liste d'exclusion : à regarder avant de considérer ce chantier fini.
do $$
declare
  pol record;
  reste int := 0;
begin
  for pol in
    select tablename, policyname, cmd from pg_policies
    where schemaname = 'public'
      and 'authenticated' = any(roles)
      and (
        (cmd = 'INSERT' and with_check = 'true')
        or (cmd in ('SELECT', 'DELETE') and qual = 'true')
        or (cmd in ('UPDATE', 'ALL') and qual = 'true' and (with_check = 'true' or with_check is null))
      )
  loop
    reste := reste + 1;
    raise notice '⚠️ RESTE NON CORRIGÉE : %.% (%) — à traiter à la main.', pol.tablename, pol.policyname, pol.cmd;
  end loop;
  if reste = 0 then
    raise notice '✓ Vérification finale : plus aucune règle "authenticated" sans condition.';
  end if;
end $$;
