-- Cache des taux de change EGP -> EUR, un taux par jour calendaire — sert
-- à convertir les coûts prestataires (donnés en EGP par Mélanie) en euros
-- au taux du jour de l'activité, pour pouvoir comparer avec le CA (en
-- euros) et calculer un bénéfice. Récupéré depuis une API externe
-- (fawazahmed0/currency-api) et mis en cache ici pour ne pas la
-- re-questionner à chaque calcul et pour continuer à fonctionner si elle
-- devient indisponible plus tard.
create table if not exists fx_rates_egp_eur (
  date text primary key,
  eur_per_egp numeric not null,
  created_at timestamptz not null default now()
);

alter table fx_rates_egp_eur enable row level security;

-- Lu par le calcul de coût (API serveur, rôle admin) et par personne pour
-- éviter une re-requête réseau si un employé sans accès marge déclenche
-- indirectement un calcul — mais ne contient aucune donnée business
-- sensible (juste un taux de change public), donc pas besoin de la
-- restreindre comme reservation_couts.
create policy "team full access" on fx_rates_egp_eur
  for all to authenticated using (true) with check (true);
