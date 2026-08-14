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
  date_debut: string | null;
  date_fin: string | null;
  moment: string;
  horaire_souhaite: string;
  ile_selectionnee: string;
  ile_selectionnee_2: string;
  pu_adulte: number;
  pu_enfant: number;
  pu_accompagnateur: number;
  pu_enfant_3ans: number;
  tarif_mode: "personne" | "groupe";
  prix_groupe_base: number;
  prix_groupe_extra1: number;
  prix_groupe_extra_enfant: number;
  participants_mode: "tous" | "custom";
  participants_adultes: number;
  participants_enfants: number;
  participants_accompagnateurs: number;
  participants_enfants_3ans: number;
  participants_extra1: number;
  participants_extra_enfants: number;
  participants_noms: string;
  pax_override: string;
  transfert_inclus: boolean;
  transfert_montant: number;
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
  annulation_remb_avoir: "" | "rembourse" | "avoir";
  annulation_exception_hossam: boolean;
  annulation_prevenir_hossam: boolean;
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
  statut: "En attente" | "Effectué";
  paypal_email: string;
  rib_photo_path: string | null;
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

export type Verification = {
  id: string;
  client_id: string;
  nom: string;
  date: string | null;
  created_at: string;
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
  pseudo_contact: string;
  relation_grace_a: string;
  relation_autre: string;
  statut: string;
  telephone: string;
  email: string;
  hotel: string;
  chambre: string;
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
  egp_taux: number;
  egp_montant: number;
  acompte_montant: number;
  acompte_mode: string;
  acompte_valide: boolean;
  acompte_paye: boolean;
  acompte_date_encaissement: string | null;
  au_revoir_envoye: boolean;
  au_revoir_envoye_le: string | null;
  avis_envoye: boolean;
  avis_envoye_le: string | null;
  avis_statut: "À demander" | "À ne pas demander" | "Déjà publié";
  tags: string[];
  prochain_appel_date: string | null;
  prochain_appel_heure: string;
  prochain_appel_fuseau: "france" | "egypte";
  prochain_appel_plateforme: string;
  prochain_appel_confirme: boolean;
  dernier_contact_date: string | null;
  nb_relances: number;
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
  kommo_extraction_updated_at: string | null;
  kommo_demande_infos_envoyee_le: string | null;
  kommo_programme_envoye_resume: string;
  annulation_raison: string;
  annulation_date: string | null;
  doublon_possible_id: string | null;
  doublon_traite: boolean;
  created_at: string;
  updated_at: string;
};

export const EMPTY_CLIENT: Omit<Client, "id" | "created_at" | "updated_at"> = {
  nom: "",
  canal: "WhatsApp",
  canal_autre: "",
  pseudo_contact: "",
  relation_grace_a: "Instagram",
  relation_autre: "",
  statut: "Prospect",
  telephone: "",
  email: "",
  hotel: "",
  chambre: "",
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
  egp_taux: 0,
  egp_montant: 0,
  acompte_montant: 0,
  acompte_mode: "PayPal",
  acompte_valide: false,
  acompte_paye: false,
  acompte_date_encaissement: null,
  au_revoir_envoye: false,
  au_revoir_envoye_le: null,
  avis_envoye: false,
  avis_envoye_le: null,
  avis_statut: "À demander",
  tags: [],
  prochain_appel_date: null,
  prochain_appel_heure: "",
  prochain_appel_fuseau: "france",
  prochain_appel_plateforme: "",
  prochain_appel_confirme: false,
  dernier_contact_date: null,
  nb_relances: 0,
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
  kommo_extraction_updated_at: null,
  kommo_demande_infos_envoyee_le: null,
  kommo_programme_envoye_resume: "",
  annulation_raison: "",
  annulation_date: null,
  doublon_possible_id: null,
  doublon_traite: false,
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
};

export type PlanningShift = {
  id: string;
  user_id: string;
  date: string;
  shift_debut: string;
  shift_fin: string;
  statut: "travail" | "conge" | "repos" | "superviseur";
  created_at: string;
  updated_at: string;
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
  montant: number;
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
