-- Prénom affiché à la place de l'e-mail dans le Planning équipe. Modifiable
-- uniquement par la Direction (comme le rôle), avec un with check qui
-- interdit explicitement de changer le rôle par ce biais — on ne veut pas
-- qu'une future UI de gestion des prénoms ouvre une voie de promotion.

alter table profiles add column if not exists prenom text not null default '';

create policy "direction update profile" on profiles for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction'))
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'direction')
    and role = (select p2.role from profiles p2 where p2.id = profiles.id)
  );
