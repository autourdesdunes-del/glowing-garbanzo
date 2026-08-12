-- Horodatage précis (pas juste une date) du moment où le billet d'avion a
-- été reçu/téléchargé (étape "a_envoyer_client") — sert d'ancrage aux
-- rappels "pensez à l'envoyer au client" (1h puis toutes les 3h), qui ont
-- besoin d'heures, pas seulement de jours.
alter table reservations
  add column if not exists billet_recu_le timestamptz;

notify pgrst, 'reload schema';
