-- L'historique du dossier ne traçait aucun changement sur le RDV paiement
-- (solde_rdv_heure/lieu/date) ni les cas où un paiement déjà marqué payé
-- est ensuite démarqué/supprimé : log_activity() (voir 0121) ne générait un
-- desc_text que pour solde_paye devenant vrai, acompte_paye devenant vrai,
-- reprise_montant, paiement_type et statut — un update sur les seuls champs
-- solde_rdv_* était donc silencieusement ignoré (aucune ligne insérée, voir
-- le "if desc_text is null then return new" de 0121).
--
-- Repéré le 2026-09-20 : le RDV paiement d'une cliente a disparu de Suivis
-- > RDV paiements et de sa fiche sans qu'aucune ligne n'apparaisse dans
-- "Historique des modifications" — impossible de savoir qui avait fait quoi
-- ni quand, alors qu'un update avait bien eu lieu sur la table clients.
create or replace function log_activity() returns trigger as $$
declare
  actor text;
  cid uuid;
  rid uuid;
  desc_text text;
begin
  select email into actor from auth.users where id = auth.uid();
  desc_text := null;

  if TG_TABLE_NAME = 'clients' then
    if TG_OP = 'DELETE' then
      rid := old.id;
      cid := old.id;
    else
      rid := new.id;
      cid := new.id;
      if TG_OP = 'UPDATE' then
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
        end if;
      end if;
    end if;

    -- Rien d'assez significatif n'a changé pour mériter une ligne dans
    -- l'historique — voir 0121.
    if TG_OP = 'UPDATE' and desc_text is null then
      return new;
    end if;

    insert into activity_log (client_id, table_name, record_id, action, actor_email, description)
    values (cid, TG_TABLE_NAME, rid, lower(TG_OP), actor, desc_text);

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

    insert into activity_log (client_id, table_name, record_id, action, actor_email, description)
    values (cid, TG_TABLE_NAME, rid, lower(TG_OP), actor, desc_text);
  end if;

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer;
