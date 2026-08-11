-- Enrichit le suivi des billets d'avion (onglet Suivis > Billets d'avion) :
-- une case "Vérif", les villes de départ/arrivée du vol, le nom complet du
-- client (à recopier tel quel au passeport pour Hossam/le prestataire), et
-- une case "Envoyé à Hossam" distincte de "Envoyé au client" (billet_envoye).

alter table reservations add column if not exists billet_verifie boolean not null default false;
alter table reservations add column if not exists billet_ville_depart text not null default '';
alter table reservations add column if not exists billet_ville_arrivee text not null default '';
alter table reservations add column if not exists billet_nom_complet text not null default '';
alter table reservations add column if not exists billet_envoye_hossam boolean not null default false;

notify pgrst, 'reload schema';
