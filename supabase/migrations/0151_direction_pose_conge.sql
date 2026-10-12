-- La Direction peut poser un congé directement pour quelqu'un (déjà validé),
-- sans passer par la personne elle-même — jusqu'ici seule une demande
-- "pour soi-même" (statut En attente, à valider ensuite) était permise.

create policy "direction insert conge for anyone" on conges for insert to authenticated
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'));
