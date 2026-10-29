-- État quotidien de "Luis" (LuisAssistant.tsx), le coéquipier CRM qui
-- rappelle de faire les 3 vérifications de dossier par jour — demande de
-- Mélanie, 2026-10-29. Une ligne par personne et par jour : combien de
-- rappels déjà envoyés aujourd'hui (1er = normal, 2e = avertissement, 3e =
-- navigation forcée vers Suivis > Vérification de dossier + garde de
-- sortie), et une éventuelle fenêtre "urgence en cours" qui débloque
-- temporairement la garde (10 minutes, auto-expire — pas de validation de
-- Mélanie nécessaire, elle est juste informée après coup via les notes
-- d'équipe/l'historique).
create table if not exists luis_etat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  rappels_envoyes int not null default 0,
  dernier_rappel_at timestamptz,
  urgence_jusqua timestamptz,
  unique (user_id, date)
);

alter table luis_etat enable row level security;

create policy "team read luis_etat" on luis_etat for select to authenticated using (true);
create policy "team insert luis_etat" on luis_etat for insert to authenticated with check (true);
create policy "team update luis_etat" on luis_etat for update to authenticated using (true);
