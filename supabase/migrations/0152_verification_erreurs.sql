-- Outil de vérification de dossier (Suivis > Vérification de dossier) : au
-- lieu d'une simple signature à l'aveugle, détecte maintenant des erreurs
-- concrètes dans le dossier (programme incohérent, remboursement mal
-- renseigné, reste à payer non suivi, doublon...). Ces erreurs sont
-- calculées à la volée (jamais stockées) — seule la trace d'une erreur
-- explicitement "passée" (vue, non corrigée tout de suite) est conservée
-- ici, pour accountability et pour que le dossier reste visible dans
-- "à vérifier" tant que l'erreur existe réellement encore.
create table if not exists verification_erreurs_passees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  -- Code stable de la règle (ex. "programme_conflit", "remboursement_paypal_manquant")
  -- — voir ERREUR_CODES dans src/lib/dossierErreurs.ts.
  erreur_code text not null,
  -- Texte de l'erreur au moment où elle a été passée (snapshot, pas recalculé).
  erreur_message text not null default '',
  passe_nom text not null default '',
  passe_par_id uuid,
  created_at timestamptz not null default now()
);

alter table verification_erreurs_passees enable row level security;

create policy "team read erreurs passees" on verification_erreurs_passees for select to authenticated using (true);
create policy "team insert erreurs passees" on verification_erreurs_passees for insert to authenticated with check (true);
