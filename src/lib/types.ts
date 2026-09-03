export type ActivityLogEntry = {
  id: string;
  client_id: string | null;
  table_name: string;
  record_id: string;
  action: "insert" | "update" | "delete";
  actor_email: string | null;
  created_at: string;
};

export type CatalogueItem = {
  id: string;
  nom: string;
  categorie: string;
  tags: string[];
  description: string;
  disponibilites: string;
  jours_disponibles: string[];
  pu_adulte: number;
  pu_enfant: number;
  pu_bebe: number;
  pu_accompagnateur: number;
  pu_enfant_3ans: number;
  pu_adulte_age: string;
  pu_enfant_age: string;
  pu_bebe_age: string;
  pu_accompagnateur_age: string;
  tarif_mode: "personne" | "groupe";
  prix_groupe_base: number;
  prix_groupe_base_pax: number;
  prix_groupe_extra1: number;
  prix_groupe_extra1_age: string;
  prix_groupe_extra_enfant: number;
  prix_groupe_extra_enfant_age: string;
  prix_groupe_note: string;
  haute_saison_debut: string;
  haute_saison_fin: string;
  haute_saison_pu_adulte: number;
  haute_saison_pu_enfant: number;
  necessite_verif_hebergement_assouan: boolean;
  marge_pct: number;
  specificites: string;
  horaire_approx: string;
  duree: string;
  prochaine_disponibilite: string;
  prochaines_dispo_dates: string[];
  guide: string;
  guide_francophone_sur_demande: boolean;
  guide_egyptologue: boolean;
  guide_supplement: boolean;
  guide_supplement_prix: number;
  regle_annulation: "hurghada_24h" | "culturelle_48h" | "siwa_desert_10j" | "non_remboursable";
  programme: string;
  inclus: string;
  inclus_liste: string[];
  non_inclus: string;
  non_inclus_liste: string[];
  a_prevoir: string;
  a_prevoir_liste: string[];
  point_rdv: string;
  photo_path: string;
  valide: boolean;
  champs_requis_liste: string[];
  ordre: number;
  created_at: string;
  updated_at: string;
};

// Un emplacement du pack — une ou plusieurs activités catalogue
// alternatives ("OU"), ex. {ordre: 1, catalogue_item_ids: ["<Le Caire>", "<Louxor>"]}.
export type PackSlot = {
  ordre: number;
  catalogue_item_ids: string[];
};

// Regroupement de plusieurs activités catalogue vendues ensemble à un prix
// par personne inférieur à la somme des activités prises séparément (ex.
// PACK EXPLORATION : Caire ou Louxor + Maison des dauphins + Safari, à
// 125€/pers). Chaque emplacement peut proposer un choix parmi plusieurs
// activités ("OU") — voir PackSlot. Le prix se répartit ensuite au prorata
// sur chaque activité créée (voir packSlotPrix dans resa.ts).
export type Pack = {
  id: string;
  nom: string;
  description: string;
  inclus: string;
  photo_path: string;
  prix_adulte: number;
  prix_enfant: number;
  valide: boolean;
  ordre: number;
  slots: PackSlot[];
  created_at: string;
  updated_at: string;
};

export type CatalogueFaq = {
  id: string;
  catalogue_item_id: string;
  question: string;
  reponse: string;
  created_at: string;
};

// Un jour du programme d'un circuit/activité sur plusieurs jours (ex. Le
// Caire 2 jours, Abu Simbel...) — en plus du champ libre "programme",
// toujours disponible pour les activités simples d'une seule journée.
export type CatalogueJour = {
  id: string;
  catalogue_item_id: string;
  titre: string;
  description: string;
  ordre: number;
  created_at: string;
};

export type ReservationOption = {
  id: string;
  reservation_id: string;
  nom: string;
  prix: number;
  quantite: number;
  // Vrai pour une option de croisière (Montgolfière, Abu Simbel, transfert)
  // dont le prix est en réalité compté sur sa propre carte, créée à sa date
  // réelle — jamais compté deux fois dans le total de la croisière.
  prix_compte_ailleurs: boolean;
  // Vrai pour une option ajoutée automatiquement suite à un choix ferme
  // (ex. "passer en privatif" après un jour indisponible) — non modifiable
  // ni supprimable ensuite, contrairement à une option ajoutée normalement.
  verrouille: boolean;
};

