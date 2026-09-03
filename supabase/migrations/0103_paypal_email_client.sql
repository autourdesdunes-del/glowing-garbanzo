-- Adresse PayPal du client, enregistrée une seule fois (collée depuis la
-- conversation, jamais retapée de mémoire) et réutilisée à chaque
-- remboursement — une erreur de ressaisie a déjà envoyé un remboursement
-- à la mauvaise adresse (florence.degoulange@hotmail.fr au lieu de .com).
alter table clients
  add column if not exists paypal_email text not null default '';

notify pgrst, 'reload schema';
