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
  HotelReference,
  Incident,
  PaiementEtape,
  Pack,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxe,
} from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import MissingInfoModal from "@/components/MissingInfoModal";
import GuidedActivityModal from "@/components/GuidedActivityModal";
import AvoirUseModal from "@/components/AvoirUseModal";
import AnnulerClientModal from "@/components/AnnulerClientModal";
import IncidentsModal from "@/components/IncidentsModal";
import DevisPaiementModal from "@/components/DevisPaiementModal";
import ConfirmationDocumentStage from "@/components/ConfirmationDocument";
import DuplicateClientModal from "@/components/DuplicateClientModal";
import AssouanHebergementAlert from "@/components/AssouanHebergementAlert";
import { STATUT_COLORS } from "@/lib/constants";
import { generateClientDocument } from "@/lib/generateClientDocument";
import { matchHotel } from "@/lib/hotelHelp";
import { DuplicateMatch, findDuplicateClients, normText } from "@/lib/duplicates";
import { resaTotalMontant, avoirUtiliseTotal, findMomentConflict, reservationsActives } from "@/lib/resa";
import { infosManquantesAuto } from "@/lib/infosManquantes";
import {
  ActivitesStep,
  ContactStep,
  PaiementsStep,
  SuiviStep,
} from "@/components/client-steps";

