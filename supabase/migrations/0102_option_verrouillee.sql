-- Une option ajoutée automatiquement suite à un choix ferme de l'employée
-- (ex. "passer l'activité en privatif" après un jour indisponible) ne doit
-- plus pouvoir être modifiée ou supprimée ensuite, contrairement aux
-- options ajoutées normalement.
alter table reservation_options
  add column if not exists verrouille boolean not null default false;

notify pgrst, 'reload schema';
