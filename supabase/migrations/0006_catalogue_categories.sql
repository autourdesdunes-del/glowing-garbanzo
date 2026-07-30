-- Catégories pour le catalogue, utile pour s'y retrouver une fois les ~70
-- vraies activités saisies.

alter table catalogue_activites
  add column if not exists categorie text not null default 'Excursion'
    check (categorie in ('Excursion', 'Transfert', 'Séjour multi-jours', 'Autre'));
