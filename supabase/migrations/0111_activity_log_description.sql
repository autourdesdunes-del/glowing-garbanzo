-- L'historique des modifications ne disait jusqu'ici que "X a modifié la
-- fiche client" — impossible de savoir QUELLE activité a été ajoutée/
-- annulée, quel paiement a été touché, ou qu'un remboursement a été créé.
-- Le trigger construit maintenant une description lisible à partir de
-- l'ancienne/nouvelle ligne, pour les cas qui comptent le plus au
-- quotidien ; sans correspondance, on retombe sur le libellé générique
-- existant (affiché côté app quand description est vide).

alter table activity_log add column if not exists description text;

create or replace function log_activity() returns trigger as $$
declare
  actor text;
  cid uuid;
  rid uuid;
  desc_text text;
begin
  select email into actor from auth.users where id = auth.uid();

  if TG_OP = 'DELETE' then
    rid := old.id;
    cid := case TG_TABLE_NAME
      when 'clients' then old.id
      else old.client_id
    end;
  else
    rid := new.id;
    cid := case TG_TABLE_NAME
      when 'clients' then new.id
      else new.client_id
    end;
  end if;

  desc_text := null;

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
             then ' de ' || to_char(new.montant, 'FM999999990.00') || ' €' else '' end;
    elsif TG_OP = 'DELETE' then
      desc_text := 'a supprimé un remboursement';
    else
      desc_text := 'a modifié un remboursement';
    end if;

  elsif TG_TABLE_NAME = 'paiements_etapes' then
    if TG_OP = 'INSERT' then
      desc_text := 'a enregistré un paiement de ' || to_char(new.montant, 'FM999999990.00')
        || ' € (' || coalesce(new.mode, '—') || ')';
    elsif TG_OP = 'DELETE' then
      desc_text := 'a supprimé un paiement de ' || to_char(old.montant, 'FM999999990.00') || ' €';
    else
      desc_text := 'a modifié un paiement de ' || to_char(new.montant, 'FM999999990.00') || ' €';
    end if;

  elsif TG_TABLE_NAME = 'clients' and TG_OP = 'UPDATE' then
    if old.solde_paye is distinct from new.solde_paye and new.solde_paye then
      desc_text := 'a marqué le solde comme payé';
    elsif old.acompte_paye is distinct from new.acompte_paye and new.acompte_paye then
      desc_text := 'a marqué l''acompte comme encaissé';
    elsif old.reprise_montant is distinct from new.reprise_montant and new.reprise_montant > 0 then
      desc_text := 'a enregistré un nouveau règlement en attente ('
        || to_char(new.reprise_montant, 'FM999999990.00') || ' €)';
    elsif old.statut is distinct from new.statut then
      desc_text := 'a changé le statut : ' || coalesce(old.statut, '—') || ' → ' || coalesce(new.statut, '—');
    end if;
  end if;

  insert into activity_log (client_id, table_name, record_id, action, actor_email, description)
  values (cid, TG_TABLE_NAME, rid, lower(TG_OP), actor, desc_text);

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists log_paiements_etapes on paiements_etapes;
create trigger log_paiements_etapes after insert or update or delete on paiements_etapes
  for each row execute function log_activity();
