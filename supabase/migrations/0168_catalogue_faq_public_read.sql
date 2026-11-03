-- Accès public en lecture seule aux FAQ du catalogue (223 questions déjà
-- rédigées côté CRM), même logique que la migration 0162 pour
-- catalogue_tarifs/catalogue_options : uniquement les FAQ des activités
-- validées, aucun accès écriture.
create policy "public read catalogue_faq" on catalogue_faq
  for select to anon using (
    exists (
      select 1 from catalogue_activites
      where catalogue_activites.id = catalogue_faq.catalogue_item_id
        and catalogue_activites.valide = true
    )
  );
