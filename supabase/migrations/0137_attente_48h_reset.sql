-- "Nettoie le tableau sans réponse depuis 48h, fais repartir le compteur à
-- zéro à partir d'aujourd'hui" (Mélanie, 2026-09-19). Champ dédié plutôt que
-- de réutiliser kommo_last_team_reply_at, qui sert aussi à afficher "dernier
-- contact" ailleurs (fiche prospect) — on ne veut pas faire croire que
-- l'équipe a répondu à ces 653 clients aujourd'hui.
alter table clients
  add column if not exists attente_ack_at timestamptz;
