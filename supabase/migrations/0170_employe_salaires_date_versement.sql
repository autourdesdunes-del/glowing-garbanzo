-- Les vrais salaires de Sylvie (fournis par Mélanie, 2026-11-03) ne tombent
-- pas un par mois : parfois deux versements le même mois (avance + solde),
-- parfois un versement qui couvre le reste d'un mois précédent + le mois en
-- cours. La contrainte "un seul par mois" et le 1er du mois forcé (0169)
-- étaient une mauvaise hypothèse — on repasse sur la vraie date de
-- versement, sans unicité (autant de lignes que de versements réels).
alter table employe_salaires rename column mois to date_versement;
alter table employe_salaires drop constraint if exists employe_salaires_user_id_mois_key;

notify pgrst, 'reload schema';
