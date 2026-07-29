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
  billet_requis: boolean;
  billet_acompte_paye: boolean;
  billet_envoye: boolean;
  billet_lien: string;
  billet_statut: string;
  billet_notes: string;
  billet_date: string | null;
  billet_activite_id: string | null;
  au_revoir_envoye: boolean;
  avis_envoye: boolean;
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
  billet_requis: false,
  billet_acompte_paye: false,
  billet_envoye: false,
  billet_lien: "",
  billet_statut: "En attente",
  billet_notes: "",
  billet_date: null,
  billet_activite_id: null,
  au_revoir_envoye: false,
  avis_envoye: false,
};
