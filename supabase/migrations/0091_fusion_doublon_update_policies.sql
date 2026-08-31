-- La fusion de doublons (DoublonPossibleAlert > "Fusionner") réattribue
-- client_id sur toutes les tables qui en dépendent, dont activity_log et
-- kommo_reponses_employe — qui n'avaient jusqu'ici qu'une policy "select"
-- (et "insert" pour activity_log), pas de "update". Résultat : la
-- réattribution passait sans erreur mais ne faisait rien sur ces deux
-- tables (RLS bloque silencieusement une UPDATE sans policy correspondante).
-- On aligne sur le reste (team full access) plutôt que d'ajouter juste
-- "update" pour rester cohérent avec le pattern du projet.
drop policy if exists "team read activity_log" on activity_log;
drop policy if exists "team insert activity_log" on activity_log;
create policy "team full access" on activity_log for all to authenticated using (true) with check (true);

drop policy if exists "team read kommo reponses" on kommo_reponses_employe;
create policy "team full access" on kommo_reponses_employe for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