export type CatalogueTarif = {
  id: string;
  catalogue_item_id: string;
  label: string;
  pu: number;
  created_at: string;
};

export type CatalogueOption = {
  id: string;
  catalogue_item_id: string;
  nom: string;
  prix: number;
  mode: "personne" | "groupe";
  // Texte explicatif (conditions, éligibilité...) affiché en petit sous le
  // nom de l'option — le nom lui-même reste court (ex. "Montgolfière").
  description: string;
  created_at: string;
};

// Tarif forfaitaire d'un transfert selon la zone de l'hôtel (Hurghada, Sahl
// Hasheesh, Makadi, El Gouna, Safaga…) et le véhicule utilisé (voiture,
// van…) — le prix n'est jamais par personne, c'est un forfait pour le
// trajet entier, propre à chaque activité de type "Transfert".
export type CatalogueTransfertTarif = {
  id: string;
  catalogue_item_id: string;
  zone: string;
  vehicule: string;
  prix: number;
  ordre: number;
  created_at: string;
};

export type ReservationTarif = {
  id: string;
  reservation_id: string;
  label: string;
  pu: number;
  quantite: number;
  created_at: string;
};

export type Reservation = {
  id: string;
  client_id: string;
  nom_activite: string;
  catalogue_item_id: string | null;
  // Carte créée automatiquement pour une option de croisière (Montgolfière,
  // Abu Simbel, transfert) qui a lieu à une date différente de la croisière
  // elle-même — pointe vers la réservation "Croisière" d'origine.
  parent_reservation_id: string | null;
  // Renseignés quand cette activité a été ajoutée via un Pack — son prix
  // (pu_adulte/pu_enfant) est alors sa propre part du prix pack, calculée
  // au prorata, jamais 0€, pour qu'une annulation individuelle se comporte
  // comme une réservation normale sans casser les autres cartes du pack.
  pack_id: string | null;
  pack_nom: string;
  date_debut: string | null;
  date_fin: string | null;
  moment: string;
  horaire_souhaite: string;
  ile_selectionnee: string;
  ile_selectionnee_2: string;
  pu_adulte: number;
  pu_enfant: number;
  pu_bebe: number;
  pu_accompagnateur: number;
  pu_enfant_3ans: number;
  tarif_mode: "personne" | "groupe";
  prix_groupe_base: number;
  prix_groupe_extra1: number;
  prix_groupe_extra_enfant: number;
  participants_mode: "tous" | "custom";
  participants_adultes: number;
  participants_enfants: number;
  participants_bebes: number;
  participants_accompagnateurs: number;
  participants_enfants_3ans: number;
  participants_extra1: number;
  participants_extra_enfants: number;
  participants_extra_bebes: number;
  participants_noms: string;
  pax_override: string;
  transfert_inclus: boolean;
  transfert_montant: number;
  reduction_montant: number;
  reduction_motif: string;
  activite_offerte: boolean;
  zone_transfert: string;
  vehicule_transfert: string;
  horaire_approx: string;
  pickup_reel: string;
  point_rdv: string;
  inclus: string;
  non_inclus: string;
  a_prevoir: string;
  info_importante: string;
  photo_path: string;
  pointure: string;
  creneau: string;
  site_caire: string;
  nb_conducteurs: number | null;
  nb_passagers: number | null;
  numero_vol: string;
  horaire_vol: string;
  photo_vol_path: string | null;
  champs_requis_coches: string[];
  statut_resa: "Brouillon" | "Confirmée" | "Annulée";
  annulation_raison: string;
  annulation_date: string | null;
  // Heure de l'annulation ("09:00") — optionnelle, affichée à côté de
  // annulation_date sur le titre barré rouge quand elle est connue.
  annulation_heure: string;
  annulation_remb_avoir: "" | "rembourse" | "avoir";
  annulation_exception_hossam: boolean;
  annulation_prevenir_hossam: boolean;
  // Qui est à l'origine de l'annulation — distinct de annulation_raison
  // (Météo, Client ne veut plus...) : une annulation agence/gouvernement
  // est toujours remboursable sans exception Hossam à valider.
  annulation_type: "client" | "agence" | "gouvernement";
  // Résultat du calcul de délai (24h/48h/10j selon l'activité, voir
  // reglementAnnulation) au moment exact de l'annulation — figé pour ne
  // jamais être recalculé plus tard avec une date qui a changé.
  annulation_delai_raison: string;
  // Le client avait-il déjà payé quelque chose (acompte encaissé ou solde
  // payé) au moment précis de l'annulation — figé à cet instant via
  // clientAPayeQuelqueChose(client), jamais recalculé plus tard avec l'état
  // courant du client. Distinct de annulation_remb_avoir : une activité
  // payée peut être annulée sans remboursement accordé (non remboursable,
  // ou exception refusée) — les deux ensemble donnent "payé, non remboursé".
  annulation_paye_avant: boolean;
  billet_requis: boolean;
  billet_etape: string;
  billet_demande_envoyee_le: string | null;
  billet_date: string | null;
  billet_lien: string;
  billet_notes: string;
  billet_verifie: boolean;
  billet_recu_le: string | null;
  billet_ville_depart: string;
  billet_ville_arrivee: string;
  billet_nom_complet: string;
  avoir_utilise: number;
  enfants_monte: string[];
  // Qui a créé cette activité — pour le rapport "réservations par employée"
  // du Manager. Rempli seulement à partir de la mise en place (pas de
  // reprise rétroactive) : peut rester vide sur les activités plus
  // anciennes.
  cree_par_id: string | null;
  cree_par_nom: string;
  created_at: string;
  updated_at: string;
};

