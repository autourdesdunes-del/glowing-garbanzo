-- Horodatage précis (avec l'heure) du rattachement automatique d'un
-- paiement PayPal à un dossier client — jusqu'ici seule la date était
-- gardée (acompte_date_encaissement), l'heure du webhook PayPal était
-- tronquée. Rempli uniquement par ce flux automatique ; une saisie
-- manuelle de l'encaissement n'a pas d'heure fiable et laisse ce champ
-- vide.
alter table clients
  add column if not exists acompte_encaisse_ts timestamptz;

notify pgrst, 'reload schema';
