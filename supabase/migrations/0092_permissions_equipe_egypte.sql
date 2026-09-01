-- Équipe Égypte (Hossam, Bodé) : accès plus restreint que les conseillères
-- FR habituelles, et différent d'une personne à l'autre (Hossam voit plus
-- que Bodé) — pas un simple rôle binaire direction/equipe. On ajoute deux
-- listes d'exceptions par profil, vides par défaut pour ne rien changer
-- aux comptes existants (Mélanie, Sylvie, Laura, Justine) :
--   nav_masque       : clés d'onglets (Mode) à cacher dans la sidebar
--   suivis_visibles  : sous-onglets Suivis autorisés (null = tous, comme
--                      aujourd'hui ; un tableau vide/rempli restreint)
alter table profiles
  add column if not exists nav_masque text[] not null default '{}',
  add column if not exists suivis_visibles text[];

notify pgrst, 'reload schema';
