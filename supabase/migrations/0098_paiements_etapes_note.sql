-- Chaque étape de paiement libre doit désormais porter une note expliquant
-- pourquoi elle existe (ex. "Client avait oublié le cash, payé en PayPal à
-- la place") — sans ça, le "Résumé des paiements" d'un dossier qui a
-- beaucoup changé (Romuald Pluyaud, Marjorie Nicot...) redevient une liste
-- de chiffres illisible. L'obligation est appliquée côté formulaire (pas en
-- contrainte SQL) pour ne pas casser les étapes déjà créées avant cette
-- migration, qui restent avec une note vide.
alter table paiements_etapes add column if not exists note text not null default '';

notify pgrst, 'reload schema';
