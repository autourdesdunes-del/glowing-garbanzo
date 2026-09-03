-- Heure d'annulation (en plus de annulation_date), affichée sur le titre
-- barré rouge "(annulé le jj/mm à hh)" quand elle est connue — optionnelle,
-- une annulation sans heure précise reste affichable avec la date seule.
alter table reservations
  add column if not exists annulation_heure text not null default '';

-- Si le client avait déjà payé quelque chose (acompte encaissé ou solde
-- payé) au moment précis de l'annulation — figé à cet instant, jamais
-- recalculé plus tard avec l'état courant du client (qui peut évoluer
-- après coup, ex. solde payé plus tard pour d'autres activités). Distinct
-- de annulation_remb_avoir : une activité payée peut être annulée sans
-- remboursement accordé (non remboursable, ou exception refusée).
alter table reservations
  add column if not exists annulation_paye_avant boolean not null default false;

notify pgrst, 'reload schema';
