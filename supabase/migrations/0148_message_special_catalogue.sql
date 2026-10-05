-- Certaines activités (ex. Louxor en mini-bus) ont besoin d'un paragraphe
-- d'instructions spécifique dans le message client pick-up (breakfast box,
-- late dinner...) à la place de la simple liste "à prévoir". Ce champ,
-- quand rempli, remplace entièrement la ligne "N'oubliez pas d'emporter..."
-- dans pickupClientMessage().
alter table catalogue_activites add column if not exists message_special text not null default '';

notify pgrst, 'reload schema';
