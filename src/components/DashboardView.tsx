"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueItem,
  Client,
  Incident,
  PaiementEtape,
  PlanningShift,
  Profile,
  Reservation,
  ReservationOption,
  ReservationTarif,
  UserShift,
} from "@/lib/types";
import { cleanActivityTitle, missingChampsFor, paxSummary, resaTotalMontant, reservationsActives } from "@/lib/resa";
import { infosManquantesToutes } from "@/lib/infosManquantes";
import { addDays, localDateStr } from "@/lib/dates";
import { PROSPECT_STATUTS, STATUTS, STATUT_COLORS } from "@/lib/constants";
import DonutChart from "@/components/charts/DonutChart";
import QuickAddClient from "@/components/QuickAddClient";
import PickClientModal from "@/components/PickClientModal";
import PaiementsDuJourModal, { computePaiementsDuJour } from "@/components/PaiementsDuJourModal";
import { daysSince, euros, firstNameFromEmail, fmtDate } from "@/lib/dashboardFormat";
import {
  ActionRow,
  Avatar,
  InfoListModal,
  Metric,
} from "@/components/dashboard/DashboardPrimitives";

export default function DashboardView({
  userEmail,
  viewAsUserId,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  isDirection,
  onOpenClient,
  onOpenClientForNewActivity,
  onOpenClientForCancelActivity,
  onOpenClientForRemboursement,
  onOpenRemboursements,
  onOpenRdvPaiements,
  onOpenPickupsChambres,
  onOpenNumerosChambre,
  onOpenAuRevoir,
  onOpenAvisClients,
  onOpenProspectsARelancer,
  onOpenBilletsAvion,
  onOpenPaypalPaiements,
  paypalPaiementsNonRattaches,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
  catalogue,
  incidents,
  onOpenIncidents,
  showTeamShiftsToday,
  teamPlanningShifts,
  teamProfiles,
  displayFirstName,
  paiementsEtapes,
}: {
  userEmail: string;
  // Simulation "Aperçu vu par" (AppShell) : affiche le shift du jour de
  // CETTE personne plutôt que celui du vrai compte connecté.
  viewAsUserId?: string;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  isDirection: boolean;
  onOpenClient: (id: string) => void;
  onOpenClientForNewActivity: (id: string) => void;
  onOpenClientForCancelActivity: (id: string) => void;
  onOpenClientForRemboursement: (id: string) => void;
  onOpenRemboursements: () => void;
  onOpenRdvPaiements: () => void;
  onOpenPickupsChambres: () => void;
  onOpenNumerosChambre: () => void;
  onOpenAuRevoir: () => void;
  onOpenAvisClients: () => void;
  onOpenProspectsARelancer: () => void;
  onOpenBilletsAvion: () => void;
  onOpenPaypalPaiements: () => void;
  paypalPaiementsNonRattaches: number;
  onCreateClient: (fields: {
    nom: string;
    telephone: string;
    canal: string;
    statut: "Prospect" | "Client confirmé";
  }) => Promise<Client | null>;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  onDeleteClient: (id: string) => Promise<boolean>;
  catalogue: CatalogueItem[];
  incidents: Incident[];
  onOpenIncidents: () => void;
  // Équipe Égypte (Hossam, Bodé) : pas d'accès à Planning équipe, donc pas
  // d'autre moyen de savoir qui contacter aujourd'hui — ce petit récap
  // compense en listant les shifts du jour directement sur le tableau de
  // bord. true seulement quand "rh" est dans leur nav_masque (AppShell).
  showTeamShiftsToday: boolean;
  teamPlanningShifts: PlanningShift[];
  teamProfiles: Profile[];
  // Prénom réel (profil), envoyé par AppShell — évite de dépendre de
  // firstNameFromEmail(userEmail), qui donnait par ex. "Neno" pour
  // neno_hossam@yahoo.com au lieu de "Hossam". Optionnel pour ne rien
  // casser si jamais non fourni : on retombe alors sur l'ancien calcul.
  displayFirstName?: string;
  paiementsEtapes: PaiementEtape[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [shift, setShift] = useState<UserShift | null>(null);
  const [plannedShift, setPlannedShift] = useState<PlanningShift | null>(null);
  const [editingShift, setEditingShift] = useState(false);
  const [pickClientForActivityOpen, setPickClientForActivityOpen] = useState(false);
  const [pickClientForCancelOpen, setPickClientForCancelOpen] = useState(false);
  const [pickClientForRemboursementOpen, setPickClientForRemboursementOpen] = useState(false);
  const [clientsEgyptModalOpen, setClientsEgyptModalOpen] = useState(false);
  const [expandedEgyptClientId, setExpandedEgyptClientId] = useState<string | null>(null);
  const [urgentModalOpen, setUrgentModalOpen] = useState(false);
  const [prospectsModalOpen, setProspectsModalOpen] = useState(false);
  const [incompleteModalOpen, setIncompleteModalOpen] = useState(false);
  const [pickupsModalOpen, setPickupsModalOpen] = useState(false);
  const [shiftDebut, setShiftDebut] = useState("");
  const [shiftFin, setShiftFin] = useState("");
  const [showActivitesEnAttenteModal, setShowActivitesEnAttenteModal] = useState(false);
  const [showClientsEnAttenteModal, setShowClientsEnAttenteModal] = useState(false);
  const [showPaiementsDuJourModal, setShowPaiementsDuJourModal] = useState(false);

  useEffect(() => {
    (async () => {
      setPlannedShift(null);
      setShift(null);
      setShiftDebut("");
      setShiftFin("");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // En "Aperçu vu par" (Justine/Laura/Sylvie...), on montre l'horaire de
      // CETTE personne, pas celui du vrai compte connecté — sinon le shift
      // du jour ne s'affiche jamais pour personne d'autre que soi-même.
      const targetId = viewAsUserId ?? user.id;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const [{ data: planned }, { data }] = await Promise.all([
        supabase
          .from("planning_shifts")
          .select("*")
          .eq("user_id", targetId)
          .eq("date", todayStr)
          .maybeSingle(),
        supabase.from("user_shifts").select("*").eq("user_id", targetId).maybeSingle(),
      ]);
      if (planned) setPlannedShift(planned as PlanningShift);
      if (data) {
        setShift(data as UserShift);
        setShiftDebut((data as UserShift).shift_debut);
        setShiftFin((data as UserShift).shift_fin);
      }
    })();
  }, [supabase, viewAsUserId]);

  const saveShift = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_shifts")
      .upsert({ user_id: user.id, shift_debut: shiftDebut, shift_fin: shiftFin });
    setShift({ user_id: user.id, shift_debut: shiftDebut, shift_fin: shiftFin, updated_at: "" });
    setEditingShift(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);
  const tomorrowStr = addDays(todayStr, 1);
  const in14Days = addDays(todayStr, 14);

  const clientById = (id: string) => clients.find((c) => c.id === id);

  const incidentsOuverts = incidents.filter((i) => i.statut === "Ouvert");

  const clientsInEgypt = clients.filter(
    (c) => c.date_debut && c.date_fin && c.date_debut <= todayStr && todayStr <= c.date_fin
  );

  const rdvToday = clients.filter((c) => !c.solde_activite_id && c.solde_date === todayStr);
  const { encaisses: paiementsEncaisses, aPayer: paiementsAPayer } = useMemo(
    () =>
      computePaiementsDuJour(
        clients,
        reservations,
        resaOptions,
        resaTarifs,
        paiementsEtapes,
        todayStr,
        onUpdateClient
      ),
    [clients, reservations, resaOptions, resaTarifs, paiementsEtapes, todayStr, onUpdateClient]
  );
  const callsToday = clients
    .filter((c) => c.prochain_appel_date === todayStr)
    .sort((a, b) => a.prochain_appel_heure.localeCompare(b.prochain_appel_heure));

  const pickupsMissingTomorrow = reservationsActives(reservations).filter(
    (r) => r.date_debut === tomorrowStr && !r.pickup_reel
  );

  const clientsArrivingTomorrow = clients.filter((c) => c.date_debut === tomorrowStr);
  const roomsMissingTomorrow = clientsArrivingTomorrow.filter(
    (c) => !c.chambre || c.infos_manquantes.includes("Room number")
  );

  const doublonsNonTraites = clients.filter((c) => c.doublon_possible_id && !c.doublon_traite);

  const billetsEnAttente = reservations
    .filter((r) => r.billet_requis && r.billet_etape !== "termine" && (!r.billet_date || r.billet_date >= todayStr))
    .sort((a, b) => (a.billet_date || "").localeCompare(b.billet_date || ""));

  // Activités pas encore validées (Brouillon) — souvent parce qu'une info
  // requise a été passée à l'ajout (pointure, vol du client…) et jamais
  // complétée depuis, donc facile à oublier sans liste dédiée.
  const activitesEnAttente = reservations
    .filter((r) => r.statut_resa === "Brouillon")
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  // Clients confirmés Kommo renvoyés à quelqu'un (ou pas encore pris en
  // charge) — regroupés ici avec les activités en attente pour ne pas se
  // perdre entre le popup bloquant (NouveauClientConfirmeAlert) et le suivi.
  const clientsEnAttenteConfirmation = clients.filter((c) => c.confirmation_a_traiter);

  const auRevoirToday = clients.filter(
    (c) => c.date_fin && addDays(c.date_fin, 1) === todayStr && !c.au_revoir_envoye
  );
  const avisToday = clients.filter(
    (c) => c.date_fin && addDays(c.date_fin, 7) === todayStr && !c.avis_envoye
  );

  // "À relancer" se base sur le dernier contact réel (dernier_contact_date),
  // pas sur l'ancienneté de la fiche — sinon un prospect qu'on vient de
  // relancer reste marqué "à relancer" jusqu'à ce qu'il réponde. Le délai
  // avant relance dépend de la proximité du séjour : un prospect qui arrive
  // cette semaine se relance vite (2j sans contact), un prospect qui arrive
  // dans plusieurs mois n'a pas besoin d'être harcelé tous les 2 jours.
  const joursAvantArrivee = (dateStr: string) =>
    Math.round((Date.parse(dateStr) - Date.parse(todayStr)) / 86400000);
  const staleProspects = clients.filter((c) => {
    if (!PROSPECT_STATUTS.includes(c.statut)) return false;
    if (!c.date_debut || c.date_debut < todayStr) return false;
    const avant = joursAvantArrivee(c.date_debut);
    const seuilRelance = avant <= 7 ? 2 : avant <= 30 ? 5 : 10;
    return daysSince(c.dernier_contact_date || c.created_at) >= seuilRelance;
  });

  const marquerRelance = (c: Client) => {
    onUpdateClient(c.id, {
      dernier_contact_date: todayStr,
      nb_relances: (c.nb_relances || 0) + 1,
    });
  };

  const incompleteUpcoming = clients.filter(
    (c) =>
      c.statut === "Client confirmé" &&
      c.date_debut &&
      c.date_debut >= todayStr &&
      c.date_debut <= in14Days &&
      infosManquantesToutes(c, reservations).length > 0
  );
  // File prioritaire : un dossier incomplet n'y reste que si l'arrivée est
  // proche (3 jours) — au-delà, il y a encore le temps de le compléter sans
  // que ce soit urgent au quotidien. La carte "Dossiers incomplets" garde
  // elle une fenêtre plus large (14 jours) pour donner une vision d'ensemble.
  const in3Days = addDays(todayStr, 3);
  const incompleteUrgent = clients.filter(
    (c) =>
      c.statut === "Client confirmé" &&
      c.date_debut &&
      c.date_debut >= todayStr &&
      c.date_debut <= in3Days &&
      infosManquantesToutes(c, reservations).length > 0
  );

  // Billet d'avion pas encore reçu (étape avant "reçu — à envoyer au
  // client") alors que le vol est dans 15 jours ou moins.
  const billetsUrgents = reservations.filter(
    (r) =>
      r.billet_requis &&
      r.billet_etape !== "a_envoyer_client" &&
      r.billet_etape !== "termine" &&
      r.billet_date &&
      r.billet_date >= todayStr &&
      r.billet_date <= addDays(todayStr, 15)
  );
  // Acompte non réglé (quel que soit le mode) alors que l'activité est dans
  // 4 jours ou moins.
  const acomptesUrgents = clients.filter(
    (c) =>
      c.paiement_type === "acompte" &&
      c.acompte_valide &&
      !c.acompte_paye &&
      c.date_debut &&
      c.date_debut >= todayStr &&
      c.date_debut <= addDays(todayStr, 4)
  );

  // Les pick-ups manquants ont déjà leur propre métrique dédiée
  // ("Pick-ups manquants") : les compter aussi dans "Cas urgents" faisait
  // doublon, donc ils en sont exclus ici.
  const urgentCount = rdvToday.length + billetsUrgents.length + acomptesUrgents.length;

  // Lignes du popup "coup d'œil rapide" de "Cas urgents" — même union de
  // sources que urgentCount ci-dessus, reformatées en nom + pourquoi +
  // action.
  const urgentRows = [
    ...rdvToday.map((c) => ({
      key: `rdv-${c.id}`,
      name: c.nom || "Sans nom",
      reason: "RDV de paiement du solde aujourd'hui",
      actionLabel: "Voir la fiche",
      onAction: () => {
        setUrgentModalOpen(false);
        onOpenClient(c.id);
      },
    })),
    ...billetsUrgents.map((r) => {
      const c = clientById(r.client_id);
      return {
        key: `billet-${r.id}`,
        name: c?.nom || "Sans nom",
        reason: `Billet d'avion pas encore reçu — vol le ${fmtDate(r.billet_date)}`,
        actionLabel: "Voir la fiche",
        onAction: () => {
          setUrgentModalOpen(false);
          if (c) onOpenClient(c.id);
        },
      };
    }),
    ...acomptesUrgents.map((c) => ({
      key: `acompte-${c.id}`,
      name: c.nom || "Sans nom",
      reason: `Acompte non réglé — arrivée le ${fmtDate(c.date_debut)}`,
      actionLabel: "Voir la fiche",
      onAction: () => {
        setUrgentModalOpen(false);
        onOpenClient(c.id);
      },
    })),
  ];

  const prospectRows = staleProspects.map((c) => ({
    key: c.id,
    name: c.nom || "Sans nom",
    reason: c.dernier_contact_date
      ? `Dernier contact il y a ${daysSince(c.dernier_contact_date)} j — arrivée le ${fmtDate(c.date_debut)}`
      : `Jamais recontacté depuis la création — arrivée le ${fmtDate(c.date_debut)}`,
    actionLabel: "Marquer comme relancé",
    onAction: () => marquerRelance(c),
  }));

  const incompleteRows = incompleteUpcoming.map((c) => ({
    key: c.id,
    name: c.nom || "Sans nom",
    reason: `Manque : ${infosManquantesToutes(c, reservations).join(", ")}`,
    actionLabel: "Compléter la fiche",
    onAction: () => {
      setIncompleteModalOpen(false);
      onOpenClient(c.id);
    },
  }));

  const pickupRows = pickupsMissingTomorrow.map((r) => {
    const c = clientById(r.client_id);
    return {
      key: r.id,
      name: c?.nom || "Sans nom",
      reason: `${cleanActivityTitle(r.nom_activite) || "Activité"} — demain ${fmtDate(r.date_debut)}`,
      actionLabel: "Renseigner le pick-up",
      onAction: () => {
        setPickupsModalOpen(false);
        if (c) onOpenClient(c.id);
      },
    };
  });

  // Total toutes rubriques "Actions rapides" confondues — affiché en cloche
  // en haut de la section pour voir d'un coup d'œil s'il y a quelque chose à
  // traiter, sans avoir à dérouler toute la liste.
  const actionsRapidesTotal =
    incidentsOuverts.length +
    callsToday.length +
    roomsMissingTomorrow.length +
    pickupsMissingTomorrow.length +
    rdvToday.length +
    billetsEnAttente.length +
    activitesEnAttente.length +
    paiementsAPayer.length +
    auRevoirToday.length +
    avisToday.length +
    staleProspects.length;

  // -- Priority queue: every client needing attention soon, ranked by departure date.
  type QueueRow = { client: Client; motifs: string[] };
  const queueMap = new Map<string, QueueRow>();
  const addToQueue = (c: Client, motif: string) => {
    const existing = queueMap.get(c.id);
    if (existing) existing.motifs.push(motif);
    else queueMap.set(c.id, { client: c, motifs: [motif] });
  };
  // Affiche directement pourquoi le dossier est incomplet (une pastille par
  // info manquante) plutôt qu'un motif générique "Dossier incomplet".
  incompleteUrgent.forEach((c) => {
    infosManquantesToutes(c, reservations).forEach((motif) => addToQueue(c, motif));
  });
  staleProspects.forEach((c) => addToQueue(c, "À relancer"));
  rdvToday.forEach((c) => addToQueue(c, "RDV paiement"));
  const priorityQueue = Array.from(queueMap.values()).sort((a, b) =>
    (a.client.date_debut || "9999").localeCompare(b.client.date_debut || "9999")
  );

  const byStatut: Record<string, number> = {};
  clients.forEach((c) => {
    byStatut[c.statut] = (byStatut[c.statut] || 0) + 1;
  });

  const caTotal = isDirection
    ? reservations
        .filter((r) => r.statut_resa !== "Annulée")
        .reduce(
        (s, r) =>
          s +
          resaTotalMontant(
            r,
            clientById(r.client_id) as Client,
            resaOptions[r.id] || [],
            resaTarifs[r.id] || []
          ),
        0
      )
    : 0;

  const firstName = displayFirstName || firstNameFromEmail(userEmail);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[26px] font-semibold text-[#171717]">
            Bonjour {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[#666666]">
            {today.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {!isDirection && <span className="mx-2 text-[#eaeaea]">·</span>}
            {isDirection ? null : plannedShift ? (
              <span className="text-[#666666]">
                {plannedShift.statut === "conge"
                  ? "Congé aujourd'hui"
                  : plannedShift.statut === "repos"
                    ? "OFF aujourd'hui"
                    : plannedShift.statut === "superviseur"
                      ? "Superviseur aujourd'hui"
                      : `Shift aujourd'hui : ${plannedShift.shift_debut} – ${plannedShift.shift_fin}`}
              </span>
            ) : editingShift ? (
              <span className="inline-flex items-center gap-1.5">
                <input
                  type="time"
                  value={shiftDebut}
                  onChange={(e) => setShiftDebut(e.target.value)}
                  className="rounded-[6px] border border-[#eaeaea] px-1.5 py-0.5 text-xs"
                />
                <span className="text-[#666666]">–</span>
                <input
                  type="time"
                  value={shiftFin}
                  onChange={(e) => setShiftFin(e.target.value)}
                  className="rounded-[6px] border border-[#eaeaea] px-1.5 py-0.5 text-xs"
                />
                <button
                  onClick={saveShift}
                  className="ml-1 rounded-[6px] bg-[#171717] px-2.5 py-0.5 text-xs font-medium text-white"
                >
                  OK
                </button>
              </span>
            ) : (
              <button
                onClick={() => setEditingShift(true)}
                className="text-[#0070f3] underline decoration-dotted underline-offset-2"
              >
                {shift && shift.shift_debut && shift.shift_fin
                  ? `Shift aujourd'hui : ${shift.shift_debut} – ${shift.shift_fin}`
                  : "Ajouter ton shift du jour"}
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <QuickAddClient
            onCreate={onCreateClient}
            onUpdateClient={onUpdateClient}
            clients={clients}
            onDeleteClient={onDeleteClient}
            onOpenClient={onOpenClient}
            defaultStatut="Client confirmé"
          />
          <button
            onClick={() => setPickClientForActivityOpen(true)}
            className="whitespace-nowrap rounded-[6px] border border-[#171717] px-3 py-1.5 text-sm font-medium text-[#171717] hover:bg-[#171717]/5"
          >
            + Nouvelle activité
          </button>
          <button
            onClick={() => setPickClientForCancelOpen(true)}
            className="whitespace-nowrap rounded-[6px] border border-red-600 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Annuler une activité
          </button>
          <button
            onClick={() => setPickClientForRemboursementOpen(true)}
            className="whitespace-nowrap rounded-[6px] border border-[#0F5C56] px-3 py-1.5 text-sm font-medium text-[#0F5C56] hover:bg-[#0F5C56]/5"
          >
            + Remboursement / avoir
          </button>
          <button
            onClick={onOpenRemboursements}
            className="whitespace-nowrap rounded-[6px] border border-[#C9973E] px-3 py-1.5 text-sm font-medium text-[#8B4531] hover:bg-[#C9973E]/5"
          >
            Voir les remboursements
          </button>
        </div>
      </div>

      {pickClientForActivityOpen && (
        <PickClientModal
          clients={clients}
          title="Ajouter une activité à un client existant"
          onSelect={(clientId) => {
            setPickClientForActivityOpen(false);
            onOpenClientForNewActivity(clientId);
          }}
          onClose={() => setPickClientForActivityOpen(false)}
        />
      )}

      {pickClientForCancelOpen && (
        <PickClientModal
          clients={clients}
          title="Annuler une activité de quel client ?"
          onSelect={(clientId) => {
            setPickClientForCancelOpen(false);
            onOpenClientForCancelActivity(clientId);
          }}
          onClose={() => setPickClientForCancelOpen(false)}
        />
      )}

      {pickClientForRemboursementOpen && (
        <PickClientModal
          clients={clients}
          title="Ajouter un remboursement/avoir à quel client ?"
          onSelect={(clientId) => {
            setPickClientForRemboursementOpen(false);
            onOpenClientForRemboursement(clientId);
          }}
          onClose={() => setPickClientForRemboursementOpen(false)}
        />
      )}

      {clientsEgyptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setClientsEgyptModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-base font-semibold text-[#171717]">
                Clients en Égypte ({clientsInEgypt.length})
              </h2>
              <button
                type="button"
                onClick={() => setClientsEgyptModalOpen(false)}
                className="text-neutral-400 hover:text-[#171717]"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              {[...clientsInEgypt]
                .sort((a, b) => (a.date_fin || "").localeCompare(b.date_fin || ""))
                .map((c) => {
                  const activitesClient = reservations.filter(
                    (r) => r.client_id === c.id && r.statut_resa !== "Annulée"
                  );
                  const nbActivites = activitesClient.length;
                  const expanded = expandedEgyptClientId === c.id;
                  return (
                    <div key={c.id} className="rounded-md border border-neutral-100 hover:border-[#C9973E]">
                      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setClientsEgyptModalOpen(false);
                            onOpenClient(c.id);
                          }}
                          className="min-w-0 flex-1 text-left hover:underline"
                        >
                          <span className="font-medium text-[#171717]">{c.nom || "Sans nom"}</span>
                          <span className="ml-2 text-xs text-neutral-500">
                            {fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}
                          </span>
                          <span className="block text-xs text-neutral-500">{paxSummary(c)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedEgyptClientId(expanded ? null : c.id)}
                          className="shrink-0 rounded-full bg-[#0F5C56]/10 px-2 py-0.5 text-xs font-medium text-[#0F5C56] hover:bg-[#0F5C56]/20"
                        >
                          {nbActivites} activité{nbActivites > 1 ? "s" : ""} {expanded ? "▲" : "▼"}
                        </button>
                      </div>
                      {expanded && (
                        <div className="border-t border-neutral-100 px-3 py-2">
                          {nbActivites === 0 ? (
                            <p className="text-xs text-neutral-500">Aucune activité réservée.</p>
                          ) : (
                            <ul className="space-y-1">
                              {activitesClient.map((r) => (
                                <li key={r.id} className="text-xs text-neutral-600">
                                  <span className="font-medium text-[#171717]">
                                    {cleanActivityTitle(r.nom_activite) || "Activité"}
                                  </span>{" "}
                                  — {fmtDate(r.date_debut)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {urgentModalOpen && (
        <InfoListModal title="Cas urgents" rows={urgentRows} onClose={() => setUrgentModalOpen(false)} />
      )}
      {prospectsModalOpen && (
        <InfoListModal
          title="Prospects à relancer"
          rows={prospectRows}
          onClose={() => setProspectsModalOpen(false)}
        />
      )}
      {incompleteModalOpen && (
        <InfoListModal
          title="Dossiers incomplets"
          rows={incompleteRows}
          onClose={() => setIncompleteModalOpen(false)}
        />
      )}
      {pickupsModalOpen && (
        <InfoListModal
          title="Pick-ups manquants"
          rows={pickupRows}
          onClose={() => setPickupsModalOpen(false)}
        />
      )}

      {showTeamShiftsToday && (
        <div className="rounded-[10px] border border-[#eaeaea] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Qui travaille aujourd&apos;hui
          </div>
          {(() => {
            const todaysShifts = teamPlanningShifts
              .filter((s) => s.date === todayStr && (s.statut === "travail" || s.statut === "superviseur"))
              .map((s) => ({
                shift: s,
                profile: teamProfiles.find((p) => p.id === s.user_id),
              }))
              .filter((x) => x.profile)
              .sort((a, b) => a.shift.shift_debut.localeCompare(b.shift.shift_debut));
            if (!todaysShifts.length) {
              return <p className="text-sm text-[#666666]">Aucun shift renseigné pour aujourd&apos;hui.</p>;
            }
            return (
              <ul className="space-y-1 text-sm">
                {todaysShifts.map(({ shift, profile }) => (
                  <li key={shift.id} className="flex items-center gap-2 text-[#171717]">
                    <span className="font-medium">{profile!.prenom || profile!.email}</span>
                    <span className="text-[#666666]">
                      {shift.statut === "superviseur"
                        ? "Superviseur"
                        : `${shift.shift_debut} – ${shift.shift_fin}`}
                    </span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}

      <div className="flex">
        <Metric
          first
          label="Clients en Égypte"
          value={String(clientsInEgypt.length)}
          tone="default"
          onClick={clientsInEgypt.length > 0 ? () => setClientsEgyptModalOpen(true) : undefined}
        />
        <Metric
          label="Cas urgents"
          value={String(urgentCount)}
          sub={urgentCount > 0 ? "à traiter" : "rien pour l'instant"}
          tone={urgentCount > 0 ? "error" : "default"}
          onClick={urgentCount > 0 ? () => setUrgentModalOpen(true) : undefined}
        />
        <Metric
          label="Prospects à relancer"
          value={String(staleProspects.length)}
          sub="arrivée < 14 j"
          tone="default"
          onClick={staleProspects.length > 0 ? () => setProspectsModalOpen(true) : undefined}
        />
        <Metric
          label="Dossiers incomplets"
          value={String(incompleteUpcoming.length)}
          sub="arrivée < 14 j"
          tone="default"
          onClick={incompleteUpcoming.length > 0 ? () => setIncompleteModalOpen(true) : undefined}
        />
        <Metric
          label="Pick-ups manquants"
          value={String(pickupsMissingTomorrow.length)}
          sub="demain"
          tone="default"
          onClick={pickupsMissingTomorrow.length > 0 ? () => setPickupsModalOpen(true) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-[#171717]">
              File d&apos;attente prioritaire
            </h2>
            <span className="font-amounts text-xs font-medium text-[#666666]">
              {priorityQueue.length +
                (paypalPaiementsNonRattaches > 0 ? 1 : 0) +
                (doublonsNonTraites.length > 0 ? 1 : 0)}{" "}
              dossier(s)
            </span>
          </div>
          <div
            className={
              priorityQueue.length === 0 &&
              paypalPaiementsNonRattaches === 0 &&
              doublonsNonTraites.length === 0
                ? "py-10 text-center text-sm text-[#666666]"
                : "overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white"
            }
          >
            {priorityQueue.length === 0 &&
            paypalPaiementsNonRattaches === 0 &&
            doublonsNonTraites.length === 0 ? (
              "Rien de prioritaire pour l'instant."
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[#666666]">
                    <th className="px-5 pb-3 pt-5 font-medium">Client</th>
                    <th className="px-3 pb-3 pt-5 font-medium">Arrivée</th>
                    <th className="px-3 pb-3 pt-5 font-medium">Motif</th>
                    <th className="px-5 pb-3 pt-5" />
                  </tr>
                </thead>
                <tbody>
                  {doublonsNonTraites.length > 0 && (
                    <tr
                      onClick={() => onOpenClient(doublonsNonTraites[0].id)}
                      className="cursor-pointer border-t border-[#eaeaea] hover:bg-[#fafafa]"
                    >
                      <td className="px-5 py-3" colSpan={2}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#171717] text-base text-white">
                            ⚠
                          </div>
                          <p className="font-medium text-[#171717]">
                            {doublonsNonTraites.length} doublon{doublonsNonTraites.length > 1 ? "s" : ""}{" "}
                            probable{doublonsNonTraites.length > 1 ? "s" : ""} à vérifier
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="whitespace-nowrap rounded-[4px] border border-[#eaeaea] bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#171717]">
                            Doublon
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3" />
                    </tr>
                  )}
                  {paypalPaiementsNonRattaches > 0 && (
                    <tr
                      onClick={onOpenPaypalPaiements}
                      className="cursor-pointer border-t border-[#eaeaea] hover:bg-[#fafafa]"
                    >
                      <td className="px-5 py-3" colSpan={2}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#171717] text-base text-white">
                            💰
                          </div>
                          <p className="font-medium text-[#171717]">
                            {paypalPaiementsNonRattaches} paiement{paypalPaiementsNonRattaches > 1 ? "s" : ""}{" "}
                            PayPal à rattacher
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="whitespace-nowrap rounded-[4px] border border-[#eaeaea] bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#171717]">
                            PayPal
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3" />
                    </tr>
                  )}
                  {priorityQueue.slice(0, 10).map(({ client, motifs }) => (
                    <tr
                      key={client.id}
                      onClick={() =>
                        motifs.includes("RDV paiement")
                          ? onOpenRdvPaiements()
                          : onOpenClient(client.id)
                      }
                      className="cursor-pointer border-t border-[#eaeaea] hover:bg-[#fafafa]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.nom || "Sans nom"} />
                          <div>
                            <p className="font-medium text-[#171717]">
                              {client.nom || "Sans nom"}
                            </p>
                            <p
                              className="text-[11px] font-medium"
                              style={{ color: STATUT_COLORS[client.statut] }}
                            >
                              {client.statut}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="font-amounts px-3 py-3 text-[#666666]">
                        {fmtDate(client.date_debut)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {motifs.map((m) => (
                            <span
                              key={m}
                              className="whitespace-nowrap rounded-[4px] border border-[#eaeaea] bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#171717]"
                            >
                              {m}
                              {m === "À relancer" && client.nb_relances > 0
                                ? ` (${client.nb_relances})`
                                : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {motifs.includes("À relancer") ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              marquerRelance(client);
                            }}
                            className="whitespace-nowrap rounded-[6px] bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                          >
                            Relancé aujourd&apos;hui
                          </button>
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[#666666]">
                            ›
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {priorityQueue.length > 0 && (
            <div className="flex items-center justify-between rounded-[6px] border border-[#eaeaea] bg-[#fafafa] px-5 py-4 text-sm text-[#171717]">
              <span>
                {priorityQueue.length} dossier(s) à traiter — commence par les arrivées les plus
                proches.
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-[#171717]">Actions rapides</h2>
              {actionsRapidesTotal > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  🔔 {actionsRapidesTotal}
                </span>
              )}
            </div>
            <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              {incidentsOuverts.length > 0 && (
                <ActionRow
                  icon="alert"
                  title="Incidents ouverts"
                  sub={incidentsOuverts
                    .slice(0, 3)
                    .map((i) => `${clients.find((cl) => cl.id === i.client_id)?.nom || "?"} — ${i.titre}`)
                    .join(" · ") + (incidentsOuverts.length > 3 ? "…" : "")}
                  count={incidentsOuverts.length}
                  onClick={onOpenIncidents}
                />
              )}
              {callsToday.map((c) => (
                <ActionRow
                  key={"call-" + c.id}
                  icon="phone"
                  title={`Appel à ${c.prochain_appel_heure || "?"}`}
                  sub={c.nom || "Sans nom"}
                  onClick={() => onOpenClient(c.id)}
                />
              ))}
              <ActionRow
                icon="key"
                title="Numéros de chambre manquants"
                sub={
                  roomsMissingTomorrow.length > 0
                    ? `${roomsMissingTomorrow.length} client(s) arrivant demain`
                    : "Rien à demander"
                }
                count={roomsMissingTomorrow.length}
                onClick={roomsMissingTomorrow.length > 0 ? onOpenNumerosChambre : undefined}
              />
              <ActionRow
                icon="car"
                title="Pick-ups à ajouter"
                sub={
                  pickupsMissingTomorrow.length > 0
                    ? `${pickupsMissingTomorrow.length} activité(s) demain`
                    : "Rien à ajouter"
                }
                count={pickupsMissingTomorrow.length}
                onClick={pickupsMissingTomorrow.length > 0 ? onOpenPickupsChambres : undefined}
              />
              <ActionRow
                icon="wallet"
                title="RDV paiements aujourd'hui"
                sub={rdvToday.length > 0 ? `${rdvToday.length} rendez-vous` : "Aucun aujourd'hui"}
                count={rdvToday.length}
                onClick={rdvToday.length > 0 ? onOpenRdvPaiements : undefined}
              />
              <ActionRow
                icon="plane"
                title="Billets d'avion en attente"
                sub={
                  billetsEnAttente.length > 0
                    ? billetsEnAttente
                        .slice(0, 3)
                        .map((r) => {
                          const c = clients.find((cl) => cl.id === r.client_id);
                          return `${c?.nom || "?"} — ${fmtDate(r.billet_date)}`;
                        })
                        .join(" · ") + (billetsEnAttente.length > 3 ? "…" : "")
                    : "Aucun en attente"
                }
                count={billetsEnAttente.length}
                onClick={billetsEnAttente.length > 0 ? onOpenBilletsAvion : undefined}
              />
              <ActionRow
                icon="clipboard"
                title="Activités en attente de validation"
                sub={
                  activitesEnAttente.length > 0
                    ? activitesEnAttente
                        .slice(0, 3)
                        .map((r) => {
                          const c = clients.find((cl) => cl.id === r.client_id);
                          return `${c?.nom || "?"} — ${cleanActivityTitle(r.nom_activite) || "Activité"}`;
                        })
                        .join(" · ") + (activitesEnAttente.length > 3 ? "…" : "")
                    : "Rien en attente"
                }
                count={activitesEnAttente.length}
                onClick={
                  activitesEnAttente.length > 0 ? () => setShowActivitesEnAttenteModal(true) : undefined
                }
              />
              <ActionRow
                icon="clipboard"
                title="Clients confirmés en attente"
                sub={
                  clientsEnAttenteConfirmation.length > 0
                    ? clientsEnAttenteConfirmation
                        .slice(0, 3)
                        .map((c) => c.nom || "Sans nom")
                        .join(" · ") + (clientsEnAttenteConfirmation.length > 3 ? "…" : "")
                    : "Rien en attente"
                }
                count={clientsEnAttenteConfirmation.length}
                onClick={
                  clientsEnAttenteConfirmation.length > 0 ? () => setShowClientsEnAttenteModal(true) : undefined
                }
              />
              <ActionRow
                icon="check"
                title="Paiements du jour"
                sub={
                  paiementsAPayer.length > 0
                    ? `${paiementsAPayer.length} à payer aujourd'hui`
                    : "Rien en attente"
                }
                count={paiementsAPayer.length}
                onClick={() => setShowPaiementsDuJourModal(true)}
              />
              <ActionRow
                icon="wave"
                title="Messages au revoir"
                sub={auRevoirToday.length > 0 ? `${auRevoirToday.length} à envoyer` : "Rien à envoyer"}
                count={auRevoirToday.length}
                onClick={auRevoirToday.length > 0 ? onOpenAuRevoir : undefined}
              />
              <ActionRow
                icon="star"
                title="Demandes d'avis"
                sub={avisToday.length > 0 ? `${avisToday.length} à envoyer` : "Rien à envoyer"}
                count={avisToday.length}
                onClick={avisToday.length > 0 ? onOpenAvisClients : undefined}
              />
              <ActionRow
                icon="refresh"
                title="Relances prospects"
                sub={
                  staleProspects.length > 0 ? `${staleProspects.length} à relancer` : "Rien à relancer"
                }
                count={staleProspects.length}
                onClick={staleProspects.length > 0 ? onOpenProspectsARelancer : undefined}
              />
            </div>
          </div>

          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
              Répartition par statut
            </h2>
            <DonutChart
              centerLabel="clients"
              data={STATUTS.map((s) => ({
                label: s,
                value: byStatut[s] || 0,
                color: STATUT_COLORS[s],
              }))}
            />
          </div>

          {isDirection && (
            <div>
              <p className="text-[11px] font-medium text-[#666666]">CA (activités)</p>
              <p className="font-amounts mt-1.5 text-[28px] font-bold leading-none text-[#171717]">
                {euros(caTotal)} €
              </p>
            </div>
          )}
        </div>
      </div>

      {showActivitesEnAttenteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowActivitesEnAttenteModal(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="font-heading text-base font-semibold text-[#171717]">
                Activités en attente de validation
              </h3>
              <button
                type="button"
                onClick={() => setShowActivitesEnAttenteModal(false)}
                className="text-neutral-400 hover:text-[#171717]"
              >
                ✕
              </button>
            </div>
            <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea]">
              {activitesEnAttente.map((r) => {
                const c = clients.find((cl) => cl.id === r.client_id);
                const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
                const missing = missingChampsFor(r, catalogueItem);
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setShowActivitesEnAttenteModal(false);
                      onOpenClient(r.client_id);
                    }}
                    className="cursor-pointer px-4 py-3 hover:bg-[#fafafa]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#171717]">{c?.nom || "Sans nom"}</p>
                      <span className="whitespace-nowrap text-xs text-[#666666]">
                        {r.date_debut ? fmtDate(r.date_debut) : "Date ?"}
                      </span>
                    </div>
                    <p className="text-xs text-[#666666]">{cleanActivityTitle(r.nom_activite) || "Activité"}</p>
                    {missing.length > 0 && (
                      <p className="mt-0.5 text-xs text-red-600">Manque : {missing.join(", ")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showClientsEnAttenteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowClientsEnAttenteModal(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="font-heading text-base font-semibold text-[#171717]">
                Clients confirmés en attente
              </h3>
              <button
                type="button"
                onClick={() => setShowClientsEnAttenteModal(false)}
                className="text-neutral-400 hover:text-[#171717]"
              >
                ✕
              </button>
            </div>
            <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea]">
              {clientsEnAttenteConfirmation.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setShowClientsEnAttenteModal(false);
                    onOpenClient(c.id);
                  }}
                  className="cursor-pointer px-4 py-3 hover:bg-[#fafafa]"
                >
                  <p className="text-sm font-medium text-[#171717]">{c.nom || "Sans nom"}</p>
                  <p className="text-xs text-[#666666]">
                    {c.confirmation_assignee_a
                      ? `Renvoyé à ${c.confirmation_assignee_a}`
                      : "Pas encore pris en charge"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPaiementsDuJourModal && (
        <PaiementsDuJourModal
          encaisses={paiementsEncaisses}
          aPayer={paiementsAPayer}
          onOpenClient={(id) => {
            setShowPaiementsDuJourModal(false);
            onOpenClient(id);
          }}
          onClose={() => setShowPaiementsDuJourModal(false)}
        />
      )}
    </div>
  );
}
