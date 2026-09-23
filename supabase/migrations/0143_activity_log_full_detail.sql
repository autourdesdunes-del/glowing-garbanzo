-- Mélanie veut pouvoir tout retracer en détail sur une fiche client — qui a
-- fait quoi, dans une journée — pas seulement les quelques événements
-- "significatifs" retenus jusqu'ici (voir 0121). Cette migration :
--
-- 1. Ajoute une colonne `changes` (jsonb) à activity_log : un diff complet
--    {champ: {old, new}} pour CHAQUE colonne qui a changé sur un UPDATE de
--    `clients`, pas seulement les 8 cas particuliers déjà détectés.
-- 2. Insère désormais une ligne pour TOUT update sur `clients` dès qu'au
--    moins un champ "utile" a changé, en excluant une liste documentée de
--    colonnes de synchro/bookkeeping qui changent seules, sans action
--    humaine (updated_at, kommo_synced_at, les champs kommo_*_estime
--    alimentés par l'IA d'extraction, notion_*...) — sans cette exclusion,
--    l'historique retomberait dans le bruit qui avait motivé 0121.
-- 3. Garde description (texte court, les 8 cas déjà gérés + un résumé
--    générique pour tout le reste) pour ne rien casser côté affichage
--    existant (client-steps.tsx lit `description`), et ajoute `changes`
--    pour l'affichage détaillé à venir (Journal d'activité, Direction).

alter table activity_log add column if not exists changes jsonb;

create or replace function log_activity() returns trigger as $$
declare
  actor text;
  cid uuid;
  rid uuid;
  desc_text text;
  changes_json jsonb;
  k text;
  old_row jsonb;
  new_row jsonb;
  -- Colonnes qui changent seules (sync Kommo/Notion, IA d'extraction,
  -- horodatages techniques) — jamais le résultat d'une manip humaine sur la
  -- fiche, donc jamais assez "significatif" pour l'historique. Documenté ici
  -- plutôt que dans le code applicatif pour rester la seule source de
  -- vérité (le trigger tourne même sur une écriture directe en base).
  ignored_cols text[] := array[
    'updated_at', 'kommo_synced_at', 'kommo_last_client_message_at',
    'kommo_last_team_reply_at', 'kommo_extraction_updated_at',
    'kommo_premier_echange_le', 'kommo_resume', 'kommo_sejour_debut_estime',
    'kommo_sejour_fin_estime', 'kommo_hotel_estime', 'kommo_nb_adultes_estime',
    'kommo_nb_enfants_estime', 'kommo_ages_enfants_estime',
    'kommo_activites_interet', 'kommo_activites_a_eviter',
    'kommo_etape_detectee', 'kommo_demande_infos_envoyee_le',
    'kommo_programme_envoye_resume', 'notion_page_id', 'notion_synced_at',
    'attente_ack_at', 'doublon_possible_id'
  ];