export type Remboursement = {
  id: string;
  client_id: string;
  montant: number;
  raison: string;
  raison_autre: string;
  details: string;
  activite_id: string | null;
  date_probleme: string | null;
  mode: string;
  par: string;
  date_remboursement: string | null;
  // Horodatage exact (date + heure) du moment où le remboursement a été
  // marqué "Effectué" — date_remboursement reste une simple date pour
  // l'affichage/tri existant.
  date_remboursement_ts: string | null;
  statut: "En attente" | "Effectué";
  paypal_email: string;
  rib_photo_path: string | null;
  // Preuve photo (capture PayPal, virement...) — obligatoire pour marquer
  // "Effectué", consultable ensuite depuis la fiche client.
  preuve_photo_path: string | null;
  created_at: string;
};

// Crédit "à utiliser pendant le séjour" du client — se consomme au fil des
// activités ajoutées (montant_restant) au lieu d'être versé une fois comme
// un remboursement. Pas de date de fin propre : elle suit toujours
// client.date_fin.
export type Avoir = {
  id: string;
  client_id: string;
  montant: number;
  montant_restant: number;
  raison: string;
  raison_autre: string;
  activite_id: string | null;
  date_probleme: string | null;
  created_at: string;
};

// Étape de paiement libre entre l'acompte et le solde (voir migration 0094)
// — l'acompte et le solde restent uniques, ces étapes sont des règlements
// intermédiaires additionnels (ex. un 2e PayPal, puis des espèces, puis
// une CB).
export type PaiementEtape = {
  id: string;
  client_id: string;
  montant: number;
  mode: string;
  date: string | null;
  note: string;
  // Activité où l'argent a été remis en main propre (espèces/CB) — vide
  // pour PayPal/virement, qui ne passent jamais par une activité précise.
  activite_nom: string;
  created_at: string;
};

export type Verification = {
  id: string;
  client_id: string;
  nom: string;
  date: string | null;
  // Rempli automatiquement avec le vrai compte connecté au moment de
  // l'ajout — "nom" reste la signature tapée à la main, ceci sert au
  // calcul fiable du rappel personnel (PersonalNudgeAlert).
  verifie_par_id: string | null;
  created_at: string;
};

// Code de réduction/promo ajouté par la Direction (onglet Direction) —
// consultable en lecture seule par l'équipe (HELP > Codes promo) pour
// vérifier qu'un code donné par un client est valide.
export type CodePromo = {
  id: string;
  code: string;
  description: string;
  actif: boolean;
  created_at: string;
};

// Rapport d'incident : réclamation, souci de communication, problème
// pendant une activité — visible via une icône sur la fiche client dès
// qu'il y en a un (voir IncidentsModal), pour ne plus le laisser invisible
// dans kommo_resume une fois le client confirmé.
export type Incident = {
  id: string;
  client_id: string;
  titre: string;
  details: string;
  date_incident: string | null;
  statut: "Ouvert" | "Résolu";
  par: string;
  created_at: string;
  updated_at: string;
};

