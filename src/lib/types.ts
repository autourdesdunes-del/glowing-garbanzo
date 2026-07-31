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
  disponibilites: string;
  pu_adulte: number;
  pu_enfant: number;
  pu_bebe: number;
  marge_pct: number;
  horaire_approx: string;
  inclus: string;
  non_inclus: string;
  a_prevoir: string;
  point_rdv: string;
  photo_path: string;
  valide: boolean;
  created_at: string;
  updated_at: string;
};

export type ReservationOption = {
  id: string;
  reservation_id: string;
  nom: string;
  prix: number;
};

export type Reservation = {
  id: string;
  client_id: string;
  nom_activite: string;
  catalogue_item_id: string | null;
  date_debut: string | null;
  date_fin: string | null;
  moment: string;
  pu_adulte: number;
  pu_enfant: number;
  participants_mode: "tous" | "custom";
  participants_adultes: number;
  participants_enfants: number;
  participants_noms: string;
  pax_override: string;
  transfert_inclus: boolean;
  transfert_montant: number;
  horaire_approx: string;
  pickup_reel: string;
  point_rdv: string;
  inclus: string;
  non_inclus: string;
  a_prevoir: string;
  info_importante: string;
  cout_reel: number;
  photo_path: string;
  statut_resa: "Brouillon" | "Confirmée";
  billet_requis: boolean;
  billet_statut: string;
  billet_date: string | null;
  billet_acompte_paye: boolean;
  billet_envoye: boolean;
  billet_lien: string;
  billet_notes: string;
  created_at: string;
  updated_at: string;
};

export type Remboursement = {
  id: string;
  client_id: string;
  montant: number;
  raison: string;
  raison_autre: string;
  activite_id: string | null;
  date_probleme: string | null;
  mode: string;
  par: string;
  date_remboursement: string | null;
  statut: "En attente" | "Effectué";
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
  participant_noms: string;
  lien_passeport: string;
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
  au_revoir_envoye: boolean;
  avis_envoye: boolean;
  tags: string[];
  prochain_appel_date: string | null;
  prochain_appel_heure: string;
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
  adultes: 2,
  enfants: 0,
  ages_enfants: "",
  participant_noms: "",
  lien_passeport: "",
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
  au_revoir_envoye: false,
  avis_envoye: false,
  tags: [],
  prochain_appel_date: null,
  prochain_appel_heure: "",
};

export type UserShift = {
  user_id: string;
  shift_debut: string;
  shift_fin: string;
  updated_at: string;
};
