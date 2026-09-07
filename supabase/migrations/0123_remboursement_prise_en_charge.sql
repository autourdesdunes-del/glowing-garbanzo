-- Un remboursement "Dédommagement" (activité livrée mais compensée, ex.
-- excursion ratée) n'a pas le même impact sur le CA/la marge de Direction
-- selon QUI paie réellement le geste :
--   - l'agence elle-même : c'est un vrai coût, ça grignote la marge ;
--   - le prestataire (bateau, hôtel...) qui rembourse l'agence qui reverse
--     ensuite au client : opération neutre pour l'agence, ni CA ni marge
--     ne doivent bouger.
-- L'employée qui saisit le dédommagement ne sait presque jamais lequel des
-- deux cas s'applique (ça se règle après coup avec le prestataire) — ce
-- champ est donc éditable uniquement côté Direction, une fois la vraie
-- réponse connue. Par défaut "prestataire" (neutre) : on ne veut jamais
-- présumer à tort que l'agence a payé de sa poche et sous-évaluer la marge
-- avant d'être sûr.
alter table remboursements
  add column if not exists prise_en_charge text not null default 'prestataire'
  check (prise_en_charge in ('agence', 'prestataire'));

notify pgrst, 'reload schema';