export type Paiement = {
  id: string;
  client_id: string;
  montant: number;
  mode: string;
  date: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  nom: string;
  canal: string;
  canal_autre: string;
  // Second canal optionnel — certains clients arrivent par deux canaux à la
  // fois (ex. WhatsApp + Email, WhatsApp + Instagram). Vide si un seul canal.
  canal_secondaire: string;
  canal_secondaire_autre: string;
  pseudo_contact: string;
  // Deuxième pseudo Instagram/TikTok, jamais obligatoire.
  pseudo_contact_2: string;
  relation_grace_a: string;
  relation_autre: string;
  statut: string;
  telephone: string;
  // Deuxième numéro WhatsApp, jamais obligatoire (ex. couple qui alterne,
  // numéro local en plus du numéro d'origine).
  telephone_2: string;
  email: string;
  // Deuxième email, jamais obligatoire.
  email_2: string;
  // Adresse PayPal du client — collée une seule fois, jamais retapée de
  // mémoire, puis réutilisée automatiquement à chaque remboursement.
  paypal_email: string;
  hotel: string;
  chambre: string;
  // "hotel" (par défaut) ou "airbnb" — remplace la ligne Hôtel/Chambre par
  // Airbnb + adresse/GPS + appartement/bâtiment quand c'est "airbnb".
  type_hebergement: string;
  airbnb_adresse: string;
  airbnb_appartement: string;
  airbnb_building: string;
  date_debut: string | null;
  date_fin: string | null;
  adultes: number;
  enfants: number;
  ages_enfants: string;
  bebes: number;
  ages_bebes: string;
  ados_presents: boolean;
  ages_ados: string;
  passeport_photos: string[];
  infos_manquantes: string[];
  info_manquante_autre: string;
  commentaires: string;
  solde_montant: number;
  solde_mode: string;
  solde_date: string | null;
  solde_paye: boolean;
  solde_activite_id: string | null;
  solde_rdv_heure: string;
  solde_rdv_lieu: string;
  solde_assigne_a: string;
  paiement_type: string;
  paiement_integral_mode: string;
  solde_rdv_valide: boolean;
  solde_rdv_finalise: boolean;
  // Règlement "de reprise" : activité ajoutée après que le solde ait déjà
  // été entièrement réglé — suit son propre paiement, indépendant de
  // solde_paye/solde_mode/solde_activite_id (voir repriseActiviteCible et
  // le pop-up dédié dans PaiementsStep). reprise_montant à 0 = rien en
  // attente.
  reprise_montant: number;
  reprise_mode: string;
  reprise_activite_id: string | null;
  egp_taux: number;
  egp_montant: number;
  acompte_montant: number;
  acompte_mode: string;
  acompte_valide: boolean;
  acompte_paye: boolean;
  acompte_date_encaissement: string | null;
  // Horodatage précis (avec l'heure) du rattachement automatique d'un
  // paiement PayPal — rempli seulement par ce flux-là (voir AppShell,
  // rattacherPaypal). Une saisie manuelle de l'encaissement n'a pas
  // d'heure fiable, donc ce champ reste vide dans ce cas.
  acompte_encaisse_ts: string | null;
  // Coché quand le client a envoyé l'acompte PayPal sans utiliser "Entre
  // proches" — des frais sont alors déduits, donc le montant réellement
  // reçu (acompte_montant, mis à jour au même moment) est inférieur au
  // montant prévu. Affiché comme note sur la carte acompte une fois coché.
  acompte_entre_proches_oublie: boolean;
  // Montant initialement prévu pour l'acompte, figé au moment de "Valider"
  // — jamais modifié ensuite, contrairement à acompte_montant qui devient
  // le montant réellement reçu si ajusté à l'encaissement. Sert à afficher
  // l'écart ("135€ au lieu de X€"), null pour les dossiers créés avant
  // cette fonctionnalité (pas d'écart affiché dans ce cas).
  acompte_montant_prevu: number | null;
  au_revoir_envoye: boolean;
  au_revoir_envoye_le: string | null;
  // Qui a envoyé le message "au revoir" — pour le rappel personnel
  // (PersonalNudgeAlert). Rempli à partir de maintenant seulement.
  au_revoir_envoye_par_id: string | null;
  au_revoir_envoye_par_nom: string;
  avis_envoye: boolean;
  avis_envoye_le: string | null;
  // Idem pour la demande d'avis Google.
  avis_envoye_par_id: string | null;
  avis_envoye_par_nom: string;
  avis_statut: "À demander" | "À ne pas demander" | "Déjà publié";
  tags: string[];
  prochain_appel_date: string | null;
  prochain_appel_heure: string;
  prochain_appel_fuseau: "france" | "egypte";
  prochain_appel_plateforme: string;
  prochain_appel_confirme: boolean;
  dernier_contact_date: string | null;
  nb_relances: number;
  // Qui a fait cette dernière relance — pour le pop-up personnel de rappel
  // (RelanceNudgeAlert). Rempli à partir de maintenant seulement.
  dernier_contact_par_id: string | null;
  dernier_contact_par_nom: string;
  kommo_contact_id: number | null;
  kommo_lead_id: number | null;
  kommo_pipeline_status_id: number | null;
  kommo_pipeline_status_nom: string;
  kommo_last_client_message_at: string | null;
  kommo_last_team_reply_at: string | null;
  kommo_last_team_reply_par: string;
  kommo_premier_echange_le: string | null;
  kommo_synced_at: string | null;
  kommo_resume: string;
  kommo_sejour_debut_estime: string | null;
  kommo_sejour_fin_estime: string | null;
  kommo_hotel_estime: string;
  kommo_nb_adultes_estime: number | null;
  kommo_nb_enfants_estime: number | null;
  kommo_ages_enfants_estime: string;
  kommo_activites_interet: string;
  kommo_activites_a_eviter: string;
  kommo_extraction_updated_at: string | null;
  kommo_demande_infos_envoyee_le: string | null;
  kommo_programme_envoye_resume: string;
  kommo_etape_detectee: string;
  annulation_raison: string;
  annulation_date: string | null;
  doublon_possible_id: string | null;
  doublon_traite: boolean;
  confirmation_a_traiter: boolean;
  confirmation_assignee_a: string | null;
  confirmation_assignee_a_le: string | null;
  created_at: string;
  updated_at: string;
};

