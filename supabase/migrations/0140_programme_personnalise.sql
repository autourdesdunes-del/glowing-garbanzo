-- Certaines activités ont besoin d'un vrai programme détaillé propre à ce
-- client (ex. circuit Louxor 2 jours avec horaires, étapes jour par jour),
-- distinct du champ "info_importante" qui reste un court badge affiché à
-- côté du titre (ex. "Allergie"). Texte libre multi-lignes, optionnel,
-- propre à cette réservation — ne touche pas au champ "programme" du
-- catalogue (générique, valable pour tous les clients).
alter table reservations
  add column if not exists programme_personnalise text not null default '';
