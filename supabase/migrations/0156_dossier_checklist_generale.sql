-- Suivis > Vérification de dossier : vraie checklist générale à cocher à
-- gauche du panneau (DOSSIER_CHECKLIST_GENERALE dans
-- src/lib/dossierChecklistGenerale.ts), à la place des points détectés
-- automatiquement par le CRM — Mélanie ne veut pas d'une liste calculée,
-- mais une liste fixe que l'équipe coche à la main pendant la relecture
-- (demande du 2026-10-16). Remise à zéro à chaque nouvelle signature
-- ("Vérifié — signer") pour repartir propre au prochain tour.
create table if not exists dossier_checklist_coches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  -- Code stable de l'item — voir DOSSIER_CHECKLIST_GENERALE.
  item_code text not null,
  coche_par_nom text not null default '',
  coche_par_id uuid,
  updated_at timestamptz not null default now(),
  unique (client_id, item_code)
);

alter table dossier_checklist_coches enable row level security;

create policy "team read checklist coches" on dossier_checklist_coches for select to authenticated using (true);
create policy "team insert checklist coches" on dossier_checklist_coches for insert to authenticated with check (true);
create policy "team update checklist coches" on dossier_checklist_coches for update to authenticated using (true);
create policy "team delete checklist coches" on dossier_checklist_coches for delete to authenticated using (true);