begin
  select email into actor from auth.users where id = auth.uid();
  desc_text := null;
  changes_json := null;

  if TG_TABLE_NAME = 'clients' then
    if TG_OP = 'DELETE' then
      rid := old.id;
      cid := old.id;
    else
      rid := new.id;
      cid := new.id;
      if TG_OP = 'UPDATE' then
        old_row := to_jsonb(old);
        new_row := to_jsonb(new);
        changes_json := '{}'::jsonb;
        for k in select jsonb_object_keys(new_row) loop
          if k <> all(ignored_cols) and old_row -> k is distinct from new_row -> k then
            changes_json := changes_json || jsonb_build_object(
              k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k)
            );
          end if;
        end loop;
        if changes_json = '{}'::jsonb then
          changes_json := null;
        end if;

        if old.solde_paye is distinct from new.solde_paye and new.solde_paye then
          desc_text := 'a marqué le solde comme payé';
        elsif old.solde_paye is distinct from new.solde_paye and old.solde_paye and not new.solde_paye then
          desc_text := 'a annulé le paiement du solde (précédemment marqué payé)';
        elsif old.acompte_paye is distinct from new.acompte_paye and new.acompte_paye then
          desc_text := 'a marqué l''acompte comme encaissé';
        elsif old.acompte_paye is distinct from new.acompte_paye and old.acompte_paye and not new.acompte_paye then
          desc_text := 'a annulé le paiement de l''acompte (précédemment marqué encaissé)';
        elsif old.reprise_montant is distinct from new.reprise_montant and new.reprise_montant > 0 then
          desc_text := 'a enregistré un nouveau règlement en attente ('
            || replace(to_char(new.reprise_montant, 'FM999999990.00'), '.', ',') || ' €)';
        elsif old.paiement_type is distinct from new.paiement_type then
          desc_text := 'a changé le type de paiement : '
            || coalesce(nullif(old.paiement_type, ''), '—') || ' → ' || coalesce(nullif(new.paiement_type, ''), '—');
        elsif old.statut is distinct from new.statut then
          desc_text := 'a changé le statut : ' || coalesce(old.statut, '—') || ' → ' || coalesce(new.statut, '—');
        elsif (
            old.solde_rdv_heure is distinct from new.solde_rdv_heure
            or old.solde_rdv_lieu is distinct from new.solde_rdv_lieu
            or old.solde_date is distinct from new.solde_date
          )
          and coalesce(new.solde_rdv_heure, '') <> '' then
          desc_text := 'a planifié/modifié le RDV paiement du '
            || coalesce(to_char(new.solde_date, 'DD/MM/YYYY'), '—') || ' à ' || coalesce(nullif(new.solde_rdv_heure, ''), '—')
            || case when coalesce(new.solde_rdv_lieu, '') <> '' then ' (' || new.solde_rdv_lieu || ')' else '' end;
        elsif (old.solde_rdv_heure is distinct from new.solde_rdv_heure or old.solde_rdv_lieu is distinct from new.solde_rdv_lieu)
          and coalesce(old.solde_rdv_heure, '') <> ''
          and coalesce(new.solde_rdv_heure, '') = '' then
          desc_text := 'a supprimé/annulé le RDV paiement du '
            || coalesce(to_char(old.solde_date, 'DD/MM/YYYY'), '—') || ' à ' || coalesce(nullif(old.solde_rdv_heure, ''), '—');
        elsif changes_json is not null then
          -- Repli générique : au moins un champ "utile" a changé sans
          -- correspondre à un des cas ci-dessus — toujours tracé (avec le
          -- détail dans `changes`), avec un résumé lisible listant les
          -- champs concernés plutôt qu'aucune ligne du tout.
          desc_text := 'a modifié : ' || (
            select string_agg(key, ', ' order by key) from jsonb_object_keys(changes_json) as key
          );
        end if;
      end if;
    end if;

    -- Toujours tracer une création/suppression ; pour un update, seulement
    -- si au moins un champ "utile" (hors liste d'exclusion) a changé.
    if TG_OP = 'UPDATE' and changes_json is null then
      return new;
    end if;

    insert into activity_log (client_id, table_name, record_id, action, actor_email, description, changes)
    values (cid, TG_TABLE_NAME, rid, lower(TG_OP), actor, desc_text, changes_json);

  else
    if TG_OP = 'DELETE' then
      rid := old.id;
      cid := old.client_id;
    else
      rid := new.id;
      cid := new.client_id;
    end if;

    if TG_TABLE_NAME = 'reservations' then
      if TG_OP = 'INSERT' then
        desc_text := 'a ajouté l''activité « ' || coalesce(new.nom_activite, 'sans nom') || ' »';
      elsif TG_OP = 'DELETE' then
        desc_text := 'a supprimé l''activité « ' || coalesce(old.nom_activite, 'sans nom') || ' »';
      elsif TG_OP = 'UPDATE' then
        old_row := to_jsonb(old);
        new_row := to_jsonb(new);
        changes_json := '{}'::jsonb;
        for k in select jsonb_object_keys(new_row) loop
          if k <> 'updated_at' and old_row -> k is distinct from new_row -> k then
            changes_json := changes_json || jsonb_build_object(
              k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k)
            );
          end if;
        end loop;
        if changes_json = '{}'::jsonb then changes_json := null; end if;
        if old.statut_resa is distinct from new.statut_resa and new.statut_resa = 'Annulée' then
          desc_text := 'a annulé l''activité « ' || coalesce(new.nom_activite, 'sans nom') || ' »';
        elsif old.statut_resa is distinct from new.statut_resa and new.statut_resa = 'Confirmée' then
          desc_text := 'a confirmé l''activité « ' || coalesce(new.nom_activite, 'sans nom') || ' »';
        else
          desc_text := 'a modifié l''activité « ' || coalesce(new.nom_activite, 'sans nom') || ' »';
        end if;
      end if;

    elsif TG_TABLE_NAME = 'remboursements' then
      if TG_OP = 'INSERT' then
        desc_text := 'a ajouté un remboursement'
          || case when new.montant is not null and new.montant > 0
               then ' de ' || replace(to_char(new.montant, 'FM999999990.00'), '.', ',') || ' €' else '' end;
      elsif TG_OP = 'DELETE' then
        desc_text := 'a supprimé un remboursement';
      else
        desc_text := 'a modifié un remboursement';
      end if;

    elsif TG_TABLE_NAME = 'paiements_etapes' then
      if TG_OP = 'INSERT' then
        desc_text := 'a enregistré un paiement de ' || replace(to_char(new.montant, 'FM999999990.00'), '.', ',')
          || ' € (' || coalesce(new.mode, '—') || ')';
      elsif TG_OP = 'DELETE' then
        desc_text := 'a supprimé un paiement de ' || replace(to_char(old.montant, 'FM999999990.00'), '.', ',') || ' €';
      else
        desc_text := 'a modifié un paiement de ' || replace(to_char(new.montant, 'FM999999990.00'), '.', ',') || ' €';
      end if;
    end if;

    insert into activity_log (client_id, table_name, record_id, action, actor_email, description, changes)
    values (cid, TG_TABLE_NAME, rid, lower(TG_OP), actor, desc_text, changes_json);
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer;
