-- Qui a fait la dernière relance sur ce client — pour le pop-up personnel
-- "ça fait X jours que tu n'as pas relancé, il y a N prospects qui
-- attendent" (RelanceNudgeAlert). Rempli automatiquement dès qu'une
-- relance est marquée depuis maintenant (voir updateClientById dans
-- AppShell.tsx) — pas de reprise rétroactive, une fiche jamais relancée
-- depuis la mise en place reste vide ici.
alter table clients
  add column if not exists dernier_contact_par_id uuid references auth.users(id) on delete set null,
  add column if not exists dernier_contact_par_nom text not null default '';

notify pgrst, 'reload schema';
