-- Accès public en lecture seule au catalogue, pour la future vitrine publique
-- (projet séparé "autour-des-dunes-vitrine") — elle n'utilise que la clé
-- anon, jamais le service role. N'ouvre QUE ces 3 tables en lecture : aucun
-- accès écriture, aucune autre table (clients, réservations, paiements...
-- restent strictement réservés à l'équipe authentifiée).
create policy "public read catalogue_activites" on catalogue_activites
  for select to anon using (valide = true);

create policy "public read catalogue_tarifs" on catalogue_tarifs
  for select to anon using (
    exists (
      select 1 from catalogue_activites
      where catalogue_activites.id = catalogue_tarifs.catalogue_item_id
        and catalogue_activites.valide = true
    )
  );

create policy "public read catalogue_options" on catalogue_options
  for select to anon using (
    exists (
      select 1 from catalogue_activites
      where catalogue_activites.id = catalogue_options.catalogue_item_id
        and catalogue_activites.valide = true
    )
  );
