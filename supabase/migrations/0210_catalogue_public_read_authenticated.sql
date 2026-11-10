-- Régression trouvée en direct par Mélanie le 2026-11-10 : une fois
-- connectée (compte client), son navigateur envoie ses requêtes en
-- "authenticated", plus en "anon". 0207 avait restreint la policy
-- "team full access" de catalogue_activites (et consorts) à est_equipe()
-- — correct pour écrire/supprimer, mais ça n'a jamais rouvert la
-- LECTURE aux clientes connectées, qui doivent voir le catalogue public
-- exactement comme une visiteuse anonyme (c'est la même donnée, déjà
-- publique). Symptôme : /favoris ne retrouvait plus aucune fiche une
-- fois le lien magique cliqué, alors que les mêmes requêtes marchaient
-- en navigation privée (anon).
--
-- Même clause que les policies "public read ..." (to anon) de 0162 et
-- 0168, simplement ouverte aussi à "authenticated" : le catalogue validé
-- est public, qu'on ait un compte ou non.
create policy "public read catalogue_activites authenticated" on catalogue_activites
  for select to authenticated using (valide = true);

create policy "public read catalogue_tarifs authenticated" on catalogue_tarifs
  for select to authenticated using (
    exists (
      select 1 from catalogue_activites
      where catalogue_activites.id = catalogue_tarifs.catalogue_item_id
        and catalogue_activites.valide = true
    )
  );

create policy "public read catalogue_options authenticated" on catalogue_options
  for select to authenticated using (
    exists (
      select 1 from catalogue_activites
      where catalogue_activites.id = catalogue_options.catalogue_item_id
        and catalogue_activites.valide = true
    )
  );

create policy "public read catalogue_faq authenticated" on catalogue_faq
  for select to authenticated using (
    exists (
      select 1 from catalogue_activites
      where catalogue_activites.id = catalogue_faq.catalogue_item_id
        and catalogue_activites.valide = true
    )
  );
