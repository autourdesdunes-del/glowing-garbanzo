-- Chaque employé peut voir SA PROPRE fiche (conditions d'emploi +
-- historique des salaires) depuis son compte — demande de Mélanie,
-- 2026-11-03. Lecture seule : aucune policy d'insert/update/delete pour
-- soi-même, seule Direction édite (voir policies "direction full access ..."
-- de la migration 0169).
create policy "self read employe_fiches" on employe_fiches
  for select to authenticated
  using (user_id = auth.uid());

create policy "self read employe_salaires" on employe_salaires
  for select to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
