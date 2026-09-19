"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Avoir,
  AssouanVerification,
  BusEscalation,
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  ClientHotel,
  HotelReference,
  Incident,
  PaiementEtape,
  Pack,
  PaypalPaiement,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxe,
} from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import MissingInfoModal from "@/components/MissingInfoModal";
import GuidedActivityModal from "@/components/GuidedActivityModal";
import AnnulerClientModal from "@/components/AnnulerClientModal";
import IncidentsModal from "@/components/IncidentsModal";
import DevisPaiementModal from "@/components/DevisPaiementModal";
import ConfirmationDocumentStage from "@/components/ConfirmationDocument";
import DuplicateClientModal from "@/components/DuplicateClientModal";
import AssouanHebergementAlert from "@/components/AssouanHebergementAlert";
import { STATUT_COLORS, MODES_PAIEMENT } from "@/lib/constants";
import { generateClientDocument } from "@/lib/generateClientDocument";
import { matchHotel } from "@/lib/hotelHelp";
import { DuplicateMatch, findDuplicateClients, normText } from "@/lib/duplicates";
import {
  resaTotalMontant,
  avoirUtiliseTotal,
  findMomentConflict,
  prochaineActiviteActive,
  reservationsActives,
  soldeRestantSejour,
  STATUT_PAIEMENT_OPTIONS,
  StatutPaiementKey,
} from "@/lib/resa";
import { todayStr } from "@/lib/dates";
import { infosManquantesAuto } from "@/lib/infosManquantes";
import {
  ActivitesStep,
  ContactStep,
  PaiementsStep,
  SuiviStep,
} from "@/components/client-steps";
import { euros, fmtDate, Section, TagStarPicker } from "@/components/clientDetail/ClientDetailPrimitives";

const SECTIONS = ["Contact", "Activités", "Paiements", "Suivi"] as const;

