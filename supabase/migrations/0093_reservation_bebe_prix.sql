-- Le bébé n'avait aucun tarif au niveau d'une réservation (pu_bebe
-- n'existait que sur le catalogue, jamais copié ni utilisé dans le calcul
-- du total) — pourtant certaines activités (ex. Le Caire en avion) ont un
-- vrai tarif bébé, pas toujours 0€. Ajoute pu_bebe (tarif "par personne" et
-- réutilisé comme "PU bébé supp." en forfait groupe, comme le fait déjà le
-- catalogue), participants_bebes (nombre de bébés en mode participants
-- personnalisés) et participants_extra_bebes (nombre de bébés supp. en
-- forfait groupe).
alter table reservations
  add column if not exists pu_bebe numeric not null default 0,
  add column if not exists participants_bebes integer not null default 0,
  add column if not exists participants_extra_bebes integer not null default 0;

notify pgrst, 'reload schema';