export const EMPTY_CLIENT: Omit<Client, "id" | "created_at" | "updated_at"> = {
  nom: "",
  canal: "WhatsApp",
  canal_autre: "",
  canal_secondaire: "",
  canal_secondaire_autre: "",
  pseudo_contact: "",
  pseudo_contact_2: "",
  relation_grace_a: "Instagram",
  relation_autre: "",
  statut: "Prospect",
  telephone: "",
  telephone_2: "",
  email: "",
  email_2: "",
  paypal_email: "",
  hotel: "",
  chambre: "",
  type_hebergement: "hotel",
  airbnb_adresse: "",
  airbnb_appartement: "",
  airbnb_building: "",
  date_debut: null,
  date_fin: null,
  adultes: 0,
  enfants: 0,
  ages_enfants: "",
  bebes: 0,
  ages_bebes: "",
  ados_presents: false,
  ages_ados: "",
  passeport_photos: [],
  infos_manquantes: [],
  info_manquante_autre: "",
  commentaires: "",
  solde_montant: 0,
  solde_mode: "Espèces EUR",
  solde_date: null,
  solde_paye: false,
  solde_activite_id: null,
  solde_rdv_heure: "",
  solde_rdv_lieu: "",
  solde_assigne_a: "",
  paiement_type: "",
  paiement_integral_mode: "",
  solde_rdv_valide: false,
  solde_rdv_finalise: false,
  reprise_montant: 0,
  reprise_mode: "",
  reprise_activite_id: null,
  egp_taux: 0,
  egp_montant: 0,
  acompte_montant: 0,
  acompte_mode: "PayPal",
  acompte_valide: false,
  acompte_paye: false,
  acompte_date_encaissement: null,
  acompte_encaisse_ts: null,
  acompte_entre_proches_oublie: false,
  acompte_montant_prevu: null,
  au_revoir_envoye: false,
  au_revoir_envoye_le: null,
  au_revoir_envoye_par_id: null,
  au_revoir_envoye_par_nom: "",
  avis_envoye: false,
  avis_envoye_le: null,
  avis_envoye_par_id: null,
  avis_envoye_par_nom: "",
  avis_statut: "À demander",
  tags: [],
  prochain_appel_date: null,
  prochain_appel_heure: "",
  prochain_appel_fuseau: "france",
  prochain_appel_plateforme: "",
  prochain_appel_confirme: false,
  dernier_contact_date: null,
  nb_relances: 0,
  dernier_contact_par_id: null,
  dernier_contact_par_nom: "",
  kommo_contact_id: null,
  kommo_lead_id: null,
  kommo_pipeline_status_id: null,
  kommo_pipeline_status_nom: "",
  kommo_last_client_message_at: null,
  kommo_last_team_reply_at: null,
  kommo_last_team_reply_par: "",
  kommo_premier_echange_le: null,
  kommo_synced_at: null,
  kommo_resume: "",
  kommo_sejour_debut_estime: null,
  kommo_sejour_fin_estime: null,
  kommo_hotel_estime: "",
  kommo_nb_adultes_estime: null,
  kommo_nb_enfants_estime: null,
  kommo_ages_enfants_estime: "",
  kommo_activites_interet: "",
  kommo_activites_a_eviter: "",
  kommo_extraction_updated_at: null,
  kommo_demande_infos_envoyee_le: null,
  kommo_programme_envoye_resume: "",
  kommo_etape_detectee: "",
  annulation_raison: "",
  annulation_date: null,
  doublon_possible_id: null,
  doublon_traite: false,
  confirmation_a_traiter: false,
  confirmation_assignee_a: null,
  confirmation_assignee_a_le: null,
};