export default function ClientDetail({
  client,
  allClients,
  onChange,
  onDelete,
  onJumpToClient,
  onDuplicateAsNewStay,
  onDeleteClientById,
  canDelete,
  canSeeMargins,
  catalogue,
  catalogueTarifs,
  transfertTarifs,
  catalogueOptions,
  packs,
  onOpenHelp,
  autoOpenActivity,
  onAutoOpenActivityHandled,
  autoOpenSection,
  onAutoOpenSectionHandled,
  onIncidentsChanged,
}: {
  client: Client;
  allClients: Client[];
  onChange: (patch: Partial<Client>) => void;
  onDelete: () => void;
  onJumpToClient: (id: string) => void;
  onDuplicateAsNewStay: (source: Client) => void;
  onDeleteClientById: (id: string) => Promise<boolean> | void;
  canDelete: boolean;
  canSeeMargins: boolean;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  transfertTarifs: Record<string, CatalogueTransfertTarif[]>;
  catalogueOptions: Record<string, CatalogueOption[]>;
  packs: Pack[];
  onOpenHelp: () => void;
  // Ouvre directement le pas-à-pas "Ajouter une activité" en arrivant sur
  // la fiche — utilisé par le bouton "+ Nouvelle activité" du dashboard,
  // qui rattache une activité à un client déjà existant sans repasser par
  // sa fiche complète d'abord.
  autoOpenActivity?: boolean;
  onAutoOpenActivityHandled?: () => void;
  // Ouvre directement une section précise en arrivant sur la fiche — utilisé
  // par "Annuler une activité" (section Activités, pour choisir laquelle) et
  // "Ajouter un remboursement/avoir" (section Suivi) depuis le dashboard.
  autoOpenSection?: "Activités" | "Suivi" | "Paiements";
  onAutoOpenSectionHandled?: () => void;
  // Prévient AppShell qu'un incident vient de changer depuis cette fiche —
  // le badge "Incidents ouverts" du Dashboard lit sa propre copie
  // (allIncidents), jamais rafraîchie automatiquement sinon (vécu : un
  // incident résolu ou créé ici restait affiché à l'ancien statut sur le
  // Dashboard jusqu'à un rechargement complet de la page).
  onIncidentsChanged?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const toast = useToast();
  const CLOSED_SECTIONS: Record<(typeof SECTIONS)[number], boolean> = {
    Contact: false,
    Activités: false,
    Paiements: false,
    Suivi: false,
  };
  const [open, setOpen] = useState<Record<(typeof SECTIONS)[number], boolean>>(CLOSED_SECTIONS);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [paiementsModalOpen, setPaiementsModalOpen] = useState(false);
  const [missingInfo, setMissingInfo] = useState<{
    message: string;
    actionLabel: string;
    focusId: string;
    section: (typeof SECTIONS)[number];
  } | null>(null);
  const [busEscalations, setBusEscalations] = useState<BusEscalation[]>([]);
  const [assouanVerifications, setAssouanVerifications] = useState<AssouanVerification[]>([]);
  // Alerte doublon quand le nom (ou téléphone) saisi ressemble à un client
  // déjà existant — évite qu'une nouvelle fiche vide créée par erreur reste
  // séparée d'un dossier déjà suivi (vécu avec Celia/Célia Nichanian : les
  // infos saisies dans la nouvelle fiche semblaient "effacées" alors
  // qu'elles étaient juste dans un doublon jamais rapproché de l'original).
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([]);
  const [dupDismissedFor, setDupDismissedFor] = useState("");
  // Re-propose la vérification hébergement Assouan juste après avoir généré
  // le bon de confirmation — le bon peut partir au client avant que l'info
  // ait été redemandée/revalidée, donc on la rappelle à ce moment précis.
  const [assouanRepromptId, setAssouanRepromptId] = useState<string | null>(null);
  const [momentConflict, setMomentConflict] = useState<{ current: Reservation; other: Reservation } | null>(
    null
  );

  useEffect(() => {
    setOpen(CLOSED_SECTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  useEffect(() => {
    if (autoOpenActivity) {
      setGuidedOpen(true);
      onAutoOpenActivityHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenActivity]);

  useEffect(() => {
    if (autoOpenSection) {
      // "Paiements" n'est plus un accordéon inline comme les autres
      // sections (voir SECTIONS/open) mais une pop-up à part
      // (paiementsModalOpen) — sans ce cas séparé, l'ouvrir depuis
      // "Paiements du jour" (DashboardView) ne faisait que scroller
      // jusqu'à un bandeau resté fermé.
      if (autoOpenSection === "Paiements") {
        setPaiementsModalOpen(true);
      } else {
        setOpen((prev) => ({ ...prev, [autoOpenSection]: true }));
        requestAnimationFrame(() => {
          document.getElementById(`section-${autoOpenSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      onAutoOpenSectionHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenSection]);

  const refreshBusEscalations = async () => {
    const { data } = await supabase
      .from("bus_escalations")
      .select("*")
      .eq("client_id", client.id)
      .neq("statut", "validee");
    setBusEscalations((data as BusEscalation[]) || []);
  };

  useEffect(() => {
    const check = () => refreshBusEscalations();
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // Gardé quel que soit le statut (contrairement à busEscalations) : il faut
  // savoir si une vérification est "validee" pour débloquer la confirmation
  // de l'activité, pas seulement celles en attente.
  const refreshAssouanVerifications = async () => {
    // Le plus récent en premier : une vérification "refusée" suivie d'une
    // nouvelle demande "validée" laisse deux lignes pour la même activité —
    // sans cet ordre, le .find() plus bas (ligne ~2245) retombait sur la
    // première rencontrée (l'ancienne refusée) et bloquait à tort la
    // confirmation malgré la validation plus récente.
    const { data } = await supabase
      .from("assouan_verifications")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setAssouanVerifications((data as AssouanVerification[]) || []);
  };

  useEffect(() => {
    const check = () => refreshAssouanVerifications();
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // L'acompte validé reste sous le minimum requis pour "Le Caire en avion"
  // (billet acheté immédiatement, non remboursable) malgré l'alerte —
  // jamais bloquant (le client peut avoir de bonnes raisons, un vol déjà
  // pris ne peut pas attendre), mais Sylvie/Direction doivent le savoir
  // pour pouvoir relancer le client si besoin.
  const handleAcompteAlerte = async (
    montantMinimum: number,
    montantSaisi: number,
    nomActivite: string,
    reservationId: string | null
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    // Sans cette vérification, un aller-retour "Annuler l'acompte" →
    // "Revalider" (ex. pour corriger un champ sans changer le montant)
    // réinsérait une alerte identique à chaque passage — la Direction
    // voyait alors plusieurs entrées empilées dans "Autorisations en
    // attente" pour un seul vrai incident. On ne réinsère que si aucune
    // alerte non encore vue n'existe déjà pour cette même activité.
    if (reservationId) {
      const { data: existante } = await supabase
        .from("acompte_alertes")
        .select("id")
        .eq("client_id", client.id)
        .eq("reservation_id", reservationId)
        .eq("vu", false)
        .limit(1);
      if (existante && existante.length > 0) return;
    }
    await supabase.from("acompte_alertes").insert({
      client_id: client.id,
      client_nom: client.nom,
      reservation_id: reservationId,
      nom_activite: nomActivite,
      montant_minimum: montantMinimum,
      montant_saisi: montantSaisi,
      employe_id: user.id,
      employe_nom: employeNom,
    });
  };

  // L'employée indique avoir informé le client de vérifier la localisation
  // de son hôtel à Assouan — reste "en_attente" jusqu'à ce que Sylvie/
  // Direction valide, ce qui seul débloque la confirmation de l'activité.
  const handleAssouanVerification = async (nomActivite: string, reservationId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    // Même garde-fou que handleAcompteAlerte : sans lui, rouvrir l'édition
    // de cette activité et recliquer "Confirmer l'info" réinsère une
    // demande identique à chaque passage, empilée dans "Autorisations en
    // attente" pour un seul vrai signalement.
    const { data: existante } = await supabase
      .from("assouan_verifications")
      .select("id")
      .eq("client_id", client.id)
      .eq("reservation_id", reservationId)
      .eq("statut", "en_attente")
      .limit(1);
    if (existante && existante.length > 0) return;
    await supabase.from("assouan_verifications").insert({
      client_id: client.id,
      client_nom: client.nom,
      reservation_id: reservationId,
      nom_activite: nomActivite,
      employe_id: user.id,
      employe_nom: employeNom,
    });
    refreshAssouanVerifications();
  };

  // Le client insiste pour la formule bus (au lieu du mini-bus recommandé) —
  // on trace qui a validé cette décision pour que la Direction/Sylvie
  // puisse vérifier avec la conversation que c'est bien une demande du
  // client, pas un raccourci pris par l'employée. reservationId est
  // toujours null ici désormais : l'activité n'est plus créée avant que la
  // demande soit tranchée (AddActivityWizard bloque l'ajout tant que
  // "en_attente"/"refusée") — sinon l'escalade ne changeait jamais rien de
  // concret, l'activité tournant déjà normalement dans le dossier.
  const handleBusEscalation = async (nomActivite: string, reservationId: string | null) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    await supabase.from("bus_escalations").insert({
      client_id: client.id,
      client_nom: client.nom,
      reservation_id: reservationId,
      nom_activite: nomActivite,
      employe_id: user.id,
      employe_nom: employeNom,
    });
    refreshBusEscalations();
  };

  // La date choisie tombe hors des jours disponibles du catalogue —
  // l'activité garde quand même cette date (jamais bloquée en attendant une
  // réponse), la demande part en parallèle pour Sylvie/Direction.
  const handleJourEscalation = async (
    nomActivite: string,
    reservationId: string,
    dateChoisie: string,
    jourChoisi: string,
    joursDisponibles: string[]
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    // Même garde-fou que handleAcompteAlerte/handleAssouanVerification :
    // rouvrir l'édition de cette activité (ex. depuis ItineraryView) et
    // redemander l'autorisation sur la même date réinsérerait sinon une
    // demande identique à chaque passage.
    const { data: existante } = await supabase
      .from("jour_escalations")
      .select("id")
      .eq("client_id", client.id)
      .eq("reservation_id", reservationId)
      .eq("statut", "en_attente")
      .limit(1);
    if (existante && existante.length > 0) return;
    await supabase.from("jour_escalations").insert({
      client_id: client.id,
      client_nom: client.nom,
      reservation_id: reservationId,
      nom_activite: nomActivite,
      date_choisie: dateChoisie,
      jour_choisi: jourChoisi,
      jours_disponibles: joursDisponibles,
      employe_id: user.id,
      employe_nom: employeNom,
    });
  };

  const goToMissingField = () => {
    if (!missingInfo) return;
    const { focusId, section } = missingInfo;
    setOpen((prev) => ({ ...prev, [section]: true }));
    setMissingInfo(null);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(focusId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLInputElement | null)?.focus();
      }, 100);
    });
  };
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resaOptions, setResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [resaTarifs, setResaTarifs] = useState<Record<string, ReservationTarif[]>>({});
  const [coutsMap, setCoutsMap] = useState<Record<string, number>>({});
  const [generatingDoc, setGeneratingDoc] = useState<"devis" | "facture" | null>(null);
  const [showAnnulerClientModal, setShowAnnulerClientModal] = useState(false);
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  const [taxesRef, setTaxesRef] = useState<TransfertTaxe[]>([]);
  const [avoirs, setAvoirs] = useState<Avoir[]>([]);
  const [avoirAppliedNotice, setAvoirAppliedNotice] = useState<{
    reservationId: string;
    montant: number;
  } | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [clientHotels, setClientHotels] = useState<ClientHotel[]>([]);
  const [paiementsEtapes, setPaiementsEtapes] = useState<PaiementEtape[]>([]);
  // Tant que false, le total séjour/badge Paiements/statut hôtel affichent
  // un squelette plutôt que "0 €"/"aucune activité" — sans ça, à l'ouverture
  // d'une fiche existante, reservations démarre à [] (fetch ci-dessous pas
  // encore résolu) et ces montants s'affichaient un instant à zéro avant de
  // se corriger, un flash trompeur si on regarde vite après un clic.
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showIncidentsModal, setShowIncidentsModal] = useState(false);
  const [showDevisPaiementModal, setShowDevisPaiementModal] = useState(false);
  const [confirmationFormat, setConfirmationFormat] = useState<"pdf" | "png" | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsMenuGroup, setActionsMenuGroup] = useState<"none" | "devisFacture" | "confirmation">(
    "none"
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("avoirs")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      setAvoirs((data as Avoir[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      setIncidents((data as Incident[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // Circuit multi-hôtels — pour que "Hôtel" ne reste pas signalé manquant
  // en haut de la fiche (badge) une fois un circuit renseigné, cf.
  // infosManquantesAuto.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("client_hotels")
        .select("*")
        .eq("client_id", client.id)
        .order("ordre", { ascending: true });
      setClientHotels((data as ClientHotel[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("paiements_etapes")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      setPaiementsEtapes((data as PaiementEtape[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  // Paiements PayPal rattachés à ce client (acompte, étape ou solde) — sert
  // uniquement à retrouver l'heure exacte de réception et l'identité du
  // payeur (payeur_nom/payeur_email) pour le "Résumé des paiements" : ces
  // infos existent déjà dans paypal_paiements depuis le rattachement, mais
  // n'étaient affichées nulle part une fois le paiement absorbé dans
  // acompte_*/solde_*/paiements_etapes (demandé par Mélanie le 2026-09-14).
  const [paypalPaiementsClient, setPaypalPaiementsClient] = useState<PaypalPaiement[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("paypal_paiements")
        .select("*")
        .eq("rattache_client_id", client.id)
        .order("paypal_recu_le", { ascending: true });
      setPaypalPaiementsClient((data as PaypalPaiement[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const addPaiementEtape = async (
    montant: number,
    mode: string,
    date: string,
    note: string,
    activiteNom: string,
    montantEgp = 0
  ) => {
    const { data, error } = await supabase
      .from("paiements_etapes")
      .insert({
        client_id: client.id,
        montant,
        mode,
        date: date || null,
        note,
        activite_nom: activiteNom,
        montant_egp: montantEgp,
      })
      .select()
      .single();
    if (!error && data) {
      setPaiementsEtapes((prev) => [...prev, data as PaiementEtape]);
    } else {
      toast("Impossible d'ajouter cette étape de paiement.");
    }
  };

  const deletePaiementEtape = async (id: string) => {
    const ok = await confirm({
      message: "Retirer cette étape de paiement ? Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setPaiementsEtapes((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("paiements_etapes").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  // Garde anti double-clic : sans elle, un clic rapide (ou une connexion
  // lente) créait deux avoirs vides (0€/0€) au lieu d'un seul.
  const addingAvoirRef = useRef(false);
  // `patch` permet de pré-remplir l'avoir à la création (ex. transformer un
  // remboursement en avoir depuis Suivi, en reprenant montant/raison/
  // activité) sans passer par un avoir vide à compléter à la main ensuite.
  const addAvoir = async (patch?: Partial<Avoir>): Promise<boolean> => {
    if (addingAvoirRef.current) return false;
    addingAvoirRef.current = true;
    const { data, error } = await supabase
      .from("avoirs")
      .insert({ client_id: client.id, ...patch })
      .select()
      .single();
    addingAvoirRef.current = false;
    if (!error && data) {
      setAvoirs((prev) => [...prev, data as Avoir]);
      return true;
    } else {
      toast("Impossible d'ajouter l'avoir.");
      return false;
    }
  };

  const updateAvoir = async (id: string, patch: Partial<Avoir>) => {
    setAvoirs((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("avoirs").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteAvoir = async (id: string) => {
    const a = avoirs.find((x) => x.id === id);
    // Une fois supprimé, plus aucune trace (raison, activité d'origine) ne
    // permet de retrouver pourquoi ce montant compte comme "payé" — utile à
    // savoir avant de retirer un avoir déjà (partiellement) consommé.
    const dejaConsomme = a ? Number(a.montant) - Number(a.montant_restant) : 0;
    const ok = await confirm({
      message:
        dejaConsomme > 0
          ? `Retirer cet avoir ? ${euros(dejaConsomme)} € en ont déjà été utilisés — ce montant restera compté comme payé sur les activités concernées, mais toute trace de l'avoir d'origine (raison, activité) disparaîtra. Cette action est irréversible.`
          : "Retirer cet avoir ? Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setAvoirs((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from("avoirs").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  // Un avoir suit toujours la date de fin de séjour du client (pas de date
  // propre, voir le type Avoir) — au-delà, il ne doit plus pouvoir être
  // proposé ni utilisé, sinon la mention "à utiliser pendant le séjour"
  // reste purement décorative.
  const avoirExpire = !!client.date_fin && todayStr() > client.date_fin;
  const avoirDisponible = avoirExpire
    ? 0
    : avoirs.reduce((s, a) => s + (Number(a.montant_restant) || 0), 0);

  // Garde anti double-dépense : sans elle, deux consommations d'avoir
  // lancées à quelques secondes d'intervalle (deux activités ajoutées vite,
  // ou deux membres de l'équipe sur la même fiche) partent chacune du même
  // `avoirs` en mémoire et peuvent chacune décompter le même solde restant —
  // le crédit réel n'est débité qu'une fois en base mais appliqué deux fois
  // aux réservations.
  const usingAvoirRef = useRef(false);
  const autoApplyAvoir = async (reservationId: string, montant: number) => {
    if (usingAvoirRef.current) return;
    usingAvoirRef.current = true;
    // On relit les avoirs depuis la base plutôt que de faire confiance à
    // `avoirs` en mémoire, pour réduire (sans l'éliminer complètement) la
    // fenêtre où un autre onglet/utilisateur aurait déjà entamé le même
    // avoir entre le calcul du montant et cette application.
    const { data: avoirsFrais } = await supabase
      .from("avoirs")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });
    const avoirsSource = (avoirsFrais as Avoir[]) || avoirs;
    const resaCible = reservations.find((r) => r.id === reservationId);
    const label = `${euros(montant)} € sur ${
      resaCible?.nom_activite || "une activité"
    } ajoutée le ${fmtDate(todayStr())}`;
    let restant = montant;
    for (const a of avoirsSource) {
      if (restant <= 0) break;
      const pris = Math.min(restant, Number(a.montant_restant) || 0);
      if (pris <= 0) continue;
      restant -= pris;
      await updateAvoir(a.id, {
        montant_restant: (Number(a.montant_restant) || 0) - pris,
        utilise_sur: a.utilise_sur ? `${a.utilise_sur} ; ${label}` : label,
      });
    }
    // Le montant appliqué se rattache à cette activité précise, pour
    // s'afficher sur sa carte ("avoir de X € utilisé sur cette activité"),
    // même si le solde qu'il réduit reste unique pour tout le séjour.
    // On écrit ce qui a réellement été débité des avoirs (montant - restant),
    // pas le montant demandé : si le solde d'avoirs disponible était
    // insuffisant (ex. déjà entamé par une autre session dans la fenêtre
    // documentée ci-dessus), écrire `montant` ferait apparaître un crédit
    // plus gros que celui réellement consommé, et donc un "reste à payer"
    // sous-évalué (avoirUtilise, sommé dans client-steps.tsx, vient réduire
    // le total dans paiementProgress()).
    const montantReellementApplique = montant - restant;
    await updateReservation(reservationId, { avoir_utilise: montantReellementApplique });
    setAvoirAppliedNotice({ reservationId, montant: montantReellementApplique });
    usingAvoirRef.current = false;
  };

  // Id de la réservation tout juste créée par addReservation (avant que son
  // prix ne soit connu) — voir tryAutoApplyAvoirOnFinish.
  const newActivityAvoirCandidateRef = useRef<string | null>(null);

  // Avant, un pop-up "veux-tu utiliser l'avoir ?" apparaissait dès la
  // création de l'activité (étape 1 du pas-à-pas), donc avant même de
  // connaître son prix — l'employée devait deviner combien affecter.
  // Demande de Mélanie (14/09) : appliquer l'avoir automatiquement, plafonné
  // au prix réel de l'activité, une fois celui-ci connu — donc seulement à
  // la fin du pas-à-pas ("Ajouter l'activité"), jamais à la création ni sur
  // une édition d'activité déjà en place (reservationId ne correspond alors
  // pas au candidat mémorisé ci-dessus, voir addReservation).
  const tryAutoApplyAvoirOnFinish = (finishedReservationId?: string) => {
    const candidateId = newActivityAvoirCandidateRef.current;
    newActivityAvoirCandidateRef.current = null;
    if (!finishedReservationId || finishedReservationId !== candidateId) return;
    if (avoirExpire || avoirDisponible <= 0) return;
    const r = reservations.find((res) => res.id === finishedReservationId);
    if (!r) return;
    const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    const montant = Math.min(avoirDisponible, total);
    if (montant <= 0) return;
    autoApplyAvoir(finishedReservationId, montant);
  };

  // Ajustable après coup (réduire ou retirer l'avoir auto-appliqué) — on ne
  // sait pas forcément duquel des avoirs d'origine la part libérée vient
  // (répartition possible sur plusieurs), donc on la restitue sous la forme
  // d'un nouvel avoir plutôt que de deviner lequel recréditer (même
  // principe que la restitution sur annulation, voir AnnulerActiviteModal).
  const adjustAvoirOnReservation = async (reservationId: string, nouveauMontant: number) => {
    const r = reservations.find((res) => res.id === reservationId);
    if (!r) return;
    const actuel = Number(r.avoir_utilise) || 0;
    const cible = Math.max(0, Math.min(nouveauMontant, actuel));
    const aLiberer = Math.round((actuel - cible) * 100) / 100;
    if (aLiberer <= 0) return;
    const { data, error } = await supabase
      .from("avoirs")
      .insert({
        client_id: client.id,
        montant: aLiberer,
        montant_restant: aLiberer,
        raison: "Autre",
        raison_autre: `Ajusté depuis ${r.nom_activite || "une activité"}`,
        activite_id: reservationId,
        date_probleme: todayStr(),
      })
      .select()
      .single();
    if (error || !data) {
      toast("Échec de l'ajustement de l'avoir.");
      return;
    }
    setAvoirs((prev) => [...prev, data as Avoir]);
    await updateReservation(reservationId, { avoir_utilise: cible });
  };

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: t }] = await Promise.all([
        supabase.from("hotels_reference").select("*"),
        supabase.from("transfert_taxes").select("*"),
      ]);
      setHotelsRef((h as HotelReference[]) || []);
      setTaxesRef((t as TransfertTaxe[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hotelMatch = matchHotel(client.hotel, hotelsRef);
  const hotelHorsHurghada = !!hotelMatch && !hotelMatch.sur_hurghada;

  useEffect(() => {
    (async () => {
      setDataLoaded(false);
      const { data: resas } = await supabase
        .from("reservations")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      const list = (resas as Reservation[]) || [];
      setReservations(list);

      if (list.length) {
        const [{ data: opts }, { data: tarifs }] = await Promise.all([
          supabase
            .from("reservation_options")
            .select("*")
            .in(
              "reservation_id",
              list.map((r) => r.id)
            ),
          supabase
            .from("reservation_tarifs")
            .select("*")
            .in(
              "reservation_id",
              list.map((r) => r.id)
            ),
        ]);
        const grouped: Record<string, ReservationOption[]> = {};
        ((opts as ReservationOption[]) || []).forEach((o) => {
          grouped[o.reservation_id] = [...(grouped[o.reservation_id] || []), o];
        });
        setResaOptions(grouped);
        const groupedTarifs: Record<string, ReservationTarif[]> = {};
        ((tarifs as ReservationTarif[]) || []).forEach((t) => {
          groupedTarifs[t.reservation_id] = [...(groupedTarifs[t.reservation_id] || []), t];
        });
        setResaTarifs(groupedTarifs);
      } else {
        setResaOptions({});
        setResaTarifs({});
      }

      // Coûts réels réservés à la Direction en base (table à part + RLS) —
      // on ne fetch même pas pour un compte équipe.
      if (canSeeMargins && list.length) {
        const { data: couts } = await supabase
          .from("reservation_couts")
          .select("*")
          .in(
            "reservation_id",
            list.map((r) => r.id)
          );
        const map: Record<string, number> = {};
        ((couts as { reservation_id: string; cout_reel: number }[]) || []).forEach((c) => {
          map[c.reservation_id] = c.cout_reel;
        });
        setCoutsMap(map);
      } else {
        setCoutsMap({});
      }
      setDataLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, canSeeMargins]);

  const updateCoutReel = async (reservationId: string, value: number) => {
    setCoutsMap((prev) => ({ ...prev, [reservationId]: value }));
    const { error } = await supabase
      .from("reservation_couts")
      .upsert({ reservation_id: reservationId, cout_reel: value });
    if (error) toast("Échec de l'enregistrement du coût.");
  };

  const addReservation = async (
    opts?: { skipAvoirPrompt?: boolean },
    attempt = 0
  ): Promise<string | null> => {
    // "Qui a créé cette activité" (cree_par_id/cree_par_nom) n'est qu'une
    // info d'audit, jamais bloquante pour la création elle-même — avant ce
    // fix, supabase.auth.getUser() (qui revalide le JWT auprès du serveur
    // Auth, contrairement à getSession() qui lit la session déjà en
    // mémoire) pouvait à lui seul bloquer TOUT le clic pendant 2-3 minutes
    // en cas d'incident réseau/Auth (vécu le 2026-09-14 sur plusieurs
    // activités — Safari quad, Quad Sunset, plongée, speedboat — alors que
    // le timeout ajouté plus bas sur l'insert lui-même n'y changeait rien,
    // puisque le blocage avait lieu avant de l'atteindre).
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
    // Le fix du 2026-09-14 ajoutait des timeouts, mais gardait ces deux
    // requêtes AVANT l'insert lui-même — même sans jamais atteindre leur
    // timeout, 2 aller-retours réseau de plus avant même de commencer à
    // créer l'activité rendaient chaque sélection d'activité perceptiblement
    // lente (remonté le 2026-09-19 : "très long dès qu'on sélectionne une
    // activité"). cree_par_id/nom n'est qu'une info d'audit affichée nulle
    // part de bloquant pour l'activité elle-même — on la remplit maintenant
    // en arrière-plan, une fois l'activité déjà créée et visible à l'écran,
    // au lieu de faire attendre l'employée pour elle.
    const remplirCreePar = async (reservationId: string) => {
      try {
        const sessionResult = await withTimeout(supabase.auth.getSession(), 4000);
        const userId = sessionResult?.data?.session?.user?.id || null;
        if (!userId) return;
        const profController = new AbortController();
        const profTimeoutId = setTimeout(() => profController.abort(), 4000);
        const profResult = await supabase
          .from("profiles")
          .select("prenom, email")
          .eq("id", userId)
          .abortSignal(profController.signal)
          .single();
        clearTimeout(profTimeoutId);
        const creeParNom = profResult.data?.prenom || (profResult.data?.email || "").split("@")[0] || "";
        await supabase
          .from("reservations")
          .update({ cree_par_id: userId, cree_par_nom: creeParNom })
          .eq("id", reservationId);
      } catch {
        // Best-effort — voir commentaire ci-dessus.
      }
    };
    // Sans limite de temps, une requête bloquée par un incident réseau
    // (vécu plusieurs fois avec Supabase le 2026-09-14 : CORS/503
    // intermittents) laissait le bouton "grisé" indéfiniment — l'employée,
    // pensant le clic perdu, rouvrait le pas-à-pas et recommençait
    // plusieurs fois. Chaque tentative abandonnée restait malgré tout en
    // vol côté serveur, et TOUTES finissaient par aboutir d'un coup une
    // fois l'incident résolu (constaté : plusieurs "Safari quad" en
    // Brouillon créées d'un coup ~20 minutes après le premier clic). Une
    // limite de 12s par tentative rend l'échec visible et rapide au lieu
    // de laisser deviner, pour qu'on retente une seule fois au lieu de
    // cinq.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        client_id: client.id,
        transfert_inclus: !hotelHorsHurghada,
        // Une activité ajoutée à un client déjà "Client confirmé" est
        // confirmée d'office — sinon elle reste en Brouillon pour toujours
        // tant que personne ne pense à aller cliquer "Valider" sur la carte
        // (constaté : 80% des activités bloquées en Brouillon en pratique,
        // ce qui vidait les factures qui ne reprennent que les Confirmées).
        statut_resa: client.statut === "Client confirmé" ? "Confirmée" : "Brouillon",
      })
      .select()
      .abortSignal(controller.signal)
      .single();
    clearTimeout(timeoutId);
    if (!error && data) {
      const newReservation = data as Reservation;
      setReservations((prev) => [...prev, newReservation]);
      remplirCreePar(newReservation.id);
      // Un solde déjà marqué payé ne doit pas absorber par magie une
      // nouvelle activité ajoutée après coup (règle du solde unique) : on
      // fige ici, une seule fois, le total du séjour d'AVANT cet ajout —
      // ça permet à paiementBadge de détecter l'écart ensuite et de ne
      // plus afficher "Payé" sur cette nouvelle activité qui, elle,
      // n'a jamais été réglée (vécu : Louxor en mini-bus payé le 25/08,
      // puis plongée sous-marine ajoutée ensuite affichée "Payé" à tort).
      if (client.solde_paye && !client.solde_montant) {
        const totalAvant = reservationsActives(reservations).reduce(
          (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
          0
        );
        onChange({ solde_montant: totalAvant });
      }
      // Cette nouvelle activité peut être l'occasion de consommer un avoir
      // en attente — appliqué automatiquement une fois son prix connu, voir
      // tryAutoApplyAvoirOnFinish. Sauf pour une carte créée automatiquement
      // en arrière-plan (option de croisière), sans rapport avec cette carte.
      if (avoirDisponible > 0 && !opts?.skipAvoirPrompt) {
        newActivityAvoirCandidateRef.current = newReservation.id;
      }
      return newReservation.id;
    }
    // Un token d'auth silencieusement expiré échoue une seule fois — on le
    // rafraîchit et on retente avant d'afficher un échec à l'employée.
    if (attempt === 0) {
      await withTimeout(supabase.auth.refreshSession(), 4000);
      return addReservation(opts, 1);
    }
    console.error("addReservation", error);
    toast(
      error
        ? `Impossible d'ajouter l'activité (${error.message}).`
        : "Impossible d'ajouter l'activité."
    );
    return null;
  };

  // Gardés par réservation (id -> ...) comme le solde client dans AppShell —
  // évite qu'une réponse en échec pour une activité perde ou mélange les
  // modifications d'une autre activité en cours d'édition au même moment
  // (le wizard "Ajouter une activité" enchaîne beaucoup de patchs rapides).
  const reservationPendingPatch = useRef<Record<string, Partial<Reservation>>>({});
  const reservationRetryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const reservationDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const reservationInFlight = useRef<Record<string, boolean>>({});
  const reservationErrorToastShown = useRef<Record<string, boolean>>({});
  // flushReservation s'appelle elle-même (retry, patch accumulé pendant un
  // envoi en cours) — passer par ce ref plutôt que par le nom de la const
  // évite une auto-référence directe dans son propre corps (interdite par
  // react-hooks/immutability).
  const flushReservationRef = useRef<(id: string, attempt?: number) => Promise<void>>(async () => {});

  const flushReservation = useCallback(
    async (id: string, attempt = 0) => {
      const patch = reservationPendingPatch.current[id];
      if (!patch || Object.keys(patch).length === 0) return;
      // Un envoi par frappe (avant ce fix) pouvait partir en parallèle pour
      // chaque lettre tapée dans un champ texte (ex. info_importante) — sans
      // garantie d'ordre d'arrivée réseau, un envoi partiel ("Allerg…") pouvait
      // arriver après l'envoi complet ("Allergie") et tronquer la valeur en
      // base. On sérialise désormais les envois par réservation : un seul en
      // vol à la fois, le suivant repart avec le dernier patch accumulé.
      if (attempt === 0 && reservationInFlight.current[id]) return;
      reservationInFlight.current[id] = true;
      const { error } = await supabase.from("reservations").update(patch).eq("id", id);
      reservationInFlight.current[id] = false;
      if (!error) {
        const current = reservationPendingPatch.current[id];
        if (current) {
          // Ne retire que les clés dont la valeur n'a pas changé depuis cet
          // envoi — sinon une frappe arrivée pendant la requête (donc déjà
          // fusionnée dans current) serait effacée de la file sans jamais
          // avoir été envoyée.
          Object.keys(patch).forEach((k) => {
            if ((current as Record<string, unknown>)[k] === (patch as Record<string, unknown>)[k]) {
              delete (current as Record<string, unknown>)[k];
            }
          });
          if (Object.keys(current).length > 0) setTimeout(() => flushReservationRef.current(id), 0);
        }
        reservationErrorToastShown.current[id] = false;
        return;
      }
      if (!reservationErrorToastShown.current[id]) {
        toast("Échec de l'enregistrement — nouvelle tentative en cours…");
        reservationErrorToastShown.current[id] = true;
      }
      if (attempt === 0) {
        await supabase.auth.refreshSession();
      }
      const delay = Math.min(2000 * 2 ** attempt, 15000);
      if (reservationRetryTimers.current[id]) clearTimeout(reservationRetryTimers.current[id]);
      reservationRetryTimers.current[id] = setTimeout(
        () => flushReservationRef.current(id, attempt + 1),
        delay
      );
    },
    [supabase, toast]
  );
  useEffect(() => {
    flushReservationRef.current = flushReservation;
  }, [flushReservation]);

  const updateReservation = (id: string, patch: Partial<Reservation>) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    reservationPendingPatch.current[id] = { ...reservationPendingPatch.current[id], ...patch };
    if (reservationRetryTimers.current[id]) clearTimeout(reservationRetryTimers.current[id]);
    // Petit debounce pour laisser une frappe rapide (ex. info_importante)
    // se poser avant l'envoi, au lieu de lancer une requête par caractère.
    if (reservationDebounceTimers.current[id]) clearTimeout(reservationDebounceTimers.current[id]);
    reservationDebounceTimers.current[id] = setTimeout(() => flushReservation(id), 400);
    // Alerte immédiate si ce changement fait tomber cette activité sur la
    // même date + même moment de la journée qu'une autre activité du client.
    if ("date_debut" in patch || "moment" in patch || "creneau" in patch) {
      const merged = reservations.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const conflict = findMomentConflict(merged, id);
      if (conflict) {
        const current = merged.find((r) => r.id === id);
        if (current) setMomentConflict({ current, other: conflict });
      }
    }
  };

  // Rafraîchissement automatique des activités de cette fiche, toutes les
  // 25s, comme le reste de l'appli (voir AppShell.tsx) — sinon les
  // Devis/Factures générés depuis cette fiche restaient basés sur les
  // données chargées à l'ouverture, même si une collègue modifiait une
  // activité de ce client entre-temps. Toute modif locale pas encore
  // confirmée en base (reservationPendingPatch) est réappliquée par-dessus
  // la donnée fraîche, comme pour les clients dans AppShell.
  const refreshReservationsForClient = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const { data: resas } = await supabase
      .from("reservations")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true });
    const list = (resas as Reservation[]) || [];
    const now = Date.now();
    setReservations((prev) => {
      const fetchedIds = new Set(list.map((r) => r.id));
      // Ce SELECT et un ajout d'activité tournent en parallèle (ce
      // rafraîchissement est sur un minuteur indépendant, toutes les 25s) —
      // si l'activité vient d'être insérée entre le lancement de cette
      // requête et sa réponse, elle n'apparaît pas encore dans `list` alors
      // qu'elle existe bel et bien en base. Sans cette protection, elle
      // disparaissait de la fiche jusqu'au prochain passage (vécu : ajout
      // d'activité qui "disparaît" ou met du temps à s'afficher). On la
      // garde un court instant plutôt que de la faire disparaître à tort ;
      // passé ce délai, son absence reflète une vraie suppression.
      const recentLocalOnly = prev.filter((r) => {
        if (fetchedIds.has(r.id)) return false;
        const createdAt = r.created_at ? new Date(r.created_at).getTime() : 0;
        return now - createdAt < 60000;
      });
      return [
        ...list.map((r) =>
          reservationPendingPatch.current[r.id] ? { ...r, ...reservationPendingPatch.current[r.id] } : r
        ),
        ...recentLocalOnly,
      ];
    });

    // Ce SELECT (et celui des tarifs) n'interroge que les réservations
    // présentes dans `list` — une réservation gardée un court instant par
    // la protection ci-dessus (recentLocalOnly, absente de `list` à cause
    // de la même course) n'a pas été requêtée ici : ne jamais effacer ses
    // options/tarifs déjà connus localement, sinon l'activité reste
    // visible mais perd son détail (options, prix) jusqu'au prochain
    // passage. `list` vide n'efface donc plus tout non plus.
    const listIds = new Set(list.map((r) => r.id));
    const [{ data: opts }, { data: tarifs }] = list.length
      ? await Promise.all([
          supabase
            .from("reservation_options")
            .select("*")
            .in(
              "reservation_id",
              list.map((r) => r.id)
            ),
          supabase
            .from("reservation_tarifs")
            .select("*")
            .in(
              "reservation_id",
              list.map((r) => r.id)
            ),
        ])
      : [{ data: [] }, { data: [] }];
    const grouped: Record<string, ReservationOption[]> = {};
    ((opts as ReservationOption[]) || []).forEach((o) => {
      grouped[o.reservation_id] = [...(grouped[o.reservation_id] || []), o];
    });
    const groupedTarifs: Record<string, ReservationTarif[]> = {};
    ((tarifs as ReservationTarif[]) || []).forEach((t) => {
      groupedTarifs[t.reservation_id] = [...(groupedTarifs[t.reservation_id] || []), t];
    });
    setResaOptions((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([id]) => !listIds.has(id)));
      return { ...kept, ...grouped };
    });
    setResaTarifs((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([id]) => !listIds.has(id)));
      return { ...kept, ...groupedTarifs };
    });

    if (canSeeMargins && list.length) {
      const { data: couts } = await supabase
        .from("reservation_couts")
        .select("*")
        .in(
          "reservation_id",
          list.map((r) => r.id)
        );
      const map: Record<string, number> = {};
      ((couts as { reservation_id: string; cout_reel: number }[]) || []).forEach((c) => {
        map[c.reservation_id] = c.cout_reel;
      });
      setCoutsMap(map);
    } else {
      setCoutsMap({});
    }
  }, [client.id, canSeeMargins, supabase]);

  useEffect(() => {
    const id = setInterval(refreshReservationsForClient, 25000);
    return () => clearInterval(id);
  }, [refreshReservationsForClient]);

  const goToMomentConflict = () => {
    if (!momentConflict) return;
    const id = momentConflict.current.id;
    setMomentConflict(null);
    setOpen((prev) => ({ ...prev, Activités: true }));
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(`reservation-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    });
  };

  const performDeleteReservation = async (id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
    setResaOptions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setResaTarifs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  // Le solde (unique par séjour) ou un règlement de reprise (activité
  // ajoutée après un solde déjà payé) peuvent être rattachés pile à
  // l'activité qu'on est en train de retirer — la retirer sans rien faire
  // laissait ce règlement "prévu" pointer dans le vide (le message de
  // confirmation promettait de le retirer aussi, mais rien ne le faisait
  // réellement). Toujours demandé explicitement avant suppression, jamais
  // effacé/déplacé en silence — même logique que reglementIci dans
  // AnnulerActiviteModal, adaptée ici à un simple retrait (pas une vraie
  // annulation côté client : pas de raison/date/remboursement à saisir).
  const [reglementSuppressionModal, setReglementSuppressionModal] = useState<{
    reservationId: string;
    reservationNom: string;
    type: "solde" | "reprise";
    montant: string;
    mode: string;
    choix: "annuler" | "deplacer" | "";
    cibleId: string;
  } | null>(null);

  const deleteReservation = async (id: string) => {
    const r = reservations.find((rr) => rr.id === id);
    const soldeIci = client.solde_activite_id === id && !client.solde_paye;
    // Ne propose ce choix que si "id" est la SEULE activité encore rattachée
    // à la reprise (voir reprise_activite_ids, migration 0130) — sinon
    // montant (le total de la reprise) ne correspond pas qu'à celle-ci, et
    // "annuler" effacerait à tort l'argent encore dû par les autres
    // activités restées en attente. Même garde-fou que repriseIci dans
    // AnnulerActiviteModal.
    const repriseIdsActuels =
      Array.isArray(client.reprise_activite_ids) && client.reprise_activite_ids.length > 0
        ? client.reprise_activite_ids
        : client.reprise_activite_id
          ? [client.reprise_activite_id]
          : [];
    const repriseIci =
      !soldeIci && repriseIdsActuels.length === 1 && repriseIdsActuels[0] === id && Number(client.reprise_montant) > 0;
    if (soldeIci || repriseIci) {
      const montant = soldeIci
        ? soldeRestantSejour(
            client,
            reservations.filter((rr) => rr.id !== id),
            resaOptions,
            resaTarifs,
            paiementsEtapes
          )
        : Number(client.reprise_montant) || 0;
      setReglementSuppressionModal({
        reservationId: id,
        reservationNom: r?.nom_activite || "cette activité",
        type: soldeIci ? "solde" : "reprise",
        montant: String(montant),
        mode: soldeIci ? client.solde_mode : client.reprise_mode,
        choix: "",
        cibleId: "",
      });
      return;
    }
    const ok = await confirm({
      title: "Retirer cette activité ?",
      message: "Ses options seront aussi retirées. Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    await performDeleteReservation(id);
  };

  const confirmerReglementSuppression = async () => {
    const m = reglementSuppressionModal;
    if (!m || !m.choix) return;
    if (m.choix === "deplacer" && !m.cibleId) {
      toast("Choisis une activité où reporter ce règlement.");
      return;
    }
    const montant = Number(m.montant) || 0;
    if (m.choix === "deplacer" && m.type === "reprise" && montant <= 0) {
      toast("Renseigne un montant avant de reporter ce règlement.");
      return;
    }
    if (m.choix === "annuler") {
      // Trace dans l'historique des paiements (montant 0 — jamais compté
      // comme reçu) pour qu'on retrouve pourquoi ce règlement a disparu,
      // exactement comme le fait AnnulerActiviteModal pour une vraie
      // annulation client.
      await addPaiementEtape(
        0,
        "Annulation",
        todayStr(),
        `Règlement annulé — ${euros(montant)} € prévus à "${m.reservationNom}" (activité retirée du dossier), jamais perçus`,
        m.reservationNom
      );
      onChange(
        m.type === "solde"
          ? {
              paiement_integral_mode: "",
              solde_activite_id: null,
              solde_rdv_heure: "",
              solde_rdv_lieu: "",
              solde_rdv_valide: false,
              solde_rdv_finalise: false,
              solde_mode: "Espèces EUR",
              solde_montant: 0,
            }
          : {
              reprise_montant: 0,
              reprise_activite_id: null,
              reprise_activite_ids: [],
              reprise_mode: "",
              reprise_mixte_eur: 0,
              reprise_mixte_egp: 0,
            }
      );
    } else {
      onChange(
        m.type === "solde"
          ? { solde_activite_id: m.cibleId, solde_mode: m.mode }
          : // Ce sélecteur de mode (MODES_PAIEMENT) ne propose pas "Modes
            // différents" — reporter une reprise sur une autre activité
            // retombe donc toujours sur un mode simple, jamais mixte.
            {
              reprise_activite_id: m.cibleId,
              reprise_activite_ids: [m.cibleId],
              reprise_montant: montant,
              reprise_mode: m.mode,
              reprise_mixte_eur: 0,
              reprise_mixte_egp: 0,
            }
      );
    }
    await performDeleteReservation(m.reservationId);
    setReglementSuppressionModal(null);
  };

  const addOption = async (
    resaId: string,
    seed?: { nom: string; prix: number; quantite?: number; prix_compte_ailleurs?: boolean; verrouille?: boolean }
  ) => {
    const { data, error } = await supabase
      .from("reservation_options")
      .insert({
        reservation_id: resaId,
        nom: seed?.nom || "Guide francophone",
        prix: seed?.prix || 0,
        ...(seed?.quantite ? { quantite: seed.quantite } : {}),
        ...(seed?.prix_compte_ailleurs ? { prix_compte_ailleurs: true } : {}),
        ...(seed?.verrouille ? { verrouille: true } : {}),
      })
      .select()
      .single();
    if (!error && data) {
      setResaOptions((prev) => ({
        ...prev,
        [resaId]: [...(prev[resaId] || []), data as ReservationOption],
      }));
    } else {
      toast("Impossible d'ajouter l'option.");
    }
  };

  // Même correctif que updateCatalogueItem (AppShell.tsx) : le nom d'une
  // option ou le libellé d'un tarif supplémentaire écrivaient en base à
  // chaque lettre tapée, sans garantie d'ordre d'arrivée réseau — un texte
  // tapé pouvait donc se retrouver tronqué en base malgré un affichage
  // local correct. On regroupe les frappes rapprochées en une seule
  // écriture, envoyée 600ms après la dernière.
  const optionEcrituresEnAttente = useRef<Record<string, Partial<ReservationOption>>>({});
  const optionMinuteries = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const updateOption = (resaId: string, optId: string, patch: Partial<ReservationOption>) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((o) => (o.id === optId ? { ...o, ...patch } : o)),
    }));
    optionEcrituresEnAttente.current[optId] = {
      ...(optionEcrituresEnAttente.current[optId] || {}),
      ...patch,
    };
    if (optionMinuteries.current[optId]) clearTimeout(optionMinuteries.current[optId]);
    optionMinuteries.current[optId] = setTimeout(async () => {
      const aEcrire = optionEcrituresEnAttente.current[optId];
      delete optionEcrituresEnAttente.current[optId];
      delete optionMinuteries.current[optId];
      if (!aEcrire) return;
      const { error } = await supabase.from("reservation_options").update(aEcrire).eq("id", optId);
      if (error) toast("Échec de l'enregistrement.");
    }, 600);
  };

  const deleteOption = async (resaId: string, optId: string) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((o) => o.id !== optId),
    }));
    const { error } = await supabase.from("reservation_options").delete().eq("id", optId);
    if (error) toast("Échec de la suppression.");
  };

  const addTarif = async (resaId: string, seed?: { label: string; pu: number; quantite?: number }) => {
    const { data, error } = await supabase
      .from("reservation_tarifs")
      .insert({
        reservation_id: resaId,
        label: seed?.label || "",
        pu: seed?.pu || 0,
        quantite: seed?.quantite ?? 0,
      })
      .select()
      .single();
    if (!error && data) {
      setResaTarifs((prev) => ({
        ...prev,
        [resaId]: [...(prev[resaId] || []), data as ReservationTarif],
      }));
    } else {
      toast("Impossible d'ajouter ce tarif.");
    }
  };

  // Même correctif que updateOption ci-dessus.
  const tarifEcrituresEnAttente = useRef<Record<string, Partial<ReservationTarif>>>({});
  const tarifMinuteries = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const updateTarif = (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((t) => (t.id === tarifId ? { ...t, ...patch } : t)),
    }));
    tarifEcrituresEnAttente.current[tarifId] = {
      ...(tarifEcrituresEnAttente.current[tarifId] || {}),
      ...patch,
    };
    if (tarifMinuteries.current[tarifId]) clearTimeout(tarifMinuteries.current[tarifId]);
    tarifMinuteries.current[tarifId] = setTimeout(async () => {
      const aEcrire = tarifEcrituresEnAttente.current[tarifId];
      delete tarifEcrituresEnAttente.current[tarifId];
      delete tarifMinuteries.current[tarifId];
      if (!aEcrire) return;
      const { error } = await supabase.from("reservation_tarifs").update(aEcrire).eq("id", tarifId);
      if (error) toast("Échec de l'enregistrement.");
    }, 600);
  };

  const deleteTarif = async (resaId: string, tarifId: string) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((t) => t.id !== tarifId),
    }));
    const { error } = await supabase.from("reservation_tarifs").delete().eq("id", tarifId);
    if (error) toast("Échec de la suppression.");
  };

  // Mémoïsé : ce scan tournait sur les ~1150 clients à CHAQUE rendu de la
  // fiche (chaque frappe dans un champ, chaque tick des pollers 20-25s
  // ci-dessus) — recalculé seulement quand la liste globale ou ce client
  // changent vraiment.
  const autresSejours = useMemo(
    () => allClients.filter((c) => c.id !== client.id && client.telephone && c.telephone === client.telephone),
    [allClients, client.id, client.telephone]
  );

  const totalSejourHeader = reservationsActives(reservations).reduce(
    (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
  const autoInfosManquantes = infosManquantesAuto(client, reservations, hotelsRef, clientHotels);
  const manuelInfosManquantes = client.infos_manquantes.filter(
    (s) => s !== "Complet" && !autoInfosManquantes.includes(s)
  );
  const toutesInfosManquantes = [...autoInfosManquantes, ...manuelInfosManquantes];

  // Compte dès qu'un acompte est réellement encaissé, quel que soit le
  // "Type de paiement" affiché aujourd'hui — le rebasculer sur "intégral"
  // après coup ne doit jamais faire disparaître de l'argent déjà reçu.
  const acomptePayeMontant = client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  const avoirUtiliseHeader = avoirUtiliseTotal(reservationsActives(reservations));
  const etapesSumHeader = paiementsEtapes.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const soldeRestantHeader = Math.max(
    totalSejourHeader - acomptePayeMontant - etapesSumHeader - avoirUtiliseHeader,
    0
  );
  // Le solde ne peut jamais couvrir plus que ce qui a été réellement figé au
  // moment du règlement (client.solde_montant) — sinon une activité ajoutée
  // après coup grossit totalSejourHeader et se retrouve absorbée en silence
  // dans un "Payé" qui n'a jamais couvert cette nouvelle activité (le
  // pop-up de reprise ne suffit pas à s'en protéger : il ne se déclenche
  // qu'une fois, au moment précis où on ajoute l'activité, et rien ne le
  // rejoue si on est interrompu avant de le valider). solde_montant à 0 =
  // jamais renseigné (anciennes données) : on garde alors l'ancien calcul
  // plutôt que d'écraser à tort un solde légitimement payé.
  const soldeBaseline = Number(client.solde_montant) > 0 ? Number(client.solde_montant) : totalSejourHeader;
  const croissanceApresSolde = Math.max(totalSejourHeader - soldeBaseline, 0);
  // Même correctif que paiementProgress() dans resa.ts — le montant
  // réellement encaissé (solde_montant_recu) doit plafonner ce qui est
  // compté payé, sinon un solde marqué "payé" avec un écart réel (oubli
  // "Entre proches") s'affiche à tort comme entièrement réglé dans l'en-tête.
  const soldeDuHeader =
    client.solde_montant_recu > 0
      ? Math.min(Number(client.solde_montant_recu) || 0, soldeRestantHeader)
      : soldeRestantHeader;
  const soldeCouvertHeader = client.solde_paye ? Math.max(soldeDuHeader - croissanceApresSolde, 0) : 0;
  const totalPayeHeader = acomptePayeMontant + etapesSumHeader + avoirUtiliseHeader + soldeCouvertHeader;
  const paiementFullyPaid =
    totalSejourHeader > 0 && totalPayeHeader >= totalSejourHeader && !(client.reprise_montant > 0);

  // Une activité ajoutée après un solde déjà entièrement réglé fait
  // grossir le séjour au-delà de ce qui a été figé lors de la clôture
  // (client.solde_montant) — jamais absorbée en silence dans le "Payé"
  // existant (règle du solde unique : ce qui était payé avant reste payé,
  // la nouveauté suit son propre règlement, choisi ci-dessous). Vérifié
  // explicitement une fois le wizard "Ajouter une activité" terminé
  // (bouton "Ajouter cette activité"), jamais en direct pendant qu'on le
  // remplit — sinon le pop-up apparaît dès le choix de l'activité dans le
  // catalogue, avant même que l'employée ait fini de la configurer.
  const [repriseModal, setRepriseModal] = useState<{
    montant: string;
    mode: string;
    activiteId: string;
    mixteEur: string;
    mixteEgp: string;
    mixteRate: number;
    // Badge (paiement_statut) stampé sur l'activité choisie à la validation
    // — indépendant du solde, voir STATUT_PAIEMENT_OPTIONS (resa.ts).
    badge: StatutPaiementKey;
    // Distingue l'ouverture automatique (checkRepriseApresAjout, après une
    // activité ajoutée sur un solde déjà réglé) de l'ouverture manuelle
    // (bouton "+ Ajouter un paiement à effectuer", à tout moment) — seul le
    // texte d'en-tête change, le reste du formulaire est partagé.
    manuel?: boolean;
  } | null>(null);
  // Mode → badge pré-proposé par défaut dans ce modal (l'employée peut
  // toujours changer) : PayPal n'a pas de point de collecte physique
  // (rappel "flottant", voir acompteWaitingWarning) donc "en attente -
  // PayPal" ; les autres modes se rattachent tous à l'activité choisie.
  const badgeParDefautPourMode = (mode: string): StatutPaiementKey => {
    if (mode === "PayPal") return "attente_paypal";
    if (mode === "Espèces EGP") return "activite_egp";
    if (mode === "Carte bleue") return "activite_cb";
    if (mode === "Virement bancaire") return "activite_virement";
    if (mode === "Espèces EUR") return "activite_eur";
    return "attente";
  };
  // avoirAutoApplique : montant que tryAutoApplyAvoirOnFinish s'apprête à
  // affecter à LA MÊME activité qui vient de déclencher ce contrôle (voir
  // handleActivityFinished, qui calcule ce montant avant d'appeler les deux
  // fonctions). Sans lui, le pop-up de reprise se basait uniquement sur le
  // coût brut du séjour, sans jamais savoir qu'un avoir allait couvrir tout
  // ou partie de cette nouvelle activité — il demandait "comment régler
  // 130€" alors que l'avoir en couvrait déjà 130€, obligeant à répondre à
  // un pop-up sur un montant en réalité déjà réglé (vécu sur Iman KASRI le
  // 2026-09-14 : les deux pop-up — "utiliser l'avoir" ET "organiser le
  // paiement" — apparaissaient pour la même activité).
  const checkRepriseApresAjout = (avoirAutoApplique = 0) => {
    if (!client.solde_paye) return;
    // Une reprise déjà en attente (pas encore marquée réglée) ne doit
    // jamais empêcher de détecter une NOUVELLE activité ajoutée par-dessus
    // — sinon celle-ci est absorbée en silence, sans jamais demander
    // comment/où l'encaisser (bug constaté sur Carine LELOIR le
    // 2026-09-14 : 2e activité reprise correctement, 3e activité ajoutée
    // pendant que la reprise de la 2e restait en attente → jamais
    // demandée). La reprise déjà connue fait donc partie de la référence,
    // et seul le dépassement AU-DESSUS de ce qui est déjà prévu déclenche
    // le pop-up.
    const baseline = (Number(client.solde_montant) || totalSejourHeader) + (Number(client.reprise_montant) || 0);
    const diff = Math.round((totalSejourHeader - baseline - avoirAutoApplique) * 100) / 100;
    if (diff <= 0.01) {
      // Croissance intégralement couverte par l'avoir auto-appliqué : pas de
      // reprise à demander, MAIS sans rattraper solde_montant sur le nouveau
      // total, paiementProgress() continue de soustraire cette croissance de
      // soldeCouvert pour toujours (croissanceApresSolde), comme si elle
      // restait due — "reste à payer" affiche alors à tort le montant de
      // l'activité pourtant déjà réglée par avoir (vécu sur Iman KASRI,
      // Plongée sous-marine à 100€ intégralement couverte par avoir, encore
      // comptée "100€ à payer" des jours après). Même principe que
      // marquerRepriseReglee, qui referme déjà solde_montant sur le total
      // actuel une fois une reprise réglée par un vrai paiement — ici la
      // reprise n'a jamais existé car l'avoir a tout couvert immédiatement,
      // donc c'est cette fonction qui doit refermer la base à la place.
      if (avoirAutoApplique > 0.01) {
        onChange({ solde_montant: totalSejourHeader });
      }
      return;
    }
    const derniereActivite = [...reservationsActives(reservations)].sort((a, b) =>
      (a.created_at || "").localeCompare(b.created_at || "")
    ).pop();
    // Une reprise déjà en attente a déjà un mode choisi — le reproposer par
    // défaut plutôt que de repartir de zéro à chaque nouvelle activité,
    // sinon rien n'indique qu'on peut simplement continuer sur le même
    // PayPal déjà prévu (demandé par Mélanie le 2026-09-14). L'activité, en
    // revanche, est TOUJOURS celle qui vient d'être ajoutée par défaut —
    // c'est elle qui déclenche ce pop-up précis, jamais l'ancienne cible
    // d'une reprise précédente (chaque activité doit pouvoir être reliée
    // explicitement, voir reprise_activite_ids).
    const repriseExistante = Number(client.reprise_montant) > 0;
    const modeInitial = repriseExistante
      ? client.reprise_mode || MODES_PAIEMENT[0] || "Espèces EUR"
      : MODES_PAIEMENT[0] || "Espèces EUR";
    setRepriseModal({
      montant: String(diff),
      mode: modeInitial,
      activiteId: derniereActivite?.id || "",
      mixteEur: "",
      mixteEgp: "",
      mixteRate: client.egp_taux || 0,
      badge: badgeParDefautPourMode(modeInitial),
    });
  };

  // Ouverture manuelle (bouton "+ Ajouter un paiement à effectuer", visible
  // à tout moment dans Paiements) — même formulaire que checkRepriseApresAjout
  // mais sans attendre qu'une activité vienne d'être ajoutée sur un solde
  // déjà réglé : Mélanie veut pouvoir prévoir un PayPal (ou tout autre mode)
  // à venir pour n'importe quelle activité, à n'importe quel moment.
  const ouvrirPaiementAVenir = () => {
    const cible = prochaineActiviteActive(reservations);
    const mode = "PayPal";
    setRepriseModal({
      montant: "",
      mode,
      activiteId: cible?.id || "",
      mixteEur: "",
      mixteEgp: "",
      mixteRate: client.egp_taux || 0,
      badge: badgeParDefautPourMode(mode),
      manuel: true,
    });
  };

  // Appelé à chaque fin de pas-à-pas "Ajouter une activité" — regroupe les
  // deux vérifications indépendantes qui doivent s'y faire (reprise de
  // règlement, avoir à appliquer) plutôt que de dupliquer le câblage
  // onActivityFinished à chaque endroit où le pas-à-pas est monté.
  const handleActivityFinished = (reservationId?: string) => {
    // Même condition que tryAutoApplyAvoirOnFinish (candidat = la
    // réservation tout juste créée), calculée à part pour que
    // checkRepriseApresAjout connaisse ce montant AVANT de décider si le
    // pop-up de reprise doit s'afficher — sans dupliquer l'effet de bord
    // (consommer newActivityAvoirCandidateRef), laissé à
    // tryAutoApplyAvoirOnFinish seul.
    let avoirAutoApplique = 0;
    if (
      reservationId &&
      reservationId === newActivityAvoirCandidateRef.current &&
      !avoirExpire &&
      avoirDisponible > 0
    ) {
      const r = reservations.find((res) => res.id === reservationId);
      if (r) {
        const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
        avoirAutoApplique = Math.min(avoirDisponible, total);
      }
    }
    checkRepriseApresAjout(avoirAutoApplique);
    tryAutoApplyAvoirOnFinish(reservationId);
  };

  const confirmerReprise = () => {
    if (!repriseModal) return;
    const montant = Number(repriseModal.montant) || 0;
    if (montant <= 0) {
      toast("Renseigne un montant avant de valider.");
      return;
    }
    const estMixte = repriseModal.mode === "Modes différents";
    const mixteEurVal = Number(repriseModal.mixteEur) || 0;
    const mixteEgpVal = Number(repriseModal.mixteEgp) || 0;
    if (estMixte && mixteEurVal <= 0 && mixteEgpVal <= 0) {
      toast("Renseigne au moins un montant (€ ou EGP) pour ce règlement mixte.");
      return;
    }
    if (!repriseModal.activiteId) {
      toast("Choisis à quelle activité relier ce paiement.");
      return;
    }
    // S'ajoute à une reprise déjà en attente plutôt que de l'écraser — sinon
    // valider cette reprise-ci effacerait le montant d'une précédente
    // encore non réglée. reprise_activite_ids accumule CHAQUE activité
    // explicitement reliée au fil des pop-up successifs (une par activité
    // ajoutée) — c'est cette liste, pas une seule activité devinée après
    // coup, qui décide quels badges passent "en attente" (voir
    // repriseActivitesCibles dans resa.ts). reprise_activite_id garde la
    // dernière choisie, pour le rappel unique affiché à côté du titre.
    const montantCumule = Math.round(((Number(client.reprise_montant) || 0) + montant) * 100) / 100;
    const idsExistants = Array.isArray(client.reprise_activite_ids) ? client.reprise_activite_ids : [];
    const idsCumules = idsExistants.includes(repriseModal.activiteId)
      ? idsExistants
      : [...idsExistants, repriseModal.activiteId];
    onChange({
      reprise_montant: montantCumule,
      reprise_mode: repriseModal.mode,
      reprise_activite_id: repriseModal.activiteId,
      reprise_activite_ids: idsCumules,
      // Remis à 0 quand le mode n'est pas mixte, pour ne jamais laisser une
      // ancienne répartition €+EGP traîner sur un règlement redevenu simple.
      reprise_mixte_eur: estMixte ? mixteEurVal : 0,
      reprise_mixte_egp: estMixte ? mixteEgpVal : 0,
      // Mémorise le taux pour la prochaine fois (même principe que
      // marquerEncaisse pour le solde mixte, PaiementResteFlow.tsx).
      ...(estMixte && repriseModal.mixteRate > 0 ? { egp_taux: repriseModal.mixteRate } : {}),
    });
    // Badge indépendant (r.paiement_statut) sur l'activité choisie — jamais
    // via .patch() : ça ne doit toucher QUE cette activité, jamais le solde
    // ni une reprise en attente ailleurs (même principe que le menu
    // déroulant par activité, voir resa.ts).
    updateReservation(repriseModal.activiteId, { paiement_statut: repriseModal.badge });
    setRepriseModal(null);
  };

  const jumpToPaiements = () => {
    setPaiementsModalOpen(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById("section-Paiements")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });
  };

  // Depuis "Historique des modifications" (Suivi) : ouvre directement
  // l'activité concernée dans Activités, plutôt que de laisser l'employée
  // la rechercher à la main dans la liste.
  const [autoExpandReservationId, setAutoExpandReservationId] = useState<string | null>(null);
  const jumpToActivite = (reservationId: string) => {
    setOpen((prev) => ({ ...CLOSED_SECTIONS, Activités: true }));
    setAutoExpandReservationId(reservationId);
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById("section-Activités")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });
  };

  // Classe directement un hôtel pas encore répertorié (pop-up ContactStep >
  // AjouterHotelZoneModal) sans renvoyer l'employée vers HELP — la fiche en
  // cours profite tout de suite de la détection de taxe de transfert, et
  // l'hôtel reste disponible pour tous les clients suivants.
  const addHotelRef = async (nomBrut: string, ville: string) => {
    const nom = nomBrut.trim();
    const { data, error } = await supabase
      .from("hotels_reference")
      .insert({ nom, ville, sur_hurghada: ville === "Hurghada" })
      .select()
      .single();
    if (!error && data) {
      setHotelsRef((prev) => [...prev, data as HotelReference]);
      return;
    }
    // Déjà répertorié sous un nom identique (index unique sur
    // hotels_reference) — pas une vraie erreur : on récupère la fiche
    // existante au lieu d'en recréer une, pour débloquer la suite.
    if (error?.code === "23505") {
      const { data: existing } = await supabase
        .from("hotels_reference")
        .select("*")
        .ilike("nom", nom)
        .maybeSingle();
      if (existing) {
        setHotelsRef((prev) => (prev.some((h) => h.id === existing.id) ? prev : [...prev, existing as HotelReference]));
        return;
      }
    }
    toast("Échec de l'ajout de l'hôtel.");
  };

  // Une facture sans conditions de paiement enregistrées afficherait "Aucun
  // acompte enregistré" à la place de vrais chiffres — on bloque donc et on
  // renvoie vers Paiements plutôt que de générer un document vide (retour
  // de Mélanie du 31/08). On se base sur paiement_type seul (jamais "" par
  // défaut, uniquement rempli via un vrai choix de l'employée ou la pop-up
  // devis) — pas sur le montant de l'acompte, sinon un acompte à 0€
  // (volontaire : tout en solde) serait à tort traité comme "pas rempli".
  const paiementRempli = client.paiement_type === "integral" || client.paiement_type === "acompte";

  const handleDownload = async (docType: "devis" | "facture") => {
    if (docType === "facture" && !paiementRempli) {
      const ok = await confirm({
        title: "Aucun paiement enregistré",
        message:
          "Cette fiche n'a pas encore d'acompte ni de mode de règlement renseignés — la facture serait générée sans ces informations. Remplir Paiements maintenant ?",
        confirmLabel: "Aller à Paiements",
      });
      if (ok) jumpToPaiements();
      return;
    }
    setGeneratingDoc(docType);
    try {
      generateClientDocument(docType, client, reservations, resaOptions, resaTarifs, paiementsEtapes);
    } finally {
      setGeneratingDoc(null);
    }
  };

  const toggle = (s: (typeof SECTIONS)[number]) =>
    setOpen((prev) => ({ ...CLOSED_SECTIONS, [s]: !prev[s] }));

  return (
    <div className="mx-auto max-w-3xl space-y-2">
      {client.confirmation_a_traiter && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-[#0F5C56]/40 bg-[#0F5C56]/10 px-3 py-1.5">
          <p className="text-xs text-[#171717]">
            🆕 Confirmée automatiquement depuis Kommo{client.confirmation_assignee_a ? ` (renvoyée à ${client.confirmation_assignee_a})` : ""} —
            vérifiez et complétez la fiche (hôtel, dates, activités réelles).
          </p>
          <button
            onClick={() => onChange({ confirmation_a_traiter: false, confirmation_assignee_a: null })}
            className="shrink-0 rounded-md bg-[#0F5C56] px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
          >
            Marquer comme traité
          </button>
        </div>
      )}

      <div className="rounded-[6px] border border-[#eaeaea] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                value={client.nom}
                onChange={(e) => onChange({ nom: e.target.value })}
                onBlur={() => {
                  const norm = normText(client.nom);
                  if (!norm || norm === dupDismissedFor) return;
                  const matches = findDuplicateClients(
                    { nom: client.nom, telephone: client.telephone },
                    allClients,
                    client.id
                  );
                  if (matches.length > 0) setDupMatches(matches);
                }}
                placeholder="Nom du client"
                className="font-heading w-full min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold text-[#171717] hover:border-neutral-200 focus:border-[#171717] focus:outline-none"
              />
              {incidents.some((i) => i.statut === "Ouvert") && (
                <button
                  onClick={() => setShowIncidentsModal(true)}
                  title="Incident ouvert — voir le rapport"
                  className="flex-shrink-0 text-lg leading-none"
                >
                  🚩
                </button>
              )}
            </div>
            <div className="font-heading flex flex-wrap items-center gap-1.5 px-1 text-xs">
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                style={{
                  backgroundColor: `${STATUT_COLORS[client.statut]}1a`,
                  color: STATUT_COLORS[client.statut],
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: STATUT_COLORS[client.statut] }}
                />
                {client.statut}
              </span>
              <TagStarPicker tags={client.tags || []} onChange={(tags) => onChange({ tags })} />
              {(client.tags || []).map((tag) => (
                <span key={tag} className="rounded-full bg-[#171717]/5 px-2 py-0.5 text-[#171717]">
                  {tag}
                </span>
              ))}
            </div>
            {toutesInfosManquantes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs">
                {autoInfosManquantes.map((s) => (
                  <span
                    key={`auto-${s}`}
                    title="Détecté automatiquement depuis la fiche — se retire tout seul une fois complété"
                    className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700"
                  >
                    🔒 {s}
                  </span>
                ))}
                {manuelInfosManquantes.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded-full bg-[#C9973E]/15 px-2 py-0.5 text-[#666666]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            <div className="relative">
              <button
                onClick={() => {
                  setActionsMenuOpen((v) => !v);
                  setActionsMenuGroup("none");
                }}
                title="Actions"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#8B4531]/40 text-[#8B4531] hover:bg-[#8B4531]/5"
              >
                ▾
              </button>
              {actionsMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setActionsMenuGroup("none");
                    }}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-60 space-y-0.5 rounded-md border border-[#eaeaea] bg-white p-1 shadow-lg">
                    {actionsMenuGroup === "none" && (
                      <>
                        <button
                          onClick={() => setActionsMenuGroup("devisFacture")}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa]"
                        >
                          Devis / Facture <span className="text-neutral-400">›</span>
                        </button>
                        <button
                          onClick={() => setActionsMenuGroup("confirmation")}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa]"
                        >
                          Bon de confirmation <span className="text-neutral-400">›</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowIncidentsModal(true);
                            setActionsMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa]"
                        >
                          🚩 Signaler un incident / une réclamation
                        </button>
                        {client.statut !== "Client annulé" && (
                          <button
                            onClick={() => {
                              setShowAnnulerClientModal(true);
                              setActionsMenuOpen(false);
                            }}
                            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Annuler ce client
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              setActionsMenuOpen(false);
                              onDelete();
                            }}
                            className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Supprimer cette fiche client définitivement
                          </button>
                        )}
                      </>
                    )}
                    {actionsMenuGroup === "devisFacture" && (
                      <>
                        <button
                          onClick={() => setActionsMenuGroup("none")}
                          className="flex w-full items-center gap-1 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-500 hover:bg-[#fafafa]"
                        >
                          ‹ Retour
                        </button>
                        <button
                          onClick={() => {
                            setShowDevisPaiementModal(true);
                            setActionsMenuOpen(false);
                          }}
                          disabled={generatingDoc !== null}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          {generatingDoc === "devis" ? "Génération…" : "Devis (PDF)"}
                        </button>
                        <button
                          onClick={() => {
                            handleDownload("facture");
                            setActionsMenuOpen(false);
                          }}
                          disabled={generatingDoc !== null}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          {generatingDoc === "facture" ? "Génération…" : "Facture (PDF)"}
                        </button>
                      </>
                    )}
                    {actionsMenuGroup === "confirmation" && (
                      <>
                        <button
                          onClick={() => setActionsMenuGroup("none")}
                          className="flex w-full items-center gap-1 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-500 hover:bg-[#fafafa]"
                        >
                          ‹ Retour
                        </button>
                        <button
                          onClick={() => {
                            setConfirmationFormat("pdf");
                            setActionsMenuOpen(false);
                          }}
                          disabled={confirmationFormat !== null}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          {confirmationFormat === "pdf" ? "Génération…" : "PDF"}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmationFormat("png");
                            setActionsMenuOpen(false);
                          }}
                          disabled={confirmationFormat !== null}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm text-[#171717] hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          {confirmationFormat === "png" ? "Génération…" : "PNG"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => onDuplicateAsNewStay(client)}
              title="Nouveau séjour pour ce même client"
              className="whitespace-nowrap rounded-md border border-[#eaeaea] px-1.5 py-0.5 text-[10px] text-[#666666] hover:border-[#171717] hover:text-[#171717]"
            >
              + Nouveau séjour
            </button>
          </div>
        </div>
      </div>

      {autresSejours.length > 0 && (
        <div className="rounded-lg border border-[#C9973E]/40 bg-[#C9973E]/10 p-4">
          <p className="text-sm text-[#666666]">
            🔁 Ce client est déjà venu — {autresSejours.length} autre(s) séjour(s) enregistré(s) :
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {autresSejours.map((c) => (
              <button
                key={c.id}
                onClick={() => onJumpToClient(c.id)}
                className="rounded-full bg-white px-3 py-1 text-xs text-[#171717] hover:bg-neutral-50"
              >
                {c.nom || "Sans nom"} — {fmtDate(c.date_debut)}
              </button>
            ))}
          </div>
        </div>
      )}

      <GuidedActivityModal
        open={guidedOpen}
        onClose={() => setGuidedOpen(false)}
        client={client}
        onChange={onChange}
        reservations={reservations}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
        onAddReservation={addReservation}
        onUpdateReservation={updateReservation}
        onDeleteReservation={deleteReservation}
        onAddOption={addOption}
        onUpdateOption={updateOption}
        onDeleteOption={deleteOption}
        onAddTarif={addTarif}
        onUpdateTarif={updateTarif}
        onDeleteTarif={deleteTarif}
        catalogue={catalogue}
        catalogueTarifs={catalogueTarifs}
        transfertTarifs={transfertTarifs}
        catalogueOptions={catalogueOptions}
        packs={packs}
        canSeeMargins={canSeeMargins}
        hotelHorsHurghada={hotelHorsHurghada}
        hotelVille={hotelMatch?.ville}
        taxesRef={taxesRef}
        coutsMap={coutsMap}
        onUpdateCoutReel={updateCoutReel}
        onActivityFinished={handleActivityFinished}
        onBusEscalation={handleBusEscalation}
        busEscalations={busEscalations}
        onJourEscalation={handleJourEscalation}
        onAssouanVerification={handleAssouanVerification}
        assouanVerifications={assouanVerifications}
        onAcompteAlerte={handleAcompteAlerte}
      />

      {/* Contact : toujours visible, pas de clic pour déplier — c'est
          l'info qu'on consulte le plus souvent en ouvrant une fiche. */}
      <div id="section-Contact" className="rounded-[6px] border border-[#eaeaea] bg-white px-4 py-3">
        <ContactStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          totalSejour={totalSejourHeader}
          dataLoaded={dataLoaded}
          hotelsRef={hotelsRef}
          taxesRef={taxesRef}
          onOpenHelp={onOpenHelp}
          onAddHotelRef={addHotelRef}
          onNeedsField={(message, focusId) =>
            setMissingInfo({
              message,
              actionLabel: "Je rajoute l'âge des enfants",
              focusId,
              section: "Contact",
            })
          }
          onJumpToPaiements={jumpToPaiements}
          onClientHotelsChange={setClientHotels}
        />
      </div>

      <Section
        title="Activités réservées"
        endBadge={
          <span className="flex items-center gap-1.5">
            {reservations.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F5C56]/10 px-1 text-xs font-semibold text-[#0F5C56]">
                {reservationsActives(reservations).length}
              </span>
            )}
            {reservations.filter((r) => r.statut_resa === "Annulée").length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1 text-xs font-semibold text-red-600">
                ({reservations.filter((r) => r.statut_resa === "Annulée").length})
              </span>
            )}
            {client.statut !== "Client annulé" && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setGuidedOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    setGuidedOpen(true);
                  }
                }}
                title="Ajouter une activité"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-sm font-semibold leading-none text-white hover:bg-[#1d4ed8]"
              >
                +
              </span>
            )}
          </span>
        }
        open={open.Activités}
        onToggle={() => toggle("Activités")}
      >
        <ActivitesStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          onAddReservation={addReservation}
          onUpdateReservation={updateReservation}
          onDeleteReservation={deleteReservation}
          onAddOption={addOption}
          onUpdateOption={updateOption}
          onDeleteOption={deleteOption}
          onAddTarif={addTarif}
          onUpdateTarif={updateTarif}
          onDeleteTarif={deleteTarif}
          catalogue={catalogue}
          catalogueTarifs={catalogueTarifs}
          transfertTarifs={transfertTarifs}
          catalogueOptions={catalogueOptions}
          packs={packs}
          canSeeMargins={canSeeMargins}
          hotelHorsHurghada={hotelHorsHurghada}
          hotelVille={hotelMatch?.ville}
          clientHotels={clientHotels}
          hotelsRef={hotelsRef}
          taxesRef={taxesRef}
          coutsMap={coutsMap}
          onUpdateCoutReel={updateCoutReel}
          onRequestAdd={() => setGuidedOpen(true)}
          onActivityFinished={handleActivityFinished}
          onBusEscalation={handleBusEscalation}
          busEscalations={busEscalations}
          onJourEscalation={handleJourEscalation}
          onAssouanVerification={handleAssouanVerification}
          assouanVerifications={assouanVerifications}
          paiementsEtapes={paiementsEtapes}
          avoirs={avoirs}
          onAddPaiementEtape={addPaiementEtape}
          autoExpandReservationId={autoExpandReservationId}
          onAutoExpandHandled={() => setAutoExpandReservationId(null)}
        />
      </Section>

      <div
        id="section-Paiements"
        onClick={() => setPaiementsModalOpen(true)}
        className="flex cursor-pointer items-center justify-between rounded-[6px] border border-[#eaeaea] bg-white px-4 py-2.5 text-left hover:bg-[#fafafa]"
      >
        <span className="font-heading text-sm font-semibold text-[#171717]">Paiements</span>
        {dataLoaded ? (
          <span
            className={`flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-2 text-xs font-medium ${
              paiementFullyPaid ? "bg-[#0F5C56]/10 text-[#0F5C56]" : "bg-[#F2E6D2] text-[#5C2A1D]"
            }`}
          >
            <span className="font-amounts font-semibold">{euros(totalSejourHeader)} €</span>
            <span className={paiementFullyPaid ? "text-[#0F5C56]/30" : "text-[#5C2A1D]/30"}>·</span>
            <span className={`flex items-center gap-1 ${paiementFullyPaid ? "text-[#0F5C56]" : "text-[#C9973E]"}`}>
              <span className="text-[8px]">●</span>
              {paiementFullyPaid
                ? "Payé"
                : client.reprise_montant > 0
                  ? `En attente : ${euros(client.reprise_montant)} € (nouvelle activité)`
                  : totalPayeHeader > 0
                    ? `Acompte payé (${euros(totalPayeHeader)} €) reste ${euros(
                        totalSejourHeader - totalPayeHeader
                      )} € — en attente`
                    : "En attente"}
            </span>
          </span>
        ) : (
          <span className="inline-block h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
        )}
      </div>

      {paiementsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPaiementsModalOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">Paiements</h2>
              <button
                type="button"
                onClick={() => setPaiementsModalOpen(false)}
                className="text-neutral-400 hover:text-[#171717]"
              >
                ✕
              </button>
            </div>
            <PaiementsStep
              client={client}
              onChange={onChange}
              reservations={reservations}
              resaOptions={resaOptions}
              resaTarifs={resaTarifs}
              onUpdateReservation={updateReservation}
              paiementsEtapes={paiementsEtapes}
              onAddPaiementEtape={addPaiementEtape}
              onDeletePaiementEtape={deletePaiementEtape}
              isDirection={canSeeMargins}
              onAcompteAlerte={handleAcompteAlerte}
              onAdjustAvoir={adjustAvoirOnReservation}
              paypalPaiements={paypalPaiementsClient}
              onOuvrirPaiementAVenir={ouvrirPaiementAVenir}
            />
          </div>
        </div>
      )}

      <Section title="Suivi" open={open.Suivi} onToggle={() => toggle("Suivi")}>
        <SuiviStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          avoirs={avoirs}
          onAddAvoir={addAvoir}
          onUpdateAvoir={updateAvoir}
          onDeleteAvoir={deleteAvoir}
          onUpdateReservation={updateReservation}
          onOpenReservation={jumpToActivite}
          isDirection={canSeeMargins}
          incidents={incidents}
          onResolveIncident={(id, statut) => {
            setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, statut } : i)));
            onIncidentsChanged?.();
            supabase.from("incidents").update({ statut }).eq("id", id).then(({ error }) => {
              if (error) toast("Échec de la mise à jour.");
            });
          }}
        />
      </Section>

      {repriseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              {repriseModal.manuel
                ? "Prévoir un paiement à effectuer"
                : "Le client avait déjà réglé toutes ses activités"}
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              {repriseModal.manuel
                ? "Montant, mode, activité concernée et badge affiché — tout est modifiable."
                : "Pour cette nouvelle activité, quel est le règlement prévu ?"}
            </p>
            {Number(client.reprise_montant) > 0 && (
              <p className="mb-4 rounded-md bg-[#C9973E]/10 p-2.5 text-xs text-[#8B4531]">
                Une reprise de {euros(Number(client.reprise_montant))} € ({client.reprise_mode}) est déjà en
                attente pour ce client
                {client.reprise_activite_ids && client.reprise_activite_ids.length > 0
                  ? ` — déjà reliée à : ${client.reprise_activite_ids
                      .map((id) => reservations.find((r) => r.id === id)?.nom_activite)
                      .filter(Boolean)
                      .join(", ")}`
                  : ""}
                . Le mode ci-dessous en repart par défaut pour continuer sur le même, mais tu peux changer si
                cette activité-ci doit être réglée autrement. Le montant s&apos;ajoutera automatiquement, et
                cette activité-ci viendra s&apos;ajouter à la liste des activités en attente.
              </p>
            )}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-neutral-500">Montant</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={repriseModal.montant}
                onChange={(e) => setRepriseModal({ ...repriseModal, montant: e.target.value })}
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-neutral-500">Mode de règlement</label>
              <select
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={repriseModal.mode}
                onChange={(e) => {
                  const mode = e.target.value;
                  // Pré-rempli avec tout le montant en € et rien en EGP —
                  // même principe que le mixteModal du solde
                  // (PaiementResteFlow.tsx) : l'employée ajuste ensuite
                  // librement la vraie répartition, mais part d'un état
                  // cohérent avec le Montant déjà saisi plutôt que de deux
                  // champs vides sans lien avec lui.
                  // Le badge suit le mode par défaut à chaque changement —
                  // seulement s'il n'a pas déjà été personnalisé à la main
                  // (sinon repasser sur PayPal par erreur écraserait un
                  // badge choisi exprès juste avant).
                  const badgeSuit = repriseModal.badge === badgeParDefautPourMode(repriseModal.mode);
                  const patch = badgeSuit ? { badge: badgeParDefautPourMode(mode) } : {};
                  if (mode === "Modes différents" && !repriseModal.mixteEur && !repriseModal.mixteEgp) {
                    setRepriseModal({
                      ...repriseModal,
                      mode,
                      mixteEur: repriseModal.montant,
                      mixteEgp: "0",
                      ...patch,
                    });
                  } else {
                    setRepriseModal({ ...repriseModal, mode, ...patch });
                  }
                }}
              >
                {MODES_PAIEMENT.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {/* Pas dans MODES_PAIEMENT (liste partagée avec l'acompte et
                    les étapes libres, qui ne gèrent pas ce cas) — seule la
                    reprise et le solde savent traiter un règlement mixte. */}
                <option value="Modes différents">Paiement mixte (€ + EGP)</option>
              </select>
            </div>
            {repriseModal.mode === "Modes différents" && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
                    Montant en € (cash)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    value={repriseModal.mixteEur}
                    onChange={(e) => setRepriseModal({ ...repriseModal, mixteEur: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">
                    Montant en EGP (cash)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    value={repriseModal.mixteEgp}
                    onChange={(e) => setRepriseModal({ ...repriseModal, mixteEgp: e.target.value })}
                  />
                </div>
              </div>
            )}
            {repriseModal.mode === "Modes différents" && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  Taux du jour (1€ =), pour info
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full max-w-[140px] rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  value={repriseModal.mixteRate}
                  onChange={(e) => setRepriseModal({ ...repriseModal, mixteRate: Number(e.target.value) })}
                />
              </div>
            )}
            {repriseModal.mode === "Modes différents" &&
              (() => {
                // Simple repère de cohérence (jamais bloquant, même
                // principe que le mixteModal du solde) : le Montant du haut
                // sert de flag "reprise en cours" et de total affiché —
                // sans ce repère, rien n'avertissait si sa somme s'éloigne
                // de la vraie répartition €+EGP saisie juste au-dessus.
                const eurVal = Number(repriseModal.mixteEur) || 0;
                const egpVal = Number(repriseModal.mixteEgp) || 0;
                const taux = repriseModal.mixteRate || 0;
                const equivalentEur = eurVal + (taux > 0 ? egpVal / taux : 0);
                const montantVal = Number(repriseModal.montant) || 0;
                const ecartSignificatif = Math.abs(equivalentEur - montantVal) > 1;
                return (
                  <p
                    className={`mb-3 text-xs ${ecartSignificatif ? "font-medium text-orange-600" : "text-neutral-500"}`}
                  >
                    Soit l&apos;équivalent de {euros(equivalentEur)} € (taux du jour : {taux || "non renseigné"})
                    {ecartSignificatif
                      ? ` — écart avec le Montant saisi en haut (${euros(montantVal)} €).`
                      : "."}
                  </p>
                );
              })()}
            {/* Toujours demandé, y compris en PayPal/virement — sans point de
                collecte physique, deviner après coup laquelle des activités
                actives est concernée a déjà fait afficher "Payé" à tort sur
                une activité en réalité impayée (vécu sur Carine LELOIR le
                2026-09-14). Poser explicitement la question ici garantit que
                le bon badge passe "en attente", jamais une devinette par
                date/ordre de création. */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                À quelle activité relier ce paiement ?
              </label>
              <select
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={repriseModal.activiteId}
                onChange={(e) => setRepriseModal({ ...repriseModal, activiteId: e.target.value })}
              >
                <option value="">— Choisir —</option>
                {reservationsActives(reservations).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom_activite || "Activité sans nom"}
                    {r.date_debut ? ` — ${fmtDate(r.date_debut)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Badge affiché sur cette activité
              </label>
              <select
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={repriseModal.badge}
                onChange={(e) => setRepriseModal({ ...repriseModal, badge: e.target.value as StatutPaiementKey })}
              >
                {STATUT_PAIEMENT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmerReprise}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Valider
              </button>
              <button
                onClick={() => {
                  setRepriseModal(null);
                  setPaiementsModalOpen(true);
                }}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                {repriseModal.manuel ? "Annuler" : "Programmer une deuxième étape pour ce paiement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reglementSuppressionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Un règlement est prévu sur &quot;{reglementSuppressionModal.reservationNom}&quot;
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              {reglementSuppressionModal.type === "solde" ? "Le solde du séjour" : "Un reste de reprise"} de{" "}
              {euros(Number(reglementSuppressionModal.montant) || 0)} € doit encore être réglé sur cette
              activité — décide quoi en faire avant de la retirer.
            </p>
            <div className="mb-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setReglementSuppressionModal({ ...reglementSuppressionModal, choix: "annuler" })}
                className={`rounded-md border px-3 py-2 text-left text-sm font-medium hover:opacity-90 ${
                  reglementSuppressionModal.choix === "annuler"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-700"
                }`}
              >
                Annuler ce règlement — il n&apos;a jamais été payé
              </button>
              <button
                type="button"
                onClick={() => setReglementSuppressionModal({ ...reglementSuppressionModal, choix: "deplacer" })}
                className={`rounded-md border px-3 py-2 text-left text-sm font-medium hover:opacity-90 ${
                  reglementSuppressionModal.choix === "deplacer"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-700"
                }`}
              >
                Reporter ce règlement sur une autre activité
              </button>
            </div>
            {reglementSuppressionModal.choix === "deplacer" && (
              <>
                {reglementSuppressionModal.type === "reprise" && (
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-neutral-500">Montant</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      value={reglementSuppressionModal.montant}
                      onChange={(e) =>
                        setReglementSuppressionModal({ ...reglementSuppressionModal, montant: e.target.value })
                      }
                    />
                  </div>
                )}
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Mode de règlement</label>
                  <select
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    value={reglementSuppressionModal.mode}
                    onChange={(e) =>
                      setReglementSuppressionModal({ ...reglementSuppressionModal, mode: e.target.value })
                    }
                  >
                    {MODES_PAIEMENT.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Sur quelle activité ?</label>
                  <select
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    value={reglementSuppressionModal.cibleId}
                    onChange={(e) =>
                      setReglementSuppressionModal({ ...reglementSuppressionModal, cibleId: e.target.value })
                    }
                  >
                    <option value="">— Choisir —</option>
                    {reservationsActives(reservations)
                      .filter((r) => r.id !== reglementSuppressionModal.reservationId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nom_activite || "Activité sans nom"}
                          {r.date_debut ? ` — ${fmtDate(r.date_debut)}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmerReglementSuppression}
                disabled={!reglementSuppressionModal.choix}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Valider et retirer l&apos;activité
              </button>
              <button
                onClick={() => setReglementSuppressionModal(null)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Annuler (garder l&apos;activité)
              </button>
            </div>
          </div>
        </div>
      )}

      {avoirAppliedNotice !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAvoirAppliedNotice(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-base font-semibold text-[#171717]">Avoir appliqué</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Un avoir de <strong>{euros(avoirAppliedNotice.montant)} €</strong> a été appliqué
              automatiquement sur cette activité. Ajustable à tout moment depuis l&apos;onglet
              Paiements si ce n&apos;est pas ce que tu voulais.
            </p>
            <button
              onClick={() => {
                setAvoirAppliedNotice(null);
                setPaiementsModalOpen(true);
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    document
                      .getElementById("section-Paiements")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                });
              }}
              className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Aller aux Paiements
            </button>
            <button
              onClick={() => {
                const notice = avoirAppliedNotice;
                setAvoirAppliedNotice(null);
                adjustAvoirOnReservation(notice.reservationId, 0);
              }}
              className="mt-2 w-full rounded-md px-3 py-2 text-sm text-neutral-500 hover:underline"
            >
              Ne pas l&apos;utiliser sur cette activité
            </button>
          </div>
        </div>
      )}

      {momentConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-md bg-white p-5">
            <p className="mb-4 text-sm font-medium text-[#171717]">
              ⚠ Attention, vous avez sélectionné deux activités sur la même date au même moment
              de la journée : «{" "}
              {momentConflict.current.nom_activite || "Activité sans nom"} » et «{" "}
              {momentConflict.other.nom_activite || "Activité sans nom"} ».
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMomentConflict(null)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={goToMomentConflict}
                className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Je corrige
              </button>
            </div>
          </div>
        </div>
      )}

      {missingInfo && (
        <MissingInfoModal
          message={missingInfo.message}
          actionLabel={missingInfo.actionLabel}
          onAction={goToMissingField}
          onClose={() => setMissingInfo(null)}
        />
      )}

      {showAnnulerClientModal && (
        <AnnulerClientModal
          client={client}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          catalogue={catalogue}
          onUpdateClient={onChange}
          onUpdateReservation={updateReservation}
          onClose={() => setShowAnnulerClientModal(false)}
        />
      )}
      {showIncidentsModal && (
        <IncidentsModal
          clientId={client.id}
          clientNom={client.nom}
          incidents={incidents}
          onAdd={(incident) => {
            setIncidents((prev) => [...prev, incident]);
            onIncidentsChanged?.();
          }}
          onUpdate={(id, patch) => {
            setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
            onIncidentsChanged?.();
          }}
          onDelete={(id) => {
            setIncidents((prev) => prev.filter((i) => i.id !== id));
            onIncidentsChanged?.();
          }}
          onClose={() => setShowIncidentsModal(false)}
        />
      )}
      {showDevisPaiementModal && (
        <DevisPaiementModal
          client={client}
          totalSejour={totalSejourHeader}
          onUpdateClient={onChange}
          onConfirm={() => handleDownload("devis")}
          onClose={() => setShowDevisPaiementModal(false)}
        />
      )}
      <ConfirmationDocumentStage
        client={confirmationFormat ? client : null}
        reservations={reservations}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
        paiementsEtapes={paiementsEtapes}
        hotelVille={hotelMatch?.ville}
        format={confirmationFormat}
        onDone={() => {
          setConfirmationFormat(null);
          const activiteAVerifier = reservations.find((rr) => {
            const item = catalogue.find((c) => c.id === rr.catalogue_item_id);
            if (!item?.necessite_verif_hebergement_assouan) return false;
            const verif = assouanVerifications.find((v) => v.reservation_id === rr.id);
            return verif?.statut !== "validee";
          });
          if (activiteAVerifier) setAssouanRepromptId(activiteAVerifier.id);
        }}
      />
      {assouanRepromptId &&
        (() => {
          const r = reservations.find((rr) => rr.id === assouanRepromptId);
          if (!r) return null;
          return (
            <AssouanHebergementAlert
              nomActivite={r.nom_activite}
              onClose={() => setAssouanRepromptId(null)}
              onConfirmerInfo={async () => {
                await handleAssouanVerification(r.nom_activite, r.id);
                setAssouanRepromptId(null);
              }}
            />
          );
        })()}
      {dupMatches.length > 0 && (
        <DuplicateClientModal
          current={client}
          matches={dupMatches}
          onOpenClient={(id) => {
            setDupMatches([]);
            onJumpToClient(id);
          }}
          onDeleteClient={async (id) => {
            setDupMatches([]);
            if (id === client.id) onDelete();
            else await onDeleteClientById(id);
          }}
          onKeepBoth={() => {
            setDupDismissedFor(normText(client.nom));
            setDupMatches([]);
          }}
        />
      )}
    </div>
  );
}
