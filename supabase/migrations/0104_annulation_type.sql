-- Qui est à l'origine de l'annulation (client / agence / gouvernement) —
-- distinct de la raison (Météo, Client ne veut plus...) : une annulation
-- agence ou gouvernement est toujours remboursable sans passer par
-- l'exception Hossam (ce n'est jamais le client qui décide dans ce cas).
alter table reservations
  add column if not exists annulation_type text not null default 'client';

notify pgrst, 'reload schema';