export type UserShift = {
  user_id: string;
  shift_debut: string;
  shift_fin: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  role: "direction" | "equipe";
  email: string;
  prenom: string;
  // Dernier signal d'activité dans le CRM (pas Kommo) — pour le rapport
  // Manager > Gestion équipe. Mis à jour par un heartbeat régulier tant que
  // l'appli reste ouverte, pas à chaque action.
  derniere_activite_le: string | null;
  // Compte Kommo de l'employée (chacune a le sien) — sert à attribuer les
  // messages sortants Kommo à la bonne employée pour le temps de réponse.
  kommo_user_id: number | null;
  // Équipe Égypte (Hossam, Bodé) : accès différent d'une personne à l'autre,
  // pas un simple rôle binaire — voir migration 0092.
  // nav_masque : clés d'onglets (Mode) cachées dans la sidebar.
  nav_masque: string[];
  // suivis_visibles : sous-onglets Suivis autorisés (null = tous, comme pour
  // les comptes existants).
  suivis_visibles: string[] | null;
};

// Un échange client→équipe apparié côté Kommo (message entrant suivi du
// prochain message sortant), calculé par /api/cron/kommo-response-times —
// jamais en direct depuis le navigateur (limite Kommo : 7 requêtes/s).
export type KommoReponseEmploye = {
  id: string;
  kommo_event_id: string;
  client_id: string | null;
  kommo_lead_id: number;
  kommo_user_id: number;
  employe_id: string | null;
  employe_nom: string;
  message_client_at: string;
  reponse_at: string;
  delai_secondes: number;
  created_at: string;
};

export type PlanningShift = {
  id: string;
  user_id: string;
  date: string;
  shift_debut: string;
  shift_fin: string;
  statut: "travail" | "conge" | "repos" | "superviseur";
  // Petite note libre sur une exception ponctuelle (ex. "OFF habituel
  // décalé", "Récup samedi 19") — affichée en icône sur la carte du shift.
  note: string;
  created_at: string;
  updated_at: string;
};

// Jour où la couverture 9h30-21h30 par au moins 2 personnes n'est pas
// exigée (Noël, jour de l'an, raison spéciale...) — l'alerte "jour
// incomplet" du Planning équipe ignore ces dates.
export type PlanningJourExceptionnel = {
  id: string;
  date: string;
  motif: string;
  created_at: string;
};

export type SemaineTypeShift = {
  id: string;
  semaine: "A" | "B";
  user_id: string;
  jour: string;
  statut: "travail" | "conge" | "repos" | "superviseur";
  shift_debut: string;
  shift_fin: string;
  created_at: string;
  updated_at: string;
};

export type Conge = {
  id: string;
  user_id: string;
  date_debut: string;
  date_fin: string;
  motif: string;
  statut: "En attente" | "Validé" | "Refusé";
  created_at: string;
};

export type ClientHotel = {
  id: string;
  client_id: string;
  ordre: number;
  nom: string;
  ville: string;
  chambre: string;
  date_arrivee: string | null;
  date_depart: string | null;
  created_at: string;
};

