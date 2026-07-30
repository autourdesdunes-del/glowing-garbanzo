-- Lien durable entre une réservation et le modèle catalogue dont elle est
-- issue (le prix reste copié au moment de la réservation, volontairement —
-- on ne veut pas que des dossiers déjà vendus changent de prix a posteriori,
-- mais on garde une trace pour le reporting Direction dans le temps).

alter table reservations
  add column if not exists catalogue_item_id uuid references catalogue_activites(id) on delete set null;
