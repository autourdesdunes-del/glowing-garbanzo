-- Dernière activité de chaque employée dans le logiciel (pas Kommo) — pour
-- le rapport Manager > Gestion équipe ("temps d'inactivité"). Mis à jour
-- par un petit signal côté client (AppShell), pas à chaque action mais à
-- intervalle régulier tant que l'appli reste ouverte.
alter table profiles
  add column if not exists derniere_activite_le timestamptz;

notify pgrst, 'reload schema';
