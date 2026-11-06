-- BRIEF_DESIGN_FICHE.md §9 (2026-11-06) : "un seul hôtel pour toute
-- l'application" — mémorisé sous le jeton anonyme de navigateur, le
-- même que les favoris et le fil de discussion, pas seulement en
-- localStorage (qui ne couvre que l'appareil courant et peut être
-- effacé indépendamment du reste). Une cliente qui a donné son hôtel
-- dans la conversation ne doit jamais avoir à le redonner dans le
-- tunnel, ni inversement.
create table if not exists jeton_hotel (
  jeton text primary key,
  hotel_texte text not null default '',
  zone_hotel text not null default '',
  personnes int not null default 2,
  updated_at timestamptz not null default now()
);

alter table jeton_hotel enable row level security;

-- Même discipline que `favoris` : aucun accès anon direct, toute
-- lecture/écriture passe par une route API côté serveur (service role).
create policy "jeton_hotel_all_authenticated"
  on jeton_hotel for all
  to authenticated
  using (true)
  with check (true);
