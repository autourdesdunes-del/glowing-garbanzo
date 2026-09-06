-- L'historique des modifications d'un client était noyé sous des dizaines
-- de lignes "a modifié la fiche client" sans aucun détail : la fonction
-- log_activity() insérait une ligne à CHAQUE update de la table clients,
-- même quand aucun des champs suivis (solde_paye, acompte_paye,
-- reprise_montant, paiement_type, statut) n'avait changé — donc à chaque
-- champ modifié en cours de remplissage d'une fiche (hôtel, canal, notes,
-- numéro WhatsApp...). Vécu : 12 lignes vides en 2 minutes en remplissant un
-- seul nouveau client, noyant les vrais changements (statut, paiement...)
-- dans le bruit. On saute désormais l'insertion quand aucun texte
-- descriptif n'a pu être généré pour un UPDATE sur clients — la création et
-- la suppression d'un client restent toujours tracées.
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
        elsif old.acompte_paye is distinct from new.acompte_paye and new.acompte_paye then
          desc_text := 'a marqué l''acompte comme encaissé';
        elsif old.reprise_montant is distinct from new.reprise_montant and new.reprise_montant > 0 then
          desc_text := 'a enregistré un nouveau règlement en attente ('
            || replace(to_char(new.reprise_montant, 'FM999999990.00'), '.', ',') || ' €)';
        elsif old.paiement_type is distinct from new.paiement_type then
          desc_text := 'a changé le type de paiement : '
            || coalesce(nullif(old.paiement_type, ''), '—') || ' → ' || coalesce(nullif(new.paiement_type, ''), '—');
        elsif old.statut is distinct from new.statut then
          desc_text := 'a changé le statut : ' || coalesce(old.statut, '—') || ' → ' || coalesce(new.statut, '—');
        end if;
      end if;
    end if;

    -- Rien d'assez significatif n'a changé pour mériter une ligne dans
    -- l'historique — voir le commentaire en tête de fichier.
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