export type KommoWebhookEvent = {
  id: string;
  event_type: string;
  payload: unknown;
  client_id: string | null;
  error: string | null;
  created_at: string;
};

export type HotelReference = {
  id: string;
  nom: string;
  ville: string;
  sur_hurghada: boolean;
  created_at: string;
  updated_at: string;
};

export type TransfertTaxe = {
  id: string;
  ville: string;
  nb_adultes_min: number | null;
  nb_adultes_max: number | null;
  nb_enfants_min: number | null;
  nb_enfants_max: number | null;
  nb_total_min: number | null;
  nb_total_max: number | null;
  montant: number | null;
  note: string;
  label: string;
  ordre: number;
  created_at: string;
  updated_at: string;
};

export type InfoManquanteOption = {
  id: string;
  label: string;
  created_at: string;
};

export type PaypalPaiement = {
  id: string;
  transaction_id: string;
  montant: number;
  devise: string;
  frais: number;
  montant_net: number;
  entre_proches: boolean | null;
  payeur_nom: string;
  payeur_email: string;
  paypal_recu_le: string;
  rattache_client_id: string | null;
  rattache_par: string;
  rattache_at: string | null;
  created_at: string;
};

export type BusEscalation = {
  id: string;
  client_id: string;
  client_nom: string;
  reservation_id: string | null;
  nom_activite: string;
  employe_id: string;
  employe_nom: string;
  statut: "en_attente" | "validee" | "refusee";
  resolu_par: string | null;
  resolu_par_nom: string;
  resolu_message: string;
  resolu_at: string | null;
  created_at: string;
};

export type JourEscalation = {
  id: string;
  client_id: string;
  client_nom: string;
  reservation_id: string | null;
  nom_activite: string;
  date_choisie: string | null;
  jour_choisi: string;
  jours_disponibles: string[];
  employe_id: string;
  employe_nom: string;
  statut: "en_attente" | "validee" | "refusee";
  resolu_par: string | null;
  resolu_par_nom: string;
  resolu_message: string;
  resolu_at: string | null;
  created_at: string;
};

// Remarque privée de Sylvie/Direction à une employée (ex : trop de flyers
// envoyés, réponse pas assez soignée avec un client) — pensée pour éviter
// la confrontation en personne : seule l'employée visée la voit, à sa
// prochaine connexion.
export type RemarqueEmployee = {
  id: string;
  employe_id: string;
  employe_nom: string;
  auteur_id: string | null;
  auteur_nom: string;
  message: string;
  client_id: string | null;
  client_nom: string;
  lu: boolean;
  lu_at: string | null;
  created_at: string;
};

// Vérification (par Sylvie/Direction) que l'employée a bien informé le
// client de vérifier la localisation de son hôtel à Assouan (rive vs
// île/presqu'île/Village Nubien, navette bateau à réserver auprès de
// l'hôtel) — contrairement à BusEscalation/JourEscalation, tant que ce
// n'est pas "validee" l'activité ne peut pas être confirmée.
export type AssouanVerification = {
  id: string;
  client_id: string;
  client_nom: string;
  reservation_id: string;
  nom_activite: string;
  employe_id: string;
  employe_nom: string;
  statut: "en_attente" | "validee" | "refusee";
  resolu_par: string | null;
  resolu_par_nom: string;
  resolu_message: string;
  resolu_at: string | null;
  created_at: string;
};

export type CatalogueModificationRequest = {
  id: string;
  catalogue_item_ids: string[];
  catalogue_item_noms: string[];
  type_modification: "Tarif" | "Horaire" | "Programme" | "Autre";
  autre_detail: string;
  explication: string;
  demandeur_id: string;
  demandeur_nom: string;
  statut: "En attente" | "Traité";
  created_at: string;
};

// Demande de correction d'une tranche de taxe de transfert — même
// mécanisme que CatalogueModificationRequest (page en lecture seule pour
// l'équipe, la Direction valide/applique le changement).
export type TransfertTaxeModificationRequest = {
  id: string;
  transfert_taxe_id: string | null;
  ville: string;
  tranche_label: string;
  explication: string;
  demandeur_id: string;
  demandeur_nom: string;
  statut: "En attente" | "Traité";
  created_at: string;
};