const SECTIONS = ["Contact", "Activités", "Paiements", "Suivi"] as const;

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function Section({
  title,
  titleExtra,
  endBadge,
  open,
  onToggle,
  children,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  endBadge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div id={`section-${title}`} className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold text-[#171717]">{title}</span>
          {titleExtra}
        </span>
        <span className="flex items-center gap-2">
          {endBadge}
          <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>
            ⌄
          </span>
        </span>
      </button>
      {open && <div className="border-t border-[#666666]/10 px-4 py-4">{children}</div>}
    </div>
  );
}

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
    const { data } = await supabase
      .from("assouan_verifications")
      .select("*")
      .eq("client_id", client.id);
    setAssouanVerifications((data as AssouanVerification[]) || []);
  };

  useEffect(() => {
    const check = () => refreshAssouanVerifications();
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

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
  // client, pas un raccourci pris par l'employée.
  const handleBusEscalation = async (nomActivite: string, reservationId: string) => {
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
  const [avoirPromptReservationId, setAvoirPromptReservationId] = useState<string | null>(null);
  const [avoirAppliedNotice, setAvoirAppliedNotice] = useState<number | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [paiementsEtapes, setPaiementsEtapes] = useState<PaiementEtape[]>([]);
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

  const addPaiementEtape = async (montant: number, mode: string, date: string, note: string) => {
    const { data, error } = await supabase
      .from("paiements_etapes")
      .insert({ client_id: client.id, montant, mode, date: date || null, note })
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

  const addAvoir = async () => {
    const { data, error } = await supabase
      .from("avoirs")
      .insert({ client_id: client.id })
      .select()
      .single();
    if (!error && data) {
      setAvoirs((prev) => [...prev, data as Avoir]);
    } else {
      toast("Impossible d'ajouter l'avoir.");
    }
  };

  const updateAvoir = async (id: string, patch: Partial<Avoir>) => {
    setAvoirs((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("avoirs").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteAvoir = async (id: string) => {
    const ok = await confirm({
      message: "Retirer cet avoir ? Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setAvoirs((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from("avoirs").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const avoirDisponible = avoirs.reduce((s, a) => s + (Number(a.montant_restant) || 0), 0);

  const useAvoir = async (montant: number) => {
    const reservationId = avoirPromptReservationId;
    setAvoirPromptReservationId(null);
    if (!reservationId) return;
    let restant = montant;
    for (const a of avoirs) {
      if (restant <= 0) break;
      const pris = Math.min(restant, Number(a.montant_restant) || 0);
      if (pris <= 0) continue;
      restant -= pris;
      await updateAvoir(a.id, { montant_restant: (Number(a.montant_restant) || 0) - pris });
    }
    // Le montant appliqué se rattache à cette activité précise, pour
    // s'afficher sur sa carte ("avoir de X € utilisé sur cette activité"),
    // même si le solde qu'il réduit reste unique pour tout le séjour.
    await updateReservation(reservationId, { avoir_utilise: montant });
    setAvoirAppliedNotice(montant);
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

  const addReservation = async (attempt = 0): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let creeParNom = "";
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("prenom, email")
        .eq("id", user.id)
        .single();
      creeParNom = prof?.prenom || (prof?.email || "").split("@")[0] || "";
    }
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        client_id: client.id,
        transfert_inclus: !hotelHorsHurghada,
        cree_par_id: user?.id || null,
        cree_par_nom: creeParNom,
      })
      .select()
      .single();
    if (!error && data) {
      const newReservation = data as Reservation;
      setReservations((prev) => [...prev, newReservation]);
      // Cette nouvelle activité peut être l'occasion de consommer un avoir
      // en attente — le montant utilisé se rattache à cette réservation
      // précise pour rester visible sur sa carte.
      if (avoirDisponible > 0) setAvoirPromptReservationId(newReservation.id);
      return newReservation.id;
    }
    // Un token d'auth silencieusement expiré échoue une seule fois — on le
    // rafraîchit et on retente avant d'afficher un échec à l'employée.
    if (attempt === 0) {
      await supabase.auth.refreshSession();
      return addReservation(1);
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
  const reservationErrorToastShown = useRef<Record<string, boolean>>({});

  const flushReservation = useCallback(
    async (id: string, attempt = 0) => {
      const patch = reservationPendingPatch.current[id];
      if (!patch || Object.keys(patch).length === 0) return;
      const { error } = await supabase.from("reservations").update(patch).eq("id", id);
      if (!error) {
        const current = reservationPendingPatch.current[id];
        if (current) {
          Object.keys(patch).forEach((k) => delete (current as Record<string, unknown>)[k]);
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
      reservationRetryTimers.current[id] = setTimeout(() => flushReservation(id, attempt + 1), delay);
    },
    [supabase, toast]
  );

  const updateReservation = (id: string, patch: Partial<Reservation>) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    reservationPendingPatch.current[id] = { ...reservationPendingPatch.current[id], ...patch };
    if (reservationRetryTimers.current[id]) clearTimeout(reservationRetryTimers.current[id]);
    flushReservation(id);
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
    setReservations(
      list.map((r) =>
        reservationPendingPatch.current[r.id] ? { ...r, ...reservationPendingPatch.current[r.id] } : r
      )
    );

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

  const deleteReservation = async (id: string) => {
    const ok = await confirm({
      title: "Retirer cette activité ?",
      message: "Ses options et son lien éventuel au solde seront aussi retirés. Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
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

  const addOption = async (
    resaId: string,
    seed?: { nom: string; prix: number; quantite?: number; prix_compte_ailleurs?: boolean }
  ) => {
    const { data, error } = await supabase
      .from("reservation_options")
      .insert({
        reservation_id: resaId,
        nom: seed?.nom || "Guide francophone",
        prix: seed?.prix || 0,
        ...(seed?.quantite ? { quantite: seed.quantite } : {}),
        ...(seed?.prix_compte_ailleurs ? { prix_compte_ailleurs: true } : {}),
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

  const updateOption = async (
    resaId: string,
    optId: string,
    patch: Partial<ReservationOption>
  ) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((o) => (o.id === optId ? { ...o, ...patch } : o)),
    }));
    const { error } = await supabase.from("reservation_options").update(patch).eq("id", optId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteOption = async (resaId: string, optId: string) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((o) => o.id !== optId),
    }));
    const { error } = await supabase.from("reservation_options").delete().eq("id", optId);
    if (error) toast("Échec de la suppression.");
  };

  const addTarif = async (resaId: string, seed?: { label: string; pu: number }) => {
    const { data, error } = await supabase
      .from("reservation_tarifs")
      .insert({ reservation_id: resaId, label: seed?.label || "", pu: seed?.pu || 0, quantite: 0 })
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

  const updateTarif = async (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((t) => (t.id === tarifId ? { ...t, ...patch } : t)),
    }));
    const { error } = await supabase.from("reservation_tarifs").update(patch).eq("id", tarifId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteTarif = async (resaId: string, tarifId: string) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((t) => t.id !== tarifId),
    }));
    const { error } = await supabase.from("reservation_tarifs").delete().eq("id", tarifId);
    if (error) toast("Échec de la suppression.");
  };

  const autresSejours = allClients.filter(
    (c) => c.id !== client.id && client.telephone && c.telephone === client.telephone
  );

  const totalSejourHeader = reservationsActives(reservations).reduce(
    (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
  const autoInfosManquantes = infosManquantesAuto(client, reservations, hotelsRef);
  const manuelInfosManquantes = client.infos_manquantes.filter(
    (s) => s !== "Complet" && !autoInfosManquantes.includes(s)
  );
  const toutesInfosManquantes = [...autoInfosManquantes, ...manuelInfosManquantes];

  const acomptePayeMontant =
    client.paiement_type === "acompte" && client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  const avoirUtiliseHeader = avoirUtiliseTotal(reservations);
  const etapesSumHeader = paiementsEtapes.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const soldeRestantHeader = Math.max(
    totalSejourHeader - acomptePayeMontant - etapesSumHeader - avoirUtiliseHeader,
    0
  );
  const totalPayeHeader =
    acomptePayeMontant + etapesSumHeader + avoirUtiliseHeader + (client.solde_paye ? soldeRestantHeader : 0);
  const paiementFullyPaid = totalSejourHeader > 0 && totalPayeHeader >= totalSejourHeader;

  const jumpToPaiements = () => {
    setPaiementsModalOpen(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById("section-Paiements")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });
  };

  // Classe directement un hôtel pas encore répertorié (pop-up ContactStep >
  // AjouterHotelZoneModal) sans renvoyer l'employée vers HELP — la fiche en
  // cours profite tout de suite de la détection de taxe de transfert, et
  // l'hôtel reste disponible pour tous les clients suivants.
  const addHotelRef = async (nom: string, ville: string) => {
    const { data, error } = await supabase
      .from("hotels_reference")
      .insert({ nom, ville, sur_hurghada: ville === "Hurghada" })
      .select()
      .single();
    if (error || !data) {
      toast("Échec de l'ajout de l'hôtel.");
      return;
    }
    setHotelsRef((prev) => [...prev, data as HotelReference]);
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
      generateClientDocument(docType, client, reservations, resaOptions, resaTarifs);
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
        coutsMap={coutsMap}
        onUpdateCoutReel={updateCoutReel}
        onBusEscalation={handleBusEscalation}
        busEscalations={busEscalations}
        onJourEscalation={handleJourEscalation}
        onAssouanVerification={handleAssouanVerification}
        assouanVerifications={assouanVerifications}
      />

      {/* Contact : toujours visible, pas de clic pour déplier — c'est
          l'info qu'on consulte le plus souvent en ouvrant une fiche. */}
      <div id="section-Contact" className="rounded-[6px] border border-[#eaeaea] bg-white px-4 py-3">
        <ContactStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          totalSejour={totalSejourHeader}
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
        />
      </div>

      <Section
        title="Activités réservées"
        endBadge={
          <span className="flex items-center gap-1.5">
            {reservations.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0F5C56]/10 px-1 text-xs font-semibold text-[#0F5C56]">
                {reservations.length}
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
          coutsMap={coutsMap}
          onUpdateCoutReel={updateCoutReel}
          onRequestAdd={() => setGuidedOpen(true)}
          onBusEscalation={handleBusEscalation}
          busEscalations={busEscalations}
          onJourEscalation={handleJourEscalation}
          onAssouanVerification={handleAssouanVerification}
          assouanVerifications={assouanVerifications}
          paiementsEtapes={paiementsEtapes}
        />
      </Section>

      <div
        id="section-Paiements"
        onClick={() => setPaiementsModalOpen(true)}
        className="flex cursor-pointer items-center justify-between rounded-[6px] border border-[#eaeaea] bg-white px-4 py-2.5 text-left hover:bg-[#fafafa]"
      >
        <span className="font-heading text-sm font-semibold text-[#171717]">Paiements</span>
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
              : totalPayeHeader > 0
                ? `Acompte payé (${euros(totalPayeHeader)} €) reste ${euros(
                    totalSejourHeader - totalPayeHeader
                  )} € — en attente`
                : "En attente"}
          </span>
        </span>
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
          incidents={incidents}
          onResolveIncident={(id, statut) => {
            setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, statut } : i)));
            supabase.from("incidents").update({ statut }).eq("id", id).then(({ error }) => {
              if (error) toast("Échec de la mise à jour.");
            });
          }}
        />
      </Section>

      <AvoirUseModal
        open={avoirPromptReservationId !== null}
        montantDisponible={avoirDisponible}
        onClose={() => setAvoirPromptReservationId(null)}
        onUse={useAvoir}
      />

      {avoirAppliedNotice !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAvoirAppliedNotice(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-base font-semibold text-[#171717]">Avoir utilisé</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Un avoir de <strong>{euros(avoirAppliedNotice)} €</strong> a été utilisé sur cette
              activité. Repassez par l&apos;onglet Paiements pour vérifier le montant restant dû.
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
          onAdd={(incident) => setIncidents((prev) => [...prev, incident])}
          onUpdate={(id, patch) => setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))}
          onDelete={(id) => setIncidents((prev) => prev.filter((i) => i.id !== id))}
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

const TAG_OPTIONS = ["VIP", "Récurrent", "Urgent", "Vigilance"];

// Petite étoile à côté des badges du bandeau (statut/hôtel/dates) : clic
// pour ouvrir un menu et cocher/décocher les étiquettes — remplace
// l'ancienne rangée de pastilles en pointillés, toujours visible même
// sans étiquette.
function TagStarPicker({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (tag: string) => {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Étiquettes"
        className={`flex h-5 w-5 items-center justify-center rounded-full ${
          tags.length > 0 ? "text-[#C9973E]" : "text-neutral-300 hover:text-neutral-400"
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          fill={tags.length > 0 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4"
        >
          <path
            d="M10 2.8 12.2 7.6l5.2.6-3.9 3.6 1 5.1-4.5-2.6-4.5 2.6 1-5.1-3.9-3.6 5.2-.6L10 2.8Z"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 w-36 rounded-md border border-[#eaeaea] bg-white p-1 shadow-lg">
            {TAG_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#fafafa]"
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${
                    tags.includes(opt) ? "border-[#C9973E] bg-[#C9973E]" : "border-neutral-300"
                  }`}
                >
                  {tags.includes(opt) && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
