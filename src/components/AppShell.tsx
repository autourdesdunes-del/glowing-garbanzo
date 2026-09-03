"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AssouanVerification,
  BusEscalation,
  CatalogueFaq,
  CatalogueItem,
  CatalogueJour,
  CatalogueModificationRequest,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  EMPTY_CLIENT,
  Incident,
  JourEscalation,
  PaiementEtape,
  Pack,
  PaypalPaiement,
  PlanningShift,
  Profile,
  Remboursement,
  RemarqueEmployee,
  KommoReponseEmploye,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxeModificationRequest,
  Verification,
} from "@/lib/types";
import { resaTotalMontant, sharedActivityAlerts, SharedActivityAlert } from "@/lib/resa";
import { localDateStr } from "@/lib/dates";
import { CLIENT_STATUTS, PROSPECT_STATUTS, STATUT_COLORS } from "@/lib/constants";
import ClientDetail from "@/components/ClientDetail";
import DashboardView from "@/components/DashboardView";
import GlobalSearch from "@/components/GlobalSearch";
import PipelineView from "@/components/PipelineView";
import ProspectSummaryModal from "@/components/ProspectSummaryModal";
import ChangePasswordButton from "@/components/ChangePasswordButton";
import QuickAddClient from "@/components/QuickAddClient";
import CatalogueView from "@/components/CatalogueView";
import PacksAdminView from "@/components/PacksAdminView";
import PlanningView from "@/components/PlanningView";
import RecapMoisView from "@/components/RecapMoisView";
import SuivisView, { SUIVIS_SUBS, SuivisSub } from "@/components/SuivisView";
import ClientPreviewView from "@/components/ClientPreviewView";
import DirectionView, { DIRECTION_SUBS, DirectionSub } from "@/components/DirectionView";
import ManagerView from "@/components/ManagerView";
import HelpView from "@/components/HelpView";
import PlanningRHView from "@/components/PlanningRHView";
import GeneratorView from "@/components/GeneratorView";
import ConfirmProvider, { useConfirm } from "@/components/ConfirmProvider";
import ToastProvider, { useToast } from "@/components/ToastProvider";
import Spinner from "@/components/Spinner";
import AppelReminders from "@/components/AppelReminders";
import BilletRappels from "@/components/BilletRappels";
import BilletEnvoiRappels from "@/components/BilletEnvoiRappels";
import PaypalPaiementRappel from "@/components/PaypalPaiementRappel";
import AnnulationHossamAlert from "@/components/AnnulationHossamAlert";
import DoublonPossibleAlert from "@/components/DoublonPossibleAlert";
import NouveauClientConfirmeAlert from "@/components/NouveauClientConfirmeAlert";
import BusEscalationCenter from "@/components/BusEscalationCenter";
import JourEscalationCenter from "@/components/JourEscalationCenter";
import AssouanVerificationCenter from "@/components/AssouanVerificationCenter";
import RemarqueEmployeeCenter from "@/components/RemarqueEmployeeCenter";
import PersonalNudgeAlert from "@/components/PersonalNudgeAlert";

type Mode =
  | "dashboard"
  | "team"
  | "prospects"
  | "catalogue"
  | "suivis"
  | "planning"
  | "preview"
  | "help"
  | "direction"
  | "manager"
  | "rh"
  | "generateur"
  | "recap";

// Mis en pause le 31/08/2026 à la demande de Mélanie — remettre à true pour
// réactiver. Le composant et son câblage restent intacts, juste pas monté.
const NOUVEAU_CLIENT_CONFIRME_ALERT_ACTIVE = false;

// Sous-menu "Prospects" dans la sidebar (même principe que Suivis) : une
// entrée par étape de la pipeline Kommo, plus "Toutes les étapes" (vue
// kanban complète) et "Client perdu" pour surveiller les pertes.
// Traduction arabe des deux entrées fixes seulement — les étapes de la
// pipeline Kommo (PROSPECT_STATUTS) sont des libellés métier arbitraires
// définis côté Kommo, pas traduits ici pour ne pas introduire un décalage
// avec le vrai nom de l'étape.
const PROSPECTS_SUBS_AR: Record<string, string> = {
  toutes: "كل المراحل",
  "Client perdu": "عميل مفقود",
};
const PROSPECTS_SUBS = [
  { key: "toutes", label: "Toutes les étapes" },
  ...PROSPECT_STATUTS.map((s) => ({ key: s, label: s })),
  { key: "Client perdu", label: "Client perdu" },
] as const;
type ProspectsSub = (typeof PROSPECTS_SUBS)[number]["key"];

const MANAGER_SUBS = [
  { key: "attente", label: "En attente" },
  { key: "equipe", label: "Gestion équipe" },
  { key: "suivi", label: "Suivi clients" },
  { key: "stats", label: "Statistiques" },
] as const;
type ManagerSub = (typeof MANAGER_SUBS)[number]["key"];


// Générateur de programme et Aperçu client sont encore en construction —
// réservés à la Direction pour l'instant, l'équipe voit ce message à la
// place tant que ce n'est pas prêt. Basé sur effectiveIsDirection (donc
// respecte le sélecteur "Aperçu vu par") : sur "La mienne", la Direction
// garde accès à tout ; sur "Vue équipe"/"Vue manager"/"Vue Bode", ce
// message s'affiche comme pour un vrai compte équipe.
function OutilEnConstruction() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-neutral-400">
      <p>Bientôt disponible.</p>
      <p>Cet outil est en cours de construction.</p>
    </div>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 9.5 10 3l7 6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V17h10V8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" />
      <path d="M13 11.9c1.9.3 4.5 1.6 4.5 4.1" strokeLinecap="round" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 5.5C8.7 4.5 6.5 4 3.5 4v11c3 0 5.2.5 6.5 1.5V5.5Z" strokeLinejoin="round" />
      <path d="M10 5.5C11.3 4.5 13.5 4 16.5 4v11c-3 0-5.2.5-6.5 1.5V5.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconChecklist() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 5.5 4.3 6.8 7 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 5.2h7" strokeLinecap="round" />
      <path d="M3 11.5 4.3 12.8 7 10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 11.2h7" strokeLinecap="round" />
      <path d="M3.3 17h13.4" strokeLinecap="round" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M3 8h14" />
      <path d="M6.5 3v3M13.5 3v3" strokeLinecap="round" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M2 10c1.8-3.3 4.8-5 8-5s6.2 1.7 8 5c-1.8 3.3-4.8 5-8 5s-6.2-1.7-8-5Z" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 2.5 16 5v5c0 4-2.6 6.5-6 7.5-3.4-1-6-3.5-6-7.5V5l6-2.5Z" strokeLinejoin="round" />
      <path d="M7.3 9.7 9 11.4 12.7 7.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <rect x="4.5" y="4" width="11" height="13" rx="1.5" />
      <path d="M7.5 3.5h5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 7 5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M7.3 10.5h5.4M7.3 13.5h5.4" strokeLinecap="round" />
    </svg>
  );
}
function IconSparkles() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M10 3.5 11.3 7.5 15.3 8.8 11.3 10.1 10 14.1 8.7 10.1 4.7 8.8 8.7 7.5 10 3.5Z" strokeLinejoin="round" />
      <path d="M15.5 13.5 16.1 15.1 17.7 15.7 16.1 16.3 15.5 17.9 14.9 16.3 13.3 15.7 14.9 15.1 15.5 13.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconHelp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.8 7.8c.3-1 1.1-1.6 2.2-1.6 1.2 0 2.2.8 2.2 1.9 0 1.6-2.2 1.5-2.2 3.2" strokeLinecap="round" />
      <circle cx="10" cy="13.8" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path
        d="M10 2.8 12.3 7.6 17.5 8.4 13.8 12 14.7 17.2 10 14.7 5.3 17.2 6.2 12 2.5 8.4 7.7 7.6 10 2.8Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3.5 16.5v-6M9 16.5V6M14.5 16.5v-9" strokeLinecap="round" />
      <path d="M2.5 16.5h15" strokeLinecap="round" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
    </svg>
  );
}

const PLANNING_SUBS = [
  { key: "aujourdhui", label: "Aujourd'hui", labelAr: "اليوم" },
  { key: "demain", label: "Demain", labelAr: "غدًا" },
  { key: "calendrier", label: "Calendrier", labelAr: "التقويم" },
  { key: "par_activite", label: "Calendrier par activité", labelAr: "التقويم حسب النشاط" },
] as const;
type PlanningSub = (typeof PLANNING_SUBS)[number]["key"];

const HELP_SUBS = [
  { key: "hotels", label: "Localisation des hôtels", labelAr: "مواقع الفنادق" },
  { key: "taxes", label: "Taxes de transfert", labelAr: "رسوم النقل" },
  { key: "promos", label: "Codes promo", labelAr: "أكواد الخصم" },
] as const;
type HelpSub = (typeof HELP_SUBS)[number]["key"];

// labelAr : traduction arabe affichée en plus (petit, sous/à côté du
// libellé français) pour l'équipe Égypte (Hossam, Bodé) — voir
// `arabicMode` plus bas, dérivé de leur nav_masque.
const TABS: { key: Mode; label: string; labelAr: string; icon: () => React.ReactElement }[] = [
  { key: "dashboard", label: "Tableau de bord", labelAr: "لوحة التحكم", icon: IconHome },
  { key: "team", label: "Clients", labelAr: "العملاء", icon: IconUsers },
  { key: "prospects", label: "Prospects", labelAr: "العملاء المحتملون", icon: IconTarget },
  { key: "catalogue", label: "Catalogue", labelAr: "الكتالوج", icon: IconBook },
  { key: "suivis", label: "Suivis", labelAr: "المتابعات", icon: IconChecklist },
  { key: "planning", label: "Réservations", labelAr: "الحجوزات", icon: IconCalendar },
  { key: "recap", label: "Récap du mois", labelAr: "ملخص الشهر", icon: IconChart },
  { key: "rh", label: "Planning équipe", labelAr: "جدول الفريق", icon: IconClipboard },
  { key: "generateur", label: "Générateur de programme", labelAr: "منشئ البرنامج", icon: IconSparkles },
  { key: "preview", label: "Aperçu client", labelAr: "معاينة العميل", icon: IconEye },
  { key: "help", label: "HELP", labelAr: "مساعدة", icon: IconHelp },
  { key: "direction", label: "Direction", labelAr: "الإدارة", icon: IconShield },
  { key: "manager", label: "Manager", labelAr: "المدير", icon: IconStar },
];

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Même seuil que "Relances prospects" (DashboardView.tsx) — dupliqué ici
// (pas exporté) pour la cloche Manager, qui a besoin du total même sans
// jamais avoir ouvert le tableau de bord.
function daysSinceNav(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function prospectStagnantNav(c: Client) {
  if (!PROSPECT_STATUTS.includes(c.statut)) return false;
  const todayStrNav = localDateStr(new Date());
  if (!c.date_debut || c.date_debut < todayStrNav) return false;
  const avant = Math.round((Date.parse(c.date_debut) - Date.parse(todayStrNav)) / 86400000);
  const seuilRelance = avant <= 7 ? 2 : avant <= 30 ? 5 : 10;
  return daysSinceNav(c.dernier_contact_date || c.created_at) >= seuilRelance;
}

export default function AppShell({
  userEmail,
  userId,
  role,
  prenom,
  navMasque,
  suivisVisibles,
}: {
  userEmail: string;
  userId: string;
  role: "direction" | "equipe";
  prenom: string;
  navMasque: string[];
  suivisVisibles: string[] | null;
}) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShellInner
          userEmail={userEmail}
          userId={userId}
          role={role}
          prenom={prenom}
          navMasque={navMasque}
          suivisVisibles={suivisVisibles}
        />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppShellInner({
  userEmail,
  userId,
  role,
  prenom,
  navMasque,
  suivisVisibles,
}: {
  userEmail: string;
  userId: string;
  role: "direction" | "equipe";
  prenom: string;
  navMasque: string[];
  suivisVisibles: string[] | null;
}) {
  const isDirection = role === "direction";
  // La rubrique Manager (activités en attente de validation, etc.) est
  // réservée à Sylvie — la Direction n'y accède plus automatiquement
  // depuis "la mienne" (sa vue perso), seulement via le sélecteur "Vue
  // manager"/"Vue Hossam" ci-dessous, pour ne pas la mélanger à son
  // quotidien Direction.
  const isManagerParRole = prenom.trim().toLowerCase() === "sylvie";
  // Simulateur de vue pour la Direction, pour prévisualiser/former sans
  // changer de compte — ne restreint jamais un vrai accès équipe :
  // isDirection reste utilisé tel quel pour les fetch de données sensibles.
  // "bode"/"hossam" n'ont pas encore de permissions propres dans l'appli
  // (Hossam a le même rôle Direction que Mélanie) : "hossam" = vue
  // Direction complète (Manager inclus, comme avant ce changement), à
  // affiner plus tard si ses permissions divergent. Les autres membres de
  // l'équipe (Justine, Laura...) et Sylvie sont représentés individuellement
  // ci-dessous, via leur vrai profil (email), pas des clés génériques.
  const [viewAs, setViewAs] = useState<string>("moi");
  // Menu plein écran mobile (<md) — remplace la sidebar, ouvert via la barre
  // de navigation fixée en bas de l'écran (voir renderNavPanel plus bas).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("dashboard");
  const [suivisSub, setSuivisSub] = useState<SuivisSub>("j1");
  const [planningSub, setPlanningSub] = useState<PlanningSub>("aujourdhui");
  const [directionSub, setDirectionSub] = useState<DirectionSub>("dashboard");
  const [helpSub, setHelpSub] = useState<HelpSub>("hotels");
  const [rdvAutoOpenClientId, setRdvAutoOpenClientId] = useState<string | null>(null);
  const [focusReservationId, setFocusReservationId] = useState<string | null>(null);
  const [billetAutoOpenId, setBilletAutoOpenId] = useState<string | null>(null);
  const [activityAutoOpenClientId, setActivityAutoOpenClientId] = useState<string | null>(null);
  const [sectionAutoOpen, setSectionAutoOpen] = useState<{ clientId: string; section: "Activités" | "Suivi" } | null>(
    null
  );
  const [prospectsSub, setProspectsSub] = useState<ProspectsSub>("toutes");
  const [managerSub, setManagerSub] = useState<ManagerSub>("attente");
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [catalogueSubView, setCatalogueSubView] = useState<"activites" | "packs">("activites");
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prospectSummaryId, setProspectSummaryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [clientListExpanded, setClientListExpanded] = useState(false);
  // Liste/Pipeline est un toggle par onglet : Clients démarre en Liste,
  // Prospects démarre en Pipeline (vue Kommo par défaut) — chacun garde son
  // propre choix ensuite si l'utilisateur bascule.
  const [teamViewByMode, setTeamViewByMode] = useState<{
    team: "liste" | "pipeline";
    prospects: "liste" | "pipeline";
  }>({ team: "liste", prospects: "pipeline" });
  const teamView = mode === "prospects" ? teamViewByMode.prospects : teamViewByMode.team;
  const setTeamView = (v: "liste" | "pipeline") =>
    setTeamViewByMode((prev) => ({ ...prev, [mode === "prospects" ? "prospects" : "team"]: v }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allCoutsMap, setAllCoutsMap] = useState<Record<string, number>>({});
  const [allResaOptions, setAllResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [planningLoaded, setPlanningLoaded] = useState(false);
  const [allRemboursements, setAllRemboursements] = useState<Remboursement[]>([]);
  const [allPaiementsEtapes, setAllPaiementsEtapes] = useState<PaiementEtape[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [allVerifications, setAllVerifications] = useState<Verification[]>([]);
  const [paypalPaiements, setPaypalPaiements] = useState<PaypalPaiement[]>([]);
  const [catalogueModificationRequests, setCatalogueModificationRequests] = useState<
    CatalogueModificationRequest[]
  >([]);
  const [transfertTaxeModificationRequests, setTransfertTaxeModificationRequests] = useState<
    TransfertTaxeModificationRequest[]
  >([]);
  // Rapportés par les Centers (mêmes composants que les popups bloquantes
  // bus/jour/Assouan) via onPendingChange — pour la cloche de la rubrique
  // Manager, sans refaire les requêtes en double.
  const [busEscalationsPending, setBusEscalationsPending] = useState<BusEscalation[]>([]);
  const [jourEscalationsPending, setJourEscalationsPending] = useState<JourEscalation[]>([]);
  const [assouanVerificationsPending, setAssouanVerificationsPending] = useState<AssouanVerification[]>(
    []
  );
  const [suivisLoaded, setSuivisLoaded] = useState(false);
  const [modifsLoaded, setModifsLoaded] = useState(false);
  const [remarquesEmploye, setRemarquesEmploye] = useState<RemarqueEmployee[]>([]);
  const [kommoReponsesEmploye, setKommoReponsesEmploye] = useState<KommoReponseEmploye[]>([]);
  const [remarquesLoaded, setRemarquesLoaded] = useState(false);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  // Options du simulateur "Aperçu vu par" — une entrée par vraie personne
  // (via son profil/email), pas des clés génériques : Justine/Laura/etc.
  // apparaissent individuellement, et Sylvie (rôle Manager) est repérée par
  // son prénom plutôt que par une clé "manager" à part.
  const sylvieProfile = teamProfiles.find((p) => p.prenom.trim().toLowerCase() === "sylvie");
  const sylvieViewKey = sylvieProfile?.id ?? "manager";
  // Hossam a le rôle Direction (accès marges/CA), mais une navigation
  // restreinte comme Bodé (équipe Égypte) — son profil n'apparaît donc pas
  // dans autresEquipeProfiles (filtré sur role === "equipe"), on va le
  // chercher à part pour la simulation "Vue Hossam" ci-dessous.
  const hossamProfile = teamProfiles.find((p) => p.prenom.trim().toLowerCase() === "hossam");
  const autresEquipeProfiles = teamProfiles.filter(
    (p) => p.role === "equipe" && p.prenom.trim().toLowerCase() !== "sylvie"
  );
  const viewAsOptions = [
    { key: "moi", label: "La mienne" },
    ...autresEquipeProfiles.map((p) => ({
      key: p.id,
      label: `Vue ${p.prenom.trim() || p.email.split("@")[0]}`,
    })),
    { key: sylvieViewKey, label: "Vue Sylvie" },
    { key: "hossam", label: "Vue Hossam" },
  ];
  const effectiveIsDirection = isDirection && (viewAs === "moi" || viewAs === "hossam");
  // Manager (activités en attente, etc.) retiré pour Hossam à sa demande —
  // seule Sylvie (via sylvieViewKey) et "la mienne" pour Mélanie y donnent
  // accès désormais.
  const effectiveIsManager = viewAs === "moi" ? isManagerParRole : viewAs === sylvieViewKey;
  // Quand "Aperçu vu par" pointe vers une vraie personne (Justine, Laura,
  // Sylvie, Hossam...), le nom affiché (ex. le "Bonjour" du tableau de
  // bord) et les horaires perso du Planning ("Ta semaine") doivent
  // refléter CETTE personne, pas Mélanie — sinon la simulation ne sert à
  // rien pour ces écrans-là. Les actions d'écriture restent sous le vrai
  // compte. "hossam" ne matche jamais un id de profil (clé fixe), d'où le
  // repli explicite sur hossamProfile — sans ça, simulatedProfile restait
  // undefined et le "Bonjour" retombait sur le vrai compte connecté
  // (Mélanie), pas sur Hossam.
  const simulatedProfile =
    viewAs === "hossam" ? hossamProfile : teamProfiles.find((p) => p.id === viewAs);
  const effectiveUserEmail = simulatedProfile?.email ?? userEmail;
  const effectiveUserId = simulatedProfile?.id ?? userId;
  const effectivePrenom = simulatedProfile?.prenom || (viewAs === "moi" ? prenom : "");
  // Navigation restreinte effective : le vrai compte connecté (navMasque/
  // suivisVisibles, passés par page.tsx) sur "moi", ou celle de la
  // personne simulée sinon (simulatedProfile résout déjà Hossam via
  // hossamProfile, voir plus haut). Ne restreint jamais la Direction
  // "pour de vrai" (isDirection && "moi") : seule la simulation applique
  // une restriction à Mélanie.
  const activePermsProfile = viewAs === "moi" ? null : simulatedProfile;
  const effectiveNavMasque = viewAs === "moi" ? navMasque : (activePermsProfile?.nav_masque ?? []);
  const effectiveSuivisVisibles =
    viewAs === "moi" ? suivisVisibles : (activePermsProfile?.suivis_visibles ?? null);
  // Équipe Égypte (Hossam, Bodé) uniquement — sert de signal pour afficher
  // la traduction arabe en plus du libellé français dans toute la sidebar
  // (onglets + sous-onglets). Ne plus se baser sur "nav_masque non vide" :
  // Sylvie/Laura/Justine ont aussi un nav_masque (['recap']) pour une tout
  // autre raison, ce qui leur affichait l'arabe par erreur.
  const arabicMode = ["hossam", "bodé", "bode"].includes(effectivePrenom.trim().toLowerCase());
  // "Récap du mois" vit sous Direction > Récap du mois pour Mélanie (pas en
  // onglet de premier niveau), mais reste un vrai onglet pour Hossam/Bodé.
  // On distingue via navMasque (vide) plutôt que le prénom : seule Mélanie
  // a le rôle Direction ET une navigation non restreinte — Hossam a aussi
  // le rôle Direction mais un navMasque non vide (voir migration 0092).
  const hideRecapTopLevel = viewAs === "moi" && isDirection && navMasque.length === 0;
  const [teamPlanningShifts, setTeamPlanningShifts] = useState<PlanningShift[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [catalogueTarifs, setCatalogueTarifs] = useState<Record<string, CatalogueTarif[]>>({});
  const [transfertTarifs, setTransfertTarifs] = useState<Record<string, CatalogueTransfertTarif[]>>(
    {}
  );
  const [catalogueOptions, setCatalogueOptions] = useState<Record<string, CatalogueOption[]>>({});
  const [catalogueFaq, setCatalogueFaq] = useState<Record<string, CatalogueFaq[]>>({});
  const [catalogueJours, setCatalogueJours] = useState<Record<string, CatalogueJour[]>>({});
  const [allResaTarifs, setAllResaTarifs] = useState<Record<string, ReservationTarif[]>>({});
  const [sharedAlerts, setSharedAlerts] = useState<SharedActivityAlert[]>([]);
  const [showSharedAlertPopup, setShowSharedAlertPopup] = useState(false);

  useEffect(() => {
    (async () => {
      const [
        { data, error },
        { data: cat, error: catError },
        { data: catTarifs },
        { data: transfertTarifsData },
        { data: catOptions },
        { data: catFaq },
        { data: catJours },
        { data: packsData },
        { data: profs },
        { data: shifts },
        { data: paypal },
        { data: incidents },
        { data: verifs },
      ] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase
          .from("catalogue_activites")
          .select("*")
          .order("ordre", { ascending: true }),
        supabase.from("catalogue_tarifs").select("*"),
        supabase.from("transfert_tarifs").select("*").order("ordre", { ascending: true }),
        supabase.from("catalogue_options").select("*"),
        supabase.from("catalogue_faq").select("*").order("created_at", { ascending: true }),
        supabase.from("catalogue_jours").select("*").order("ordre", { ascending: true }),
        supabase.from("packs").select("*").order("ordre", { ascending: true }),
        supabase.from("profiles").select("*"),
        supabase.from("planning_shifts").select("*"),
        // Chargé sans attendre l'ouverture de Suivis : le pop-up de rappel
        // (PaypalPaiementRappel) doit pouvoir se déclencher quel que soit
        // l'onglet ouvert, comme les autres rappels (billets, appels...).
        supabase.from("paypal_paiements").select("*").order("paypal_recu_le", { ascending: false }),
        // Chargé sans attendre l'ouverture de Suivis, pour la même raison :
        // le tableau de bord doit signaler un incident dès l'ouverture de
        // l'appli, même à une collègue qui n'était pas là quand il est arrivé.
        supabase.from("incidents").select("*").order("created_at", { ascending: false }),
        // Chargé sans attendre l'ouverture d'une fiche : sert au rappel
        // personnel de vérification des dossiers (PersonalNudgeAlert).
        supabase.from("verifications").select("*"),
      ]);
      setPacks((packsData as Pack[]) || []);
      setTeamProfiles((profs as Profile[]) || []);
      setTeamPlanningShifts((shifts as PlanningShift[]) || []);
      setPaypalPaiements((paypal as PaypalPaiement[]) || []);
      setAllIncidents((incidents as Incident[]) || []);
      setAllVerifications((verifs as Verification[]) || []);
      if (!error && data) {
        setClients(data as Client[]);
        if (data.length && !selectedId) setSelectedId(data[0].id);
      }
      if (!catError && cat) setCatalogue(cat as CatalogueItem[]);
      const groupedCatTarifs: Record<string, CatalogueTarif[]> = {};
      ((catTarifs as CatalogueTarif[]) || []).forEach((t) => {
        groupedCatTarifs[t.catalogue_item_id] = [...(groupedCatTarifs[t.catalogue_item_id] || []), t];
      });
      setCatalogueTarifs(groupedCatTarifs);
      const groupedTransfertTarifs: Record<string, CatalogueTransfertTarif[]> = {};
      ((transfertTarifsData as CatalogueTransfertTarif[]) || []).forEach((t) => {
        groupedTransfertTarifs[t.catalogue_item_id] = [
          ...(groupedTransfertTarifs[t.catalogue_item_id] || []),
          t,
        ];
      });
      setTransfertTarifs(groupedTransfertTarifs);
      const groupedCatOptions: Record<string, CatalogueOption[]> = {};
      ((catOptions as CatalogueOption[]) || []).forEach((o) => {
        groupedCatOptions[o.catalogue_item_id] = [...(groupedCatOptions[o.catalogue_item_id] || []), o];
      });
      setCatalogueOptions(groupedCatOptions);
      const groupedFaq: Record<string, CatalogueFaq[]> = {};
      ((catFaq as CatalogueFaq[]) || []).forEach((f) => {
        groupedFaq[f.catalogue_item_id] = [...(groupedFaq[f.catalogue_item_id] || []), f];
      });
      setCatalogueFaq(groupedFaq);
      const groupedJours: Record<string, CatalogueJour[]> = {};
      ((catJours as CatalogueJour[]) || []).forEach((j) => {
        groupedJours[j.catalogue_item_id] = [...(groupedJours[j.catalogue_item_id] || []), j];
      });
      setCatalogueJours(groupedJours);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signal de présence pour le rapport Manager > Gestion équipe ("dernière
  // activité") — pas à chaque action (trop de writes), juste tant que
  // l'appli reste ouverte dans un onglet actif.
  useEffect(() => {
    if (!userId) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      supabase.from("profiles").update({ derniere_activite_le: new Date().toISOString() }).eq("id", userId);
    };
    ping();
    const id = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [userId, supabase]);

  // Activités partagées (speedboat semi-privé, mini-bus) pas encore
  // remplies dans les 7 prochains jours — requête dédiée et légère (pas le
  // fetch complet de "reservations", inutile de charger toute la table
  // juste pour ce contrôle qui peut se déclencher avant même que l'onglet
  // Réservations ait été ouvert).
  // Une seule "dernière fois affiché" en localStorage (pas un créneau
  // matin/après-midi fixe) — le popup revient à l'ouverture de session
  // (rien affiché encore → réaffiche tout de suite), puis à nouveau environ
  // 2h30 après la dernière fois qu'il a été refermé, qu'importe l'heure
  // exacte à laquelle l'employée a commencé son shift.
  const SHARED_ALERT_KEY = "adr_shared_alert_last_shown";
  const SHARED_ALERT_GAP_MS = 2.5 * 60 * 60 * 1000;

  const fetchSharedAlerts = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = localDateStr(today);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const endStr = localDateStr(end);
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .gte("date_debut", todayStr)
      .lte("date_debut", endStr);
    const alerts = sharedActivityAlerts(clients, (data as Reservation[]) || [], todayStr, endStr);
    setSharedAlerts(alerts);
    if (alerts.length > 0) setShowSharedAlertPopup(true);
  }, [supabase, clients]);

  useEffect(() => {
    if (!loaded) return;
    const checkDue = () => {
      const lastShown = Number(window.localStorage.getItem(SHARED_ALERT_KEY) || 0);
      if (Date.now() - lastShown < SHARED_ALERT_GAP_MS) return;
      fetchSharedAlerts();
    };
    checkDue();
    const id = setInterval(checkDue, 15 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fetchSharedAlerts]);

  const dismissSharedAlertPopup = () => {
    window.localStorage.setItem(SHARED_ALERT_KEY, String(Date.now()));
    setShowSharedAlertPopup(false);
  };

  useEffect(() => {
    if (
      mode !== "planning" &&
      mode !== "suivis" &&
      mode !== "direction" &&
      mode !== "manager" &&
      mode !== "dashboard" &&
      mode !== "catalogue" &&
      mode !== "recap"
    )
      return;
    // Direction shows revenue/margin data — don't even fetch it into the
    // browser for team members who don't have the Direction role.
    if (mode === "direction" && !isDirection) return;
    (async () => {
      // Chaque bloc a son propre drapeau "déjà chargé" — sans ça, revenir
      // sur Réservations/Suivis/Direction/Dashboard/Catalogue relançait la
      // requête sur TOUTE la table reservations (+ options/tarifs) à chaque
      // fois, ce qui rendait la navigation de plus en plus lente à mesure
      // que le nombre de réservations grandissait. Les mutations passent
      // déjà par les setters locaux (updateReservationById etc.), donc les
      // données restent à jour sans refetch.
      if (!planningLoaded) {
        const { data: resas } = await supabase.from("reservations").select("*");
        const list = (resas as Reservation[]) || [];
        setAllReservations(list);
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
          setAllResaOptions(grouped);
          const groupedTarifs: Record<string, ReservationTarif[]> = {};
          ((tarifs as ReservationTarif[]) || []).forEach((t) => {
            groupedTarifs[t.reservation_id] = [...(groupedTarifs[t.reservation_id] || []), t];
          });
          setAllResaTarifs(groupedTarifs);
        } else {
          setAllResaOptions({});
          setAllResaTarifs({});
        }

        // Coûts réels : réservés à la Direction en base (table à part + RLS),
        // jamais fetchés dans le navigateur d'un compte équipe.
        if (isDirection && list.length) {
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
          setAllCoutsMap(map);
        } else {
          setAllCoutsMap({});
        }
        const { data: etapes } = await supabase.from("paiements_etapes").select("*");
        setAllPaiementsEtapes((etapes as PaiementEtape[]) || []);

        setPlanningLoaded(true);
      }

      if (mode === "suivis" && !suivisLoaded) {
        const { data: rembs } = await supabase.from("remboursements").select("*");
        setAllRemboursements((rembs as Remboursement[]) || []);
        setSuivisLoaded(true);
      }

      if ((mode === "suivis" || mode === "direction") && !modifsLoaded) {
        const { data: modifs } = await supabase.from("catalogue_modification_requests").select("*");
        setCatalogueModificationRequests((modifs as CatalogueModificationRequest[]) || []);
        const { data: taxeModifs } = await supabase
          .from("transfert_taxe_modification_requests")
          .select("*");
        setTransfertTaxeModificationRequests((taxeModifs as TransfertTaxeModificationRequest[]) || []);
        setModifsLoaded(true);
      }

      if (mode === "manager" && !remarquesLoaded) {
        const { data: remarques } = await supabase
          .from("remarques_employe")
          .select("*")
          .order("created_at", { ascending: false });
        setRemarquesEmploye((remarques as RemarqueEmployee[]) || []);
        // Fenêtre de 60 jours seulement : suffisant pour une moyenne
        // représentative, sans faire grossir indéfiniment le fetch au fil
        // des mois (voir cron /api/cron/kommo-response-times).
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 60);
        const { data: kommoReponses } = await supabase
          .from("kommo_reponses_employe")
          .select("*")
          .gte("reponse_at", cutoff.toISOString());
        setKommoReponsesEmploye((kommoReponses as KommoReponseEmploye[]) || []);
        setRemarquesLoaded(true);
      }
    })();
  }, [mode, supabase, isDirection, planningLoaded, suivisLoaded, modifsLoaded, remarquesLoaded]);

  useEffect(() => {
    if (!effectiveIsDirection && mode === "direction") setMode("dashboard");
    if (!effectiveIsManager && mode === "manager") setMode("dashboard");
    if (effectiveNavMasque.includes(mode)) setMode("dashboard");
    if (mode === "recap" && hideRecapTopLevel) setMode("dashboard");
  }, [effectiveIsDirection, effectiveIsManager, effectiveNavMasque, hideRecapTopLevel, mode]);

  // Équipe Égypte : si le sous-onglet Suivis courant n'est plus autorisé
  // (changement de "Aperçu vu par", ou premier chargement d'un compte
  // restreint), on retombe sur le premier sous-onglet encore visible.
  useEffect(() => {
    if (effectiveSuivisVisibles && !effectiveSuivisVisibles.includes(suivisSub)) {
      const fallback = SUIVIS_SUBS.find((s) => effectiveSuivisVisibles.includes(s.key));
      if (fallback) setSuivisSub(fallback.key);
    }
  }, [effectiveSuivisVisibles, suivisSub]);

  // Comptes "en attente" par catégorie (autorisations, clients confirmés
  // Kommo non pris en charge, activités en Brouillon, doublons, prospects
  // stagnants) — répartis en badges par sous-menu Manager ci-dessous. Les
  // demandes de modification de tarifs (catalogue/taxes) sont volontairement
  // pas comptées ici : elles concernent uniquement la Direction et restent
  // dans l'onglet Direction (voir ManagerView.tsx).
  const managerAutorisationsCount =
    busEscalationsPending.length + jourEscalationsPending.length + assouanVerificationsPending.length;
  const managerClientsCount = clients.filter((c) => c.confirmation_a_traiter).length;
  const managerActivitesCount = allReservations.filter((r) => r.statut_resa === "Brouillon").length;
  const managerDoublonsCount = clients.filter((c) => c.doublon_possible_id && !c.doublon_traite).length;
  const managerProspectsStagnantsCount = clients.filter(prospectStagnantNav).length;
  // Badges par sous-menu (pas un total global) : "Gestion équipe" n'a pas
  // de badge, rien à traiter en urgence de ce côté.
  const managerSubCounts: Record<ManagerSub, number> = {
    attente: managerAutorisationsCount + managerClientsCount + managerActivitesCount,
    equipe: 0,
    suivi: managerDoublonsCount + managerProspectsStagnantsCount,
    stats: 0,
  };

  const activeStatuts =
    mode === "prospects"
      ? prospectsSub === "toutes"
        ? PROSPECT_STATUTS
        : [prospectsSub]
      : CLIENT_STATUTS;
  const scoped = clients.filter((c) => activeStatuts.includes(c.statut));
  const allTags = Array.from(new Set(scoped.flatMap((c) => c.tags || []))).sort();
  const filtered = scoped
    .filter((c) => (c.nom || "").toLowerCase().includes(query.toLowerCase()))
    .filter((c) => !tagFilter || (c.tags || []).includes(tagFilter));
  const selected = clients.find((c) => c.id === selectedId) || null;

  const openClient = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    setMode(c && PROSPECT_STATUTS.includes(c.statut) ? "prospects" : "team");
    setProspectsSub("toutes");
    setSelectedId(id);
  };

  const openRdvPaiements = (clientId?: string) => {
    setMode("suivis");
    setSuivisSub("rdv");
    if (clientId) setRdvAutoOpenClientId(clientId);
  };

  // Depuis le dashboard, "+ Nouvelle activité" : rattacher directement à un
  // client déjà existant sans devoir d'abord chercher/ouvrir sa fiche puis
  // cliquer "Ajouter une activité" — ouvre la fiche avec le pas-à-pas guidé
  // déjà lancé.
  const openClientForNewActivity = (clientId: string) => {
    openClient(clientId);
    setActivityAutoOpenClientId(clientId);
  };

  // Idem, pour "Annuler une activité" (ouvre la section Activités, pour
  // qu'elle choisisse laquelle) et "Ajouter un remboursement/avoir" (ouvre
  // la section Suivi) depuis le dashboard.
  const openClientForCancelActivity = (clientId: string) => {
    openClient(clientId);
    setSectionAutoOpen({ clientId, section: "Activités" });
  };
  const openClientForRemboursement = (clientId: string) => {
    openClient(clientId);
    setSectionAutoOpen({ clientId, section: "Suivi" });
  };

  const openPickupsChambres = () => {
    setMode("suivis");
    setSuivisSub("j1");
  };

  const openNumerosChambre = () => {
    setMode("suivis");
    setSuivisSub("chambres");
  };

  const openAuRevoir = () => {
    setMode("suivis");
    setSuivisSub("aurevoir");
  };

  const openAvisClients = () => {
    setMode("suivis");
    setSuivisSub("avis");
  };

  const openProspectsARelancer = () => {
    setMode("prospects");
    setProspectsSub("toutes");
  };

  const openBilletsAvion = () => {
    setMode("suivis");
    setSuivisSub("billets");
  };

  const openPaypalPaiements = () => {
    setMode("suivis");
    setSuivisSub("paypal");
  };

  const openIncidents = () => {
    setMode("suivis");
    setSuivisSub("incidents");
  };

  // Depuis la fiche détail d'un billet (Suivis > Billets d'avion), ouvre
  // l'activité liée dans Réservations > Calendrier par activité, avec un
  // "Retour" qui ramène pile sur cette même fiche billet (pas juste sur la
  // liste) — voir ActivityDetailModal (PlanningView.tsx).
  const openReservationFromBillet = (reservationId: string) => {
    setFocusReservationId(reservationId);
    setPlanningSub("par_activite");
    setMode("planning");
  };

  const backFromReservationFocus = () => {
    const id = focusReservationId;
    setFocusReservationId(null);
    setMode("suivis");
    setSuivisSub("billets");
    setBilletAutoOpenId(id);
  };

  // Gardés par client (id -> ...) et non par un seul ref partagé : sinon,
  // changer de client pendant qu'une sauvegarde/retry est encore en vol pour
  // le précédent fait fusionner les modifications des deux clients dans le
  // même patch et l'envoie sur le mauvais id.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPatches = useRef<Record<string, Partial<Client>>>({});
  const retryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const errorToastShown = useRef<Record<string, boolean>>({});

  // Répercute un changement de statut fait dans le CRM vers le lead Kommo
  // correspondant (écriture CRM → Kommo) — best-effort, en tâche de fond :
  // un échec réseau ici ne doit jamais bloquer/annuler l'action dans le CRM.
  const pushStatutToKommo = (leadId: number | null, statut: string, nom?: string) => {
    if (!leadId) return;
    fetch("/api/kommo/push-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, statut, nom }),
    }).catch(() => {});
  };

  const flushSave = useCallback(
    async (id: string, attempt = 0) => {
      const patch = pendingPatches.current[id];
      if (!patch || Object.keys(patch).length === 0) return;
      setSaveState("saving");
      const { error } = await supabase.from("clients").update(patch).eq("id", id);

      if (!error) {
        // Only clear the fields we actually just sent — the user may have
        // kept typing (and queuing more changes) while this request was in flight.
        const current = pendingPatches.current[id];
        if (current) {
          Object.keys(patch).forEach((k) => delete (current as Record<string, unknown>)[k]);
        }
        setSaveState("saved");
        errorToastShown.current[id] = false;
        setTimeout(() => setSaveState("idle"), 1000);
        return;
      }

      // Keep the patch queued (never drop unsaved changes) and retry.
      // A silently-expired auth session is the most common real-world cause
      // here — the UI still looks "connecté" but requests 401 until the
      // token is refreshed — so force a refresh before retrying.
      setSaveState("error");
      if (!errorToastShown.current[id]) {
        toast("Échec de l'enregistrement — nouvelle tentative en cours…");
        errorToastShown.current[id] = true;
      }
      if (attempt === 0) {
        await supabase.auth.refreshSession();
      }
      const delay = Math.min(2000 * 2 ** attempt, 15000);
      if (retryTimers.current[id]) clearTimeout(retryTimers.current[id]);
      retryTimers.current[id] = setTimeout(() => flushSave(id, attempt + 1), delay);
    },
    [supabase, toast]
  );

  const updateSelected = (patch: Partial<Client>) => {
    if (!selected) return;
    const id = selected.id;
    if (patch.statut && patch.statut !== selected.statut) {
      pushStatutToKommo(selected.kommo_lead_id, patch.statut, patch.nom ?? selected.nom);
    }
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    pendingPatches.current[id] = { ...pendingPatches.current[id], ...patch };
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    if (retryTimers.current[id]) clearTimeout(retryTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => flushSave(id), 600);
  };

  // Rafraîchissement automatique de tous les onglets, toutes les 25s, pour
  // voir les nouveautés entrantes (nouveau prospect Kommo, activité ajoutée
  // par une collègue, remarque, remboursement, demande de modification
  // catalogue...) sans avoir à recharger la page manuellement — jusqu'ici
  // chaque section n'était chargée qu'une fois (à l'ouverture, ou à la
  // première visite de cet onglet). On ne refetch que ce qui a déjà été
  // chargé au moins une fois (mêmes drapeaux planningLoaded/suivisLoaded/
  // modifsLoaded/remarquesLoaded que le chargement initial), pour ne pas
  // aller chercher des données qu'un onglet jamais ouvert n'utilise pas.
  //
  // Pour les clients uniquement : une modification tapée à l'écran passe
  // par un enregistrement optimiste + différé (jusqu'à ~15s en cas d'erreur
  // réseau, voir flushSave/pendingPatches ci-dessus) — un rafraîchissement
  // en plein milieu écraserait ce brouillon local pas encore confirmé en
  // base. On réapplique donc par-dessus la donnée fraîche toute modif
  // encore en attente pour ce client. Les autres entités (catalogue,
  // réservations, etc.) s'enregistrent en direct (pas de différé), donc un
  // simple remplacement complet est sans risque pour elles.
  const refreshAll = useCallback(
    async (flags: {
      planningLoaded: boolean;
      suivisLoaded: boolean;
      modifsLoaded: boolean;
      remarquesLoaded: boolean;
      isDirection: boolean;
    }) => {
      if (document.visibilityState !== "visible") return;

      const [
        { data: freshClients },
        { data: cat },
        { data: catTarifs },
        { data: transfertTarifsData },
        { data: catOptions },
        { data: catFaq },
        { data: catJours },
        { data: packsData },
        { data: profs },
        { data: shifts },
        { data: paypal },
        { data: incidents },
        { data: verifs },
      ] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("catalogue_activites").select("*").order("ordre", { ascending: true }),
        supabase.from("catalogue_tarifs").select("*"),
        supabase.from("transfert_tarifs").select("*").order("ordre", { ascending: true }),
        supabase.from("catalogue_options").select("*"),
        supabase.from("catalogue_faq").select("*").order("created_at", { ascending: true }),
        supabase.from("catalogue_jours").select("*").order("ordre", { ascending: true }),
        supabase.from("packs").select("*").order("ordre", { ascending: true }),
        supabase.from("profiles").select("*"),
        supabase.from("planning_shifts").select("*"),
        supabase.from("paypal_paiements").select("*").order("paypal_recu_le", { ascending: false }),
        supabase.from("incidents").select("*").order("created_at", { ascending: false }),
        supabase.from("verifications").select("*"),
      ]);
      setPacks((packsData as Pack[]) || []);

      if (freshClients) {
        setClients(
          (freshClients as Client[]).map((c) =>
            pendingPatches.current[c.id] ? { ...c, ...pendingPatches.current[c.id] } : c
          )
        );
      }
      if (cat) setCatalogue(cat as CatalogueItem[]);
      const groupedCatTarifs: Record<string, CatalogueTarif[]> = {};
      ((catTarifs as CatalogueTarif[]) || []).forEach((t) => {
        groupedCatTarifs[t.catalogue_item_id] = [...(groupedCatTarifs[t.catalogue_item_id] || []), t];
      });
      setCatalogueTarifs(groupedCatTarifs);
      const groupedTransfertTarifs: Record<string, CatalogueTransfertTarif[]> = {};
      ((transfertTarifsData as CatalogueTransfertTarif[]) || []).forEach((t) => {
        groupedTransfertTarifs[t.catalogue_item_id] = [
          ...(groupedTransfertTarifs[t.catalogue_item_id] || []),
          t,
        ];
      });
      setTransfertTarifs(groupedTransfertTarifs);
      const groupedCatOptions: Record<string, CatalogueOption[]> = {};
      ((catOptions as CatalogueOption[]) || []).forEach((o) => {
        groupedCatOptions[o.catalogue_item_id] = [...(groupedCatOptions[o.catalogue_item_id] || []), o];
      });
      setCatalogueOptions(groupedCatOptions);
      const groupedFaq: Record<string, CatalogueFaq[]> = {};
      ((catFaq as CatalogueFaq[]) || []).forEach((f) => {
        groupedFaq[f.catalogue_item_id] = [...(groupedFaq[f.catalogue_item_id] || []), f];
      });
      setCatalogueFaq(groupedFaq);
      const groupedJours: Record<string, CatalogueJour[]> = {};
      ((catJours as CatalogueJour[]) || []).forEach((j) => {
        groupedJours[j.catalogue_item_id] = [...(groupedJours[j.catalogue_item_id] || []), j];
      });
      setCatalogueJours(groupedJours);
      setTeamProfiles((profs as Profile[]) || []);
      setTeamPlanningShifts((shifts as PlanningShift[]) || []);
      setPaypalPaiements((paypal as PaypalPaiement[]) || []);
      setAllIncidents((incidents as Incident[]) || []);
      setAllVerifications((verifs as Verification[]) || []);

      if (flags.planningLoaded) {
        const { data: resas } = await supabase.from("reservations").select("*");
        const list = (resas as Reservation[]) || [];
        setAllReservations(list);
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
          setAllResaOptions(grouped);
          const groupedTarifs: Record<string, ReservationTarif[]> = {};
          ((tarifs as ReservationTarif[]) || []).forEach((t) => {
            groupedTarifs[t.reservation_id] = [...(groupedTarifs[t.reservation_id] || []), t];
          });
          setAllResaTarifs(groupedTarifs);
        } else {
          setAllResaOptions({});
          setAllResaTarifs({});
        }

        if (flags.isDirection && list.length) {
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
          setAllCoutsMap(map);
        } else {
          setAllCoutsMap({});
        }
        const { data: etapes } = await supabase.from("paiements_etapes").select("*");
        setAllPaiementsEtapes((etapes as PaiementEtape[]) || []);
      }

      if (flags.suivisLoaded) {
        const { data: rembs } = await supabase.from("remboursements").select("*");
        setAllRemboursements((rembs as Remboursement[]) || []);
      }

      if (flags.modifsLoaded) {
        const { data: modifs } = await supabase.from("catalogue_modification_requests").select("*");
        setCatalogueModificationRequests((modifs as CatalogueModificationRequest[]) || []);
        const { data: taxeModifs } = await supabase
          .from("transfert_taxe_modification_requests")
          .select("*");
        setTransfertTaxeModificationRequests((taxeModifs as TransfertTaxeModificationRequest[]) || []);
      }

      if (flags.remarquesLoaded) {
        const { data: remarques } = await supabase
          .from("remarques_employe")
          .select("*")
          .order("created_at", { ascending: false });
        setRemarquesEmploye((remarques as RemarqueEmployee[]) || []);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 60);
        const { data: kommoReponses } = await supabase
          .from("kommo_reponses_employe")
          .select("*")
          .gte("reponse_at", cutoff.toISOString());
        setKommoReponsesEmploye((kommoReponses as KommoReponseEmploye[]) || []);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(
      () => refreshAll({ planningLoaded, suivisLoaded, modifsLoaded, remarquesLoaded, isDirection }),
      25000
    );
    return () => clearInterval(id);
  }, [loaded, planningLoaded, suivisLoaded, modifsLoaded, remarquesLoaded, isDirection, refreshAll]);

  const addClient = async (quick?: {
    nom: string;
    telephone: string;
    canal: string;
    statut?: "Prospect" | "Client confirmé";
  }): Promise<Client | null> => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...EMPTY_CLIENT, ...quick, statut: quick?.statut || "Prospect" })
        .select()
        .single();
      if (!error && data) {
        setClients((prev) => [data as Client, ...prev]);
        setSelectedId(data.id);
        // Un "nouveau client" atterrit direct dans Clients, un "nouveau
        // prospect" dans Prospects — chacun là où il doit apparaître.
        setMode(quick?.statut === "Client confirmé" ? "team" : "prospects");
        // Si un résumé de prospect était déjà ouvert, on bascule sur le
        // nouveau plutôt que de laisser l'ancien affiché en arrière-plan.
        setProspectSummaryId((cur) => (cur ? data.id : cur));
        return data as Client;
      }
      toast("Impossible de créer le client.");
      return null;
    } catch {
      toast("Impossible de créer le client.");
      return null;
    }
  };

  const duplicateAsNewStay = async (source: Client) => {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        ...EMPTY_CLIENT,
        nom: source.nom,
        telephone: source.telephone,
        email: source.email,
        relation_grace_a: source.relation_grace_a,
        passeport_photos: source.passeport_photos,
      })
      .select()
      .single();
    if (!error && data) {
      setClients((prev) => [data as Client, ...prev]);
      setSelectedId(data.id);
      setMode("prospects");
    } else {
      toast("Impossible de créer le nouveau séjour.");
    }
  };

  const deleteClient = async (id: string): Promise<boolean> => {
    const client = clients.find((c) => c.id === id);
    const ok = await confirm({
      title: "Supprimer ce client ?",
      message: `${client?.nom || "Ce client"} sera supprimé définitivement, avec toutes ses réservations, paiements et remboursements. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return false;
    const next = clients.filter((c) => c.id !== id);
    setClients(next);
    if (selectedId === id) setSelectedId(next[0] ? next[0].id : null);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast("Échec de la suppression du client.");
      return false;
    }
    return true;
  };

  const updateClientById = async (id: string, patch: Partial<Client>) => {
    const previousStatut = clients.find((c) => c.id === id)?.statut;
    if (patch.statut) {
      const current = clients.find((c) => c.id === id);
      if (current && patch.statut !== current.statut) {
        pushStatutToKommo(current.kommo_lead_id, patch.statut, patch.nom ?? current.nom);
      }
    }
    // Toute mise à jour de dernier_contact_date (une relance), au_revoir_
    // envoye_le ou avis_envoye_le trace aussi qui l'a faite — sert au
    // rappel personnel (PersonalNudgeAlert) "ça fait X jours que tu n'as
    // rien fait ici". Toujours le vrai compte connecté (userId), jamais
    // l'identité simulée par "Aperçu vu par".
    const monPrenom = () => teamProfiles.find((p) => p.id === userId)?.prenom || "";
    let finalPatch: Partial<Client> = patch;
    if (patch.dernier_contact_date) {
      finalPatch = { ...finalPatch, dernier_contact_par_id: userId, dernier_contact_par_nom: monPrenom() };
    }
    if (patch.au_revoir_envoye_le) {
      finalPatch = { ...finalPatch, au_revoir_envoye_par_id: userId, au_revoir_envoye_par_nom: monPrenom() };
    }
    if (patch.avis_envoye_le) {
      finalPatch = { ...finalPatch, avis_envoye_par_id: userId, avis_envoye_par_nom: monPrenom() };
    }
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...finalPatch } : c)));
    const { error } = await supabase.from("clients").update(finalPatch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");

    // Un client annulé sans que ses activités le soient rendrait le total du
    // séjour et le calendrier incohérents — on annule donc en cascade,
    // quelle que soit la source du changement de statut (modal dédié ou
    // glisser-déposer dans le Pipeline). Idempotent : ne touche pas les
    // réservations déjà annulées (ex. déjà traitées par AnnulerClientModal).
    if (patch.statut === "Client annulé") {
      const aAnnuler = allReservations.filter((r) => r.client_id === id && r.statut_resa !== "Annulée");
      for (const r of aAnnuler) {
        await updateReservationById(r.id, {
          statut_resa: "Annulée",
          annulation_raison: r.annulation_raison || "Client annulé",
          annulation_date: r.annulation_date || localDateStr(new Date()),
        });
      }
    }

    // Les activités ajoutées pendant la négociation (client encore
    // Prospect/En négociation) restent en Brouillon — sans cette bascule, un
    // client qui passe "Client confirmé" garde des activités bloquées en
    // Brouillon indéfiniment, invisibles pour la facturation (qui ne reprend
    // que les Confirmées) alors que rien ne le signale sur la fiche client.
    if (patch.statut === "Client confirmé" && previousStatut !== "Client confirmé") {
      const aConfirmer = allReservations.filter((r) => r.client_id === id && r.statut_resa === "Brouillon");
      for (const r of aConfirmer) {
        await updateReservationById(r.id, { statut_resa: "Confirmée" });
      }
    }
  };

  // Rassemble deux fiches identifiées comme doublon (voir DoublonPossibleAlert)
  // en une seule : tout ce qui est rattaché à la fiche "retirée" (réservations,
  // paiements PayPal, remboursements, incidents, vérifications...) est
  // basculé sur la fiche "gardée", puis les champs vides de la fiche gardée
  // sont complétés avec ceux de la fiche retirée — jamais l'inverse, on ne
  // veut pas écraser une info déjà saisie par l'équipe. La fiche retirée
  // n'est pas supprimée (traçabilité, réversible via "Supprimer ce client"
  // si besoin) : elle passe à "Client annulé" avec une note explicite.
  const fusionnerClients = async (idGarde: string, idRetire: string) => {
    const garde = clients.find((c) => c.id === idGarde);
    const retire = clients.find((c) => c.id === idRetire);
    if (!garde || !retire) return;

    const TABLES_CLIENT_ID = [
      "reservations",
      "remboursements",
      "incidents",
      "verifications",
      "client_hotels",
      "assouan_verifications",
      "bus_escalations",
      "jour_escalations",
      "kommo_reponses_employe",
      "remarques_employe",
      "activity_log",
    ] as const;
    for (const table of TABLES_CLIENT_ID) {
      const { error } = await supabase.from(table).update({ client_id: idGarde }).eq("client_id", idRetire);
      if (error) {
        toast(`Échec de la fusion (${table}).`);
        return;
      }
    }
    const { error: errPaypal } = await supabase
      .from("paypal_paiements")
      .update({ rattache_client_id: idGarde })
      .eq("rattache_client_id", idRetire);
    if (errPaypal) {
      toast("Échec de la fusion (paiements PayPal).");
      return;
    }

    // updateClientById(idRetire, { statut: "Client annulé" }) plus bas annule
    // en cascade les réservations encore rattachées à idRetire dans l'état
    // local allReservations — sans cette mise à jour immédiate, il verrait
    // encore les réservations qu'on vient tout juste de basculer vers
    // idGarde (elles ne le sont en base, pas encore dans le state React) et
    // les annulerait par erreur alors qu'elles appartiennent désormais à la
    // fiche gardée.
    setAllReservations((prev) => prev.map((r) => (r.client_id === idRetire ? { ...r, client_id: idGarde } : r)));

    const completion: Partial<Client> = {};
    if (!garde.telephone && retire.telephone) completion.telephone = retire.telephone;
    if (!garde.email && retire.email) completion.email = retire.email;
    if (!garde.hotel && retire.hotel) completion.hotel = retire.hotel;
    if (!garde.chambre && retire.chambre) completion.chambre = retire.chambre;
    if (!garde.pseudo_contact && retire.pseudo_contact) completion.pseudo_contact = retire.pseudo_contact;
    if (!garde.ages_enfants && retire.ages_enfants) completion.ages_enfants = retire.ages_enfants;
    if (!garde.ages_bebes && retire.ages_bebes) completion.ages_bebes = retire.ages_bebes;
    if (!garde.ages_ados && retire.ages_ados) completion.ages_ados = retire.ages_ados;
    if (!garde.date_debut && retire.date_debut) completion.date_debut = retire.date_debut;
    if (!garde.date_fin && retire.date_fin) completion.date_fin = retire.date_fin;
    if (!garde.kommo_contact_id && retire.kommo_contact_id) completion.kommo_contact_id = retire.kommo_contact_id;
    if (!garde.kommo_lead_id && retire.kommo_lead_id) completion.kommo_lead_id = retire.kommo_lead_id;
    if (!garde.adultes && retire.adultes) completion.adultes = retire.adultes;
    if (!garde.enfants && retire.enfants) completion.enfants = retire.enfants;
    if (!garde.bebes && retire.bebes) completion.bebes = retire.bebes;
    if (retire.passeport_photos?.length) {
      completion.passeport_photos = Array.from(
        new Set([...(garde.passeport_photos || []), ...retire.passeport_photos])
      );
    }

    const monPrenom = teamProfiles.find((p) => p.id === userId)?.prenom || "";
    const dateFusion = localDateStr(new Date());
    completion.commentaires = [
      garde.commentaires,
      `🔀 Fusionné avec la fiche de "${retire.nom}" le ${dateFusion} par ${monPrenom}.`,
    ]
      .filter(Boolean)
      .join("\n");
    completion.doublon_traite = true;
    if (garde.doublon_possible_id === idRetire) completion.doublon_possible_id = null;

    await updateClientById(idGarde, completion);

    // Pas de updateClientById(idRetire, { statut: "Client annulé" }) ici :
    // son cascade "annule aussi les réservations du client" lit
    // allReservations depuis la fermeture (closure) de ce rendu, qui ne
    // reflète pas encore le setAllReservations plus haut (un setState ne
    // met pas à jour une variable déjà capturée dans l'exécution en
    // cours) — il verrait donc encore les réservations qu'on vient de
    // basculer vers idGarde et les annulerait par erreur. On met donc à
    // jour idRetire directement, sans passer par ce cascade.
    const retirePatch: Partial<Client> = {
      statut: "Client annulé",
      doublon_traite: true,
      commentaires: [retire.commentaires, `🔀 Fusionné dans la fiche de "${garde.nom}" — voir cette fiche.`]
        .filter(Boolean)
        .join("\n"),
    };
    setClients((prev) => prev.map((c) => (c.id === idRetire ? { ...c, ...retirePatch } : c)));
    const { error: errRetire } = await supabase.from("clients").update(retirePatch).eq("id", idRetire);
    if (errRetire) toast("Échec de la mise à jour de la fiche retirée.");

    toast(`Fiches fusionnées : "${retire.nom}" a été rattaché à "${garde.nom}".`);
    await refreshAll({ planningLoaded, suivisLoaded, modifsLoaded, remarquesLoaded, isDirection });
  };

  // Rattache un paiement PayPal reçu (via IPN, voir /api/paypal/ipn) au
  // client concerné — remplit directement l'acompte du dossier plutôt que
  // de laisser l'employée ressaisir montant/mode/date à la main.
  const rattacherPaypalPaiement = async (paiementId: string, clientId: string) => {
    const paiement = paypalPaiements.find((p) => p.id === paiementId);
    if (!paiement) return;
    const rattacheAt = new Date().toISOString();
    setPaypalPaiements((prev) =>
      prev.map((p) =>
        p.id === paiementId
          ? { ...p, rattache_client_id: clientId, rattache_par: userEmail, rattache_at: rattacheAt }
          : p
      )
    );
    const { error: errPaiement } = await supabase
      .from("paypal_paiements")
      .update({ rattache_client_id: clientId, rattache_par: userEmail, rattache_at: rattacheAt })
      .eq("id", paiementId);
    if (errPaiement) {
      toast("Échec du rattachement du paiement PayPal.");
      return;
    }
    await updateClientById(clientId, {
      paiement_type: "acompte",
      acompte_montant: paiement.montant_net,
      acompte_mode: "PayPal",
      acompte_valide: true,
      acompte_paye: true,
      acompte_date_encaissement: paiement.paypal_recu_le.slice(0, 10),
      acompte_encaisse_ts: paiement.paypal_recu_le,
    });
  };

  const updateReservationById = async (id: string, patch: Partial<Reservation>) => {
    setAllReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const updateRemboursement = async (id: string, patch: Partial<Remboursement>) => {
    setAllRemboursements((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("remboursements").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement du remboursement.");
  };

  const resolveCatalogueModificationRequest = async (id: string) => {
    setCatalogueModificationRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, statut: "Traité" } : r))
    );
    const { error } = await supabase
      .from("catalogue_modification_requests")
      .update({ statut: "Traité" })
      .eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const resolveTransfertTaxeModificationRequest = async (id: string) => {
    setTransfertTaxeModificationRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, statut: "Traité" } : r))
    );
    const { error } = await supabase
      .from("transfert_taxe_modification_requests")
      .update({ statut: "Traité" })
      .eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const nextCatalogueOrdre = () =>
    catalogue.length ? Math.max(...catalogue.map((a) => a.ordre ?? 0)) + 1 : 0;

  const addCatalogueItem = async () => {
    const { data, error } = await supabase
      .from("catalogue_activites")
      .insert({ ordre: nextCatalogueOrdre() })
      .select()
      .single();
    if (!error && data) {
      setCatalogue((prev) => [...prev, data as CatalogueItem]);
    } else {
      toast("Impossible de créer l'activité.");
    }
  };

  const duplicateCatalogueItem = async (source: CatalogueItem) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, ordre, ...rest } = source;
    const { data, error } = await supabase
      .from("catalogue_activites")
      .insert({ ...rest, nom: `${source.nom} (copie)`, valide: false, ordre: nextCatalogueOrdre() })
      .select()
      .single();
    if (!error && data) {
      const newItem = data as CatalogueItem;
      setCatalogue((prev) => [...prev, newItem]);
      for (const t of catalogueTarifs[source.id] || []) {
        const { data: td } = await supabase
          .from("catalogue_tarifs")
          .insert({ catalogue_item_id: newItem.id, label: t.label, pu: t.pu })
          .select()
          .single();
        if (td) {
          setCatalogueTarifs((prev) => ({
            ...prev,
            [newItem.id]: [...(prev[newItem.id] || []), td as CatalogueTarif],
          }));
        }
      }
      for (const tt of transfertTarifs[source.id] || []) {
        const { data: ttd } = await supabase
          .from("transfert_tarifs")
          .insert({
            catalogue_item_id: newItem.id,
            zone: tt.zone,
            vehicule: tt.vehicule,
            prix: tt.prix,
            ordre: tt.ordre,
          })
          .select()
          .single();
        if (ttd) {
          setTransfertTarifs((prev) => ({
            ...prev,
            [newItem.id]: [...(prev[newItem.id] || []), ttd as CatalogueTransfertTarif],
          }));
        }
      }
      for (const o of catalogueOptions[source.id] || []) {
        const { data: od } = await supabase
          .from("catalogue_options")
          .insert({ catalogue_item_id: newItem.id, nom: o.nom, prix: o.prix, mode: o.mode })
          .select()
          .single();
        if (od) {
          setCatalogueOptions((prev) => ({
            ...prev,
            [newItem.id]: [...(prev[newItem.id] || []), od as CatalogueOption],
          }));
        }
      }
      for (const f of catalogueFaq[source.id] || []) {
        const { data: fd } = await supabase
          .from("catalogue_faq")
          .insert({ catalogue_item_id: newItem.id, question: f.question, reponse: f.reponse })
          .select()
          .single();
        if (fd) {
          setCatalogueFaq((prev) => ({
            ...prev,
            [newItem.id]: [...(prev[newItem.id] || []), fd as CatalogueFaq],
          }));
        }
      }
      for (const j of catalogueJours[source.id] || []) {
        const { data: jd } = await supabase
          .from("catalogue_jours")
          .insert({
            catalogue_item_id: newItem.id,
            titre: j.titre,
            description: j.description,
            ordre: j.ordre,
          })
          .select()
          .single();
        if (jd) {
          setCatalogueJours((prev) => ({
            ...prev,
            [newItem.id]: [...(prev[newItem.id] || []), jd as CatalogueJour],
          }));
        }
      }
    } else {
      toast("Impossible de dupliquer l'activité.");
    }
  };

  const updateCatalogueItem = async (id: string, patch: Partial<CatalogueItem>) => {
    setCatalogue((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("catalogue_activites").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  // Glisser-déposer réservé à la Direction (voir canSeeMargins côté
  // Catalogue) — déplace l'activité juste avant/après la cible dans l'ordre
  // global, qui pilote aussi bien l'affichage du Catalogue que la liste de
  // choix de l'assistant "Ajouter une activité".
  const reorderCatalogueItem = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const fromIdx = catalogue.findIndex((a) => a.id === draggedId);
    const toIdx = catalogue.findIndex((a) => a.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const list = [...catalogue];
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const reordered = list.map((a, i) => ({ ...a, ordre: i }));
    setCatalogue(reordered);
    Promise.all(
      reordered.map((a) => supabase.from("catalogue_activites").update({ ordre: a.ordre }).eq("id", a.id))
    ).then((results) => {
      if (results.some((r) => r.error)) toast("Échec de l'enregistrement du nouvel ordre.");
    });
  };

  const deleteCatalogueItem = async (id: string) => {
    const ok = await confirm({
      title: "Retirer cette activité du catalogue ?",
      message: "Elle ne sera plus proposée pour de nouvelles réservations. Les réservations déjà créées à partir de ce modèle ne sont pas affectées.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setCatalogue((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.from("catalogue_activites").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const addPack = async () => {
    const ordre = packs.length ? Math.max(...packs.map((p) => p.ordre)) + 1 : 0;
    const { data, error } = await supabase.from("packs").insert({ ordre }).select().single();
    if (!error && data) {
      setPacks((prev) => [...prev, data as Pack]);
    } else {
      toast("Impossible de créer le pack.");
    }
  };

  const updatePack = async (id: string, patch: Partial<Pack>) => {
    setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("packs").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement du pack.");
  };

  const deletePack = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer ce pack ?",
      message: "Il ne sera plus proposé pour de nouvelles réservations. Les activités déjà créées à partir de ce pack ne sont pas affectées.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setPacks((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("packs").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const addCatalogueTarif = async (catalogueItemId: string) => {
    const { data, error } = await supabase
      .from("catalogue_tarifs")
      .insert({ catalogue_item_id: catalogueItemId, label: "", pu: 0 })
      .select()
      .single();
    if (!error && data) {
      const t = data as CatalogueTarif;
      setCatalogueTarifs((prev) => ({
        ...prev,
        [catalogueItemId]: [...(prev[catalogueItemId] || []), t],
      }));
    } else {
      toast("Impossible d'ajouter ce tarif.");
    }
  };

  const updateCatalogueTarif = async (
    catalogueItemId: string,
    tarifId: string,
    patch: Partial<CatalogueTarif>
  ) => {
    setCatalogueTarifs((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).map((t) =>
        t.id === tarifId ? { ...t, ...patch } : t
      ),
    }));
    const { error } = await supabase.from("catalogue_tarifs").update(patch).eq("id", tarifId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteCatalogueTarif = async (catalogueItemId: string, tarifId: string) => {
    setCatalogueTarifs((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).filter((t) => t.id !== tarifId),
    }));
    const { error } = await supabase.from("catalogue_tarifs").delete().eq("id", tarifId);
    if (error) toast("Échec de la suppression.");
  };

  const addTransfertTarif = async (catalogueItemId: string) => {
    const ordre = (transfertTarifs[catalogueItemId] || []).length;
    const { data, error } = await supabase
      .from("transfert_tarifs")
      .insert({ catalogue_item_id: catalogueItemId, zone: "", vehicule: "", prix: 0, ordre })
      .select()
      .single();
    if (!error && data) {
      const t = data as CatalogueTransfertTarif;
      setTransfertTarifs((prev) => ({
        ...prev,
        [catalogueItemId]: [...(prev[catalogueItemId] || []), t],
      }));
    } else {
      toast("Impossible d'ajouter ce tarif de transfert.");
    }
  };

  const updateTransfertTarif = async (
    catalogueItemId: string,
    tarifId: string,
    patch: Partial<CatalogueTransfertTarif>
  ) => {
    setTransfertTarifs((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).map((t) =>
        t.id === tarifId ? { ...t, ...patch } : t
      ),
    }));
    const { error } = await supabase.from("transfert_tarifs").update(patch).eq("id", tarifId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteTransfertTarif = async (catalogueItemId: string, tarifId: string) => {
    setTransfertTarifs((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).filter((t) => t.id !== tarifId),
    }));
    const { error } = await supabase.from("transfert_tarifs").delete().eq("id", tarifId);
    if (error) toast("Échec de la suppression.");
  };

  const addCatalogueOption = async (catalogueItemId: string) => {
    const { data, error } = await supabase
      .from("catalogue_options")
      .insert({ catalogue_item_id: catalogueItemId, nom: "", prix: 0, mode: "personne" })
      .select()
      .single();
    if (!error && data) {
      const o = data as CatalogueOption;
      setCatalogueOptions((prev) => ({
        ...prev,
        [catalogueItemId]: [...(prev[catalogueItemId] || []), o],
      }));
    } else {
      toast("Impossible d'ajouter cette option.");
    }
  };

  const updateCatalogueOption = async (
    catalogueItemId: string,
    optionId: string,
    patch: Partial<CatalogueOption>
  ) => {
    setCatalogueOptions((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).map((o) =>
        o.id === optionId ? { ...o, ...patch } : o
      ),
    }));
    const { error } = await supabase.from("catalogue_options").update(patch).eq("id", optionId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteCatalogueOption = async (catalogueItemId: string, optionId: string) => {
    setCatalogueOptions((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).filter((o) => o.id !== optionId),
    }));
    const { error } = await supabase.from("catalogue_options").delete().eq("id", optionId);
    if (error) toast("Échec de la suppression.");
  };

  const addCatalogueFaq = async (catalogueItemId: string) => {
    const { data, error } = await supabase
      .from("catalogue_faq")
      .insert({ catalogue_item_id: catalogueItemId, question: "", reponse: "" })
      .select()
      .single();
    if (!error && data) {
      const f = data as CatalogueFaq;
      setCatalogueFaq((prev) => ({
        ...prev,
        [catalogueItemId]: [...(prev[catalogueItemId] || []), f],
      }));
    } else {
      toast("Impossible d'ajouter cette question.");
    }
  };

  const updateCatalogueFaq = async (
    catalogueItemId: string,
    faqId: string,
    patch: Partial<CatalogueFaq>
  ) => {
    setCatalogueFaq((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).map((f) =>
        f.id === faqId ? { ...f, ...patch } : f
      ),
    }));
    const { error } = await supabase.from("catalogue_faq").update(patch).eq("id", faqId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteCatalogueFaq = async (catalogueItemId: string, faqId: string) => {
    setCatalogueFaq((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).filter((f) => f.id !== faqId),
    }));
    const { error } = await supabase.from("catalogue_faq").delete().eq("id", faqId);
    if (error) toast("Échec de la suppression.");
  };

  const addCatalogueJour = async (catalogueItemId: string) => {
    const ordre = (catalogueJours[catalogueItemId] || []).length;
    const { data, error } = await supabase
      .from("catalogue_jours")
      .insert({ catalogue_item_id: catalogueItemId, titre: "", description: "", ordre })
      .select()
      .single();
    if (!error && data) {
      const j = data as CatalogueJour;
      setCatalogueJours((prev) => ({
        ...prev,
        [catalogueItemId]: [...(prev[catalogueItemId] || []), j],
      }));
    } else {
      toast("Impossible d'ajouter ce jour.");
    }
  };

  const updateCatalogueJour = async (
    catalogueItemId: string,
    jourId: string,
    patch: Partial<CatalogueJour>
  ) => {
    setCatalogueJours((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).map((j) =>
        j.id === jourId ? { ...j, ...patch } : j
      ),
    }));
    const { error } = await supabase.from("catalogue_jours").update(patch).eq("id", jourId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteCatalogueJour = async (catalogueItemId: string, jourId: string) => {
    setCatalogueJours((prev) => ({
      ...prev,
      [catalogueItemId]: (prev[catalogueItemId] || []).filter((j) => j.id !== jourId),
    }));
    const { error } = await supabase.from("catalogue_jours").delete().eq("id", jourId);
    if (error) toast("Échec de la suppression.");
  };

  // Échange l'ordre entre un jour et son voisin (haut/bas) — pas de
  // drag-and-drop ici, juste deux flèches, l'ordre important peu de fois.
  const moveCatalogueJour = (catalogueItemId: string, jourId: string, direction: -1 | 1) => {
    const list = [...(catalogueJours[catalogueItemId] || [])].sort((a, b) => a.ordre - b.ordre);
    const idx = list.findIndex((j) => j.id === jourId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    updateCatalogueJour(catalogueItemId, a.id, { ordre: b.ordre });
    updateCatalogueJour(catalogueItemId, b.id, { ordre: a.ordre });
  };

  const { topVenteIds, topRentabiliteIds } = useMemo(() => {
    const byItem: Record<string, { total: number; marge: number }> = {};
    allReservations.forEach((r) => {
      if (!r.catalogue_item_id) return;
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;
      const total = resaTotalMontant(
        r,
        client,
        allResaOptions[r.id] || [],
        allResaTarifs[r.id] || []
      );
      const cout = Number(allCoutsMap[r.id]) || 0;
      if (!byItem[r.catalogue_item_id]) byItem[r.catalogue_item_id] = { total: 0, marge: 0 };
      byItem[r.catalogue_item_id].total += total;
      byItem[r.catalogue_item_id].marge += total - cout;
    });
    const entries = Object.entries(byItem);
    const ventes = new Set(
      entries
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 3)
        .map(([id]) => id)
    );
    // Le classement rentabilité dépend du coût réel, donné uniquement à la
    // Direction — pour un compte équipe allCoutsMap est vide, donc on ne
    // calcule/n'affiche pas ce classement (voir canSeeMargins côté Catalogue).
    const rentabilite = isDirection
      ? new Set(
          entries
            .sort((a, b) => b[1].marge - a[1].marge)
            .slice(0, 3)
            .map(([id]) => id)
        )
      : new Set<string>();
    return { topVenteIds: ventes, topRentabiliteIds: rentabilite };
  }, [allReservations, clients, allResaOptions, allResaTarifs, allCoutsMap, isDirection]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <Spinner />
      </div>
    );
  }

  const paypalPaiementsNonRattaches = paypalPaiements.filter((p) => !p.rattache_client_id).length;

  const currentTab = TABS.find((t) => t.key === mode);
  const visibleSuivisSubs = effectiveSuivisVisibles
    ? SUIVIS_SUBS.filter((s) => effectiveSuivisVisibles.includes(s.key))
    : SUIVIS_SUBS;
  const visibleSuivisDuSuivi = visibleSuivisSubs.filter((s) => s.groupe === "suivi_du_suivi");

  // Contenu de la navigation (logo, onglets + sous-onglets, "Aperçu vu par",
  // statut de synchro) — partagé entre la sidebar fixe (desktop, ≥md) et le
  // menu plein écran mobile (<md, ouvert via la barre du bas). Un seul
  // endroit à maintenir pour ne pas laisser les deux versions diverger.
  const renderNavPanel = () => (
    <>
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9973E] text-sm font-semibold text-white">
          AD
        </div>
        <div className="min-w-0">
          <div className="font-heading truncate text-sm font-semibold text-[#171717]">Autour des Dunes</div>
          <div className="truncate text-[11px] text-[#666666]">Espace interne</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2.5">
        {TABS.filter(
          (t) =>
            (t.key !== "direction" || effectiveIsDirection) &&
            (t.key !== "manager" || effectiveIsManager) &&
            (t.key !== "recap" || !hideRecapTopLevel) &&
            !effectiveNavMasque.includes(t.key)
        ).map((t) => {
          const Icon = t.icon;
          const active = mode === t.key;
          return (
            <div key={t.key}>
              <button
                onClick={() => {
                  setMode(t.key);
                  if (t.key === "preview" && !previewId && clients[0]) setPreviewId(clients[0].id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[#fafafa] text-[#171717]"
                    : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                }`}
              >
                <Icon />
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span className="truncate">{t.label}</span>
                  {arabicMode && (
                    <span dir="rtl" className="truncate text-[10px] font-normal text-[#999999]">
                      {t.labelAr}
                    </span>
                  )}
                </span>
              </button>
              {t.key === "suivis" && active && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                  {visibleSuivisSubs
                    .filter((s) => s.groupe === "important")
                    .map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          setSuivisSub(s.key);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-xs font-medium transition ${
                          suivisSub === s.key
                            ? "bg-[#fafafa] text-[#171717]"
                            : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                        }`}
                      >
                        <span className="flex min-w-0 flex-col items-start leading-tight">
                          <span className="truncate">{s.label}</span>
                          {arabicMode && (
                            <span dir="rtl" className="truncate text-[10px] font-normal text-[#999999]">
                              {s.labelAr}
                            </span>
                          )}
                        </span>
                        {s.key === "paypal" && paypalPaiementsNonRattaches > 0 && (
                          <span className="rounded-full bg-[#EE0000] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            +{paypalPaiementsNonRattaches}
                          </span>
                        )}
                      </button>
                    ))}
                  {visibleSuivisDuSuivi.length > 0 && (
                    <>
                      <div className="mb-0.5 mt-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        Suivi du suivi
                      </div>
                      {visibleSuivisDuSuivi.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => {
                            setSuivisSub(s.key);
                            setMobileMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-xs font-medium transition ${
                            suivisSub === s.key
                              ? "bg-[#fafafa] text-[#171717]"
                              : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                          }`}
                        >
                          <span className="flex min-w-0 flex-col items-start leading-tight">
                            <span className="truncate">{s.label}</span>
                            {arabicMode && (
                              <span dir="rtl" className="truncate text-[10px] font-normal text-[#999999]">
                                {s.labelAr}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
              {t.key === "planning" && active && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                  {PLANNING_SUBS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setPlanningSub(s.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full flex-col items-start rounded-[6px] px-2 py-1.5 text-left text-xs font-medium leading-tight transition ${
                        planningSub === s.key
                          ? "bg-[#fafafa] text-[#171717]"
                          : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      {arabicMode && (
                        <span dir="rtl" className="truncate text-[10px] font-normal text-[#999999]">
                          {s.labelAr}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {t.key === "direction" && active && effectiveIsDirection && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                  {DIRECTION_SUBS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setDirectionSub(s.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`block w-full rounded-[6px] px-2 py-1.5 text-left text-xs font-medium transition ${
                        directionSub === s.key
                          ? "bg-[#fafafa] text-[#171717]"
                          : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {t.key === "help" && active && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                  {HELP_SUBS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setHelpSub(s.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`block w-full rounded-[6px] px-2 py-1.5 text-left text-xs font-medium transition ${
                        helpSub === s.key
                          ? "bg-[#fafafa] text-[#171717]"
                          : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {t.key === "prospects" && active && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                  {PROSPECTS_SUBS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setProspectsSub(s.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full flex-col items-start rounded-[6px] px-2 py-1.5 text-left text-xs font-medium leading-tight transition ${
                        prospectsSub === s.key
                          ? "bg-[#fafafa] text-[#171717]"
                          : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      {arabicMode && PROSPECTS_SUBS_AR[s.key] && (
                        <span dir="rtl" className="truncate text-[10px] font-normal text-[#999999]">
                          {PROSPECTS_SUBS_AR[s.key]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {t.key === "manager" && active && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                  {MANAGER_SUBS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setManagerSub(s.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-left text-xs font-medium transition ${
                        managerSub === s.key
                          ? "bg-[#fafafa] text-[#171717]"
                          : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                      }`}
                    >
                      <span>{s.label}</span>
                      {managerSubCounts[s.key] > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          +{managerSubCounts[s.key]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {isDirection && (
        <div className="border-t border-[#eaeaea] px-2.5 py-3">
          <label className="mb-1 block px-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
            Aperçu vu par
          </label>
          <select
            value={viewAs}
            onChange={(e) => setViewAs(e.target.value as typeof viewAs)}
            className={`w-full rounded-[6px] border-0 px-2.5 py-2 text-xs font-medium transition ${
              viewAs === "moi" ? "bg-[#fafafa] text-[#666666] hover:bg-[#eaeaea]" : "bg-[#C9973E] text-white"
            }`}
          >
            {viewAsOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="border-t border-[#eaeaea] px-2.5 py-3">
        <div
          className={`px-2.5 pb-2 text-[11px] transition-opacity ${
            saveState === "error"
              ? "text-[#EE0000] opacity-100"
              : saveState === "saving"
                ? "text-[#C9973E] opacity-100"
                : "text-[#666666] opacity-100"
          }`}
        >
          {saveState === "error"
            ? "⚠ Non enregistré — nouvelle tentative…"
            : saveState === "saving"
              ? "Enregistrement…"
              : "Données synchronisées"}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <AppelReminders
        clients={clients}
        profiles={teamProfiles}
        planningShifts={teamPlanningShifts}
        currentUserId={userId}
      />
      <BusEscalationCenter
        profiles={teamProfiles}
        currentUserId={userId}
        onPendingChange={setBusEscalationsPending}
      />
      <JourEscalationCenter
        profiles={teamProfiles}
        currentUserId={userId}
        onPendingChange={setJourEscalationsPending}
      />
      <AssouanVerificationCenter
        profiles={teamProfiles}
        currentUserId={userId}
        onPendingChange={setAssouanVerificationsPending}
      />
      <RemarqueEmployeeCenter currentUserId={userId} />
      {!isDirection && (
        <PersonalNudgeAlert
          currentUserId={userId}
          clients={clients}
          verifications={allVerifications}
          onOpenProspectsARelancer={openProspectsARelancer}
          onOpenAuRevoir={openAuRevoir}
          onOpenAvisClients={openAvisClients}
          onOpenClients={() => setMode("team")}
        />
      )}
      <BilletRappels reservations={allReservations} clients={clients} userEmail={userEmail} />
      <BilletEnvoiRappels
        reservations={allReservations}
        clients={clients}
        onUpdateReservation={updateReservationById}
      />
      {/* Popup désactivée à la demande de Mélanie le 03/09/2026 — trop
          fréquente/gênante même après le filtre du 1er septembre. Le
          rattachement des paiements PayPal reste possible manuellement via
          Suivis > Paiements PayPal. Réactiver en remettant ce composant. */}
      {false && (
        <PaypalPaiementRappel
          paypalPaiements={paypalPaiements.filter((p) => p.paypal_recu_le >= "2026-09-01")}
          clients={clients}
          onRattacher={rattacherPaypalPaiement}
        />
      )}
      <AnnulationHossamAlert reservations={allReservations} clients={clients} userEmail={userEmail} />
      <DoublonPossibleAlert
        clients={clients}
        onOpenClient={openClient}
        onResoudre={(id) => updateClientById(id, { doublon_traite: true })}
        onFusionner={fusionnerClients}
      />
      {NOUVEAU_CLIENT_CONFIRME_ALERT_ACTIVE && (
        <NouveauClientConfirmeAlert
          clients={clients}
          profiles={teamProfiles}
          onOpenClient={openClient}
          onAssigner={(id, assignee) =>
            updateClientById(id, {
              confirmation_assignee_a: assignee,
              confirmation_assignee_a_le: new Date().toISOString(),
            })
          }
          onRevert={(id) =>
            updateClientById(id, { confirmation_assignee_a: null, confirmation_assignee_a_le: null })
          }
        />
      )}
      {prospectSummaryId &&
        (() => {
          const c = clients.find((cl) => cl.id === prospectSummaryId);
          if (!c) return null;
          return (
            <ProspectSummaryModal
              client={c}
              onClose={() => setProspectSummaryId(null)}
              onUpdateClient={(patch) => updateClientById(c.id, patch)}
              onConfirmClient={async () => {
                await updateClientById(c.id, { statut: "Client confirmé" });
                setProspectSummaryId(null);
              }}
            />
          );
        })()}
      {showSharedAlertPopup && sharedAlerts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-lg">📣</span>
              <p className="font-heading text-base font-semibold text-[#171717]">
                À remplir en priorité cette semaine
              </p>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {sharedAlerts.length} sortie{sharedAlerts.length > 1 ? "s" : ""} partagée
              {sharedAlerts.length > 1 ? "s" : ""} {sharedAlerts.length > 1 ? "ont" : "a"} encore des
              places libres. Poussez-les dans vos ventes.
            </p>
            <div className="mt-4 space-y-2">
              {sharedAlerts.map((a) => {
                const d = new Date(a.date + "T00:00:00");
                const dateLabel = d.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                });
                const rempli = a.capacite - a.reste;
                return (
                  <div key={`${a.label}-${a.date}`} className="rounded-md border border-[#eaeaea] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-[#171717]">{a.label}</p>
                      <span className="whitespace-nowrap text-xs text-neutral-500">{dateLabel}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f5a623]/20">
                        <div
                          className="h-full rounded-full bg-[#C9973E]"
                          style={{ width: `${Math.round((rempli / a.capacite) * 100)}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-[#8B4531]">
                        {rempli} / {a.capacite} places
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={dismissSharedAlertPopup}
              className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-[#eaeaea] bg-white md:flex">
        {renderNavPanel()}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#eaeaea] px-3 py-3">
              <span className="font-heading text-sm font-semibold text-[#171717]">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-md p-1.5 text-[#666666] hover:bg-[#fafafa]"
              >
                ✕
              </button>
            </div>
            {renderNavPanel()}
            <div className="border-t border-[#eaeaea] px-2.5 py-3">
              <div className="truncate px-2.5 pb-2 text-[11px] text-[#666666]">{userEmail}</div>
              <div className="flex flex-col gap-1">
                <ChangePasswordButton />
                <button
                  onClick={handleSignOut}
                  className="appearance-none rounded-md border border-[#eaeaea] px-3 py-2 text-left text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-[#666666]/15 bg-white px-3 py-3 md:gap-3 md:px-6">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex-shrink-0 rounded-md p-1.5 text-[#666666] hover:bg-[#fafafa] md:hidden"
          >
            <IconMenu />
          </button>
          <h1 className="flex-shrink-0 truncate whitespace-nowrap font-heading text-base font-semibold text-[#171717]">
            {currentTab?.label}
          </h1>
          <div className="flex min-w-0 flex-1 justify-center">
            <GlobalSearch
              clients={clients}
              reservations={allReservations}
              onOpenClient={openClient}
            />
          </div>
          <div className="hidden flex-shrink-0 items-center gap-3 text-sm text-neutral-500 md:flex">
            <span className="hidden max-w-[180px] truncate sm:inline">{userEmail}</span>
            <ChangePasswordButton />
            <button
              onClick={handleSignOut}
              className="appearance-none whitespace-nowrap rounded-[6px] border border-[#eaeaea] px-3 py-1.5 text-[#171717] hover:bg-[#fafafa]"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col pb-14 md:pb-0">
      {mode === "dashboard" && (
        <div className="flex-1 overflow-y-auto">
          {!planningLoaded ? (
            <Spinner />
          ) : (
            <DashboardView
              userEmail={effectiveUserEmail}
              viewAsUserId={simulatedProfile ? effectiveUserId : undefined}
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              isDirection={effectiveIsDirection}
              onOpenClient={openClient}
              onOpenClientForNewActivity={openClientForNewActivity}
              onOpenClientForCancelActivity={openClientForCancelActivity}
              onOpenClientForRemboursement={openClientForRemboursement}
              onOpenRdvPaiements={openRdvPaiements}
              onOpenPickupsChambres={openPickupsChambres}
              onOpenNumerosChambre={openNumerosChambre}
              onOpenAuRevoir={openAuRevoir}
              onOpenAvisClients={openAvisClients}
              onOpenProspectsARelancer={openProspectsARelancer}
              onOpenBilletsAvion={openBilletsAvion}
              onOpenPaypalPaiements={openPaypalPaiements}
              paypalPaiementsNonRattaches={paypalPaiementsNonRattaches}
              onCreateClient={addClient}
              onUpdateClient={updateClientById}
              onDeleteClient={deleteClient}
              catalogue={catalogue}
              incidents={allIncidents}
              onOpenIncidents={openIncidents}
              showTeamShiftsToday={effectiveNavMasque.includes("rh")}
              teamPlanningShifts={teamPlanningShifts}
              teamProfiles={teamProfiles}
              displayFirstName={effectivePrenom}
              paiementsEtapes={allPaiementsEtapes}
            />
          )}
        </div>
      )}

      {mode === "prospects" && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[#666666]/10 bg-white px-3 py-1.5">
            <QuickAddClient
              onCreate={addClient}
              onUpdateClient={updateClientById}
              clients={clients}
              onDeleteClient={deleteClient}
              onOpenClient={openClient}
              defaultStatut="Prospect"
            />
          </div>
          <PipelineView
            clients={scoped}
            statuts={activeStatuts}
            groupBy="statut"
            onUpdateStatut={(id, statut) => updateClientById(id, { statut })}
            onOpenClient={(id) => setProspectSummaryId(id)}
          />
        </div>
      )}

      {mode === "team" && (
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-[#666666]/10 bg-white px-3 py-1.5">
            <div className="flex flex-1 items-center gap-2">
              <button
                onClick={() => setClientListExpanded((v) => !v)}
                title={clientListExpanded ? "Masquer la liste des clients" : "Afficher la liste des clients"}
                className="flex h-[30px] w-7 flex-shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-[#fafafa]"
              >
                <span className={`inline-block transition-transform ${clientListExpanded ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un client…"
                className="w-56 rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#171717] focus:outline-none"
              />
              <QuickAddClient
                onCreate={addClient}
                onUpdateClient={updateClientById}
                clients={clients}
                onDeleteClient={deleteClient}
                onOpenClient={openClient}
                defaultStatut="Client confirmé"
              />
            </div>
            <div className="flex gap-1">
            <button
              onClick={() => setTeamView("liste")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                teamView === "liste"
                  ? "bg-[#171717] text-white"
                  : "text-[#171717] hover:bg-[#fafafa]"
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setTeamView("pipeline")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                teamView === "pipeline"
                  ? "bg-[#171717] text-white"
                  : "text-[#171717] hover:bg-[#fafafa]"
              }`}
            >
              Pipeline
            </button>
            </div>
          </div>

          {teamView === "pipeline" ? (
            <PipelineView
              clients={scoped}
              statuts={activeStatuts}
              groupBy="timing"
              onUpdateStatut={(id, statut) => updateClientById(id, { statut })}
              onOpenClient={(id) => {
                setSelectedId(id);
                setTeamView("liste");
              }}
            />
          ) : (
        <div className="flex flex-1 overflow-hidden">
          {(clientListExpanded || query.trim()) && (
          <aside
            className={`${
              !selected || !activeStatuts.includes(selected.statut) ? "flex w-full" : "hidden"
            } flex-col border-r border-[#666666]/20 bg-white md:flex md:w-72`}
          >
              <>
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-b border-[#666666]/10 p-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          tagFilter === tag
                            ? "border-[#171717] bg-[#171717] text-white"
                            : "border-neutral-200 text-neutral-500"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto">
                  {filtered.length === 0 && (
                    <div className="p-4 text-sm text-neutral-400">Aucun client.</div>
                  )}
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedId(c.id);
                        setQuery("");
                        setClientListExpanded(false);
                      }}
                      className={`block w-full border-b border-[#666666]/10 px-4 py-3 text-left ${
                        c.id === selectedId ? "bg-[#fafafa]" : "hover:bg-[#fafafa]/50"
                      }`}
                    >
                      <div className="font-medium text-[#171717]">
                        {c.nom || "Sans nom"}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span
                          className="rounded-full px-2 py-0.5 text-white"
                          style={{ backgroundColor: STATUT_COLORS[c.statut] }}
                        >
                          {c.statut}
                        </span>
                        {c.date_debut && (
                          <span className="font-amounts text-neutral-500">
                            {fmtDate(c.date_debut)}
                          </span>
                        )}
                        {(c.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[#fafafa] px-2 py-0.5 text-[#171717]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </>
          </aside>
          )}

          <main
            className={`${
              !selected || !activeStatuts.includes(selected.statut) ? "hidden md:block" : "block"
            } flex-1 overflow-y-auto p-3 md:p-6`}
          >
            {!selected || !activeStatuts.includes(selected.statut) ? (
              <div className="text-neutral-400">Sélectionne ou crée un client pour commencer.</div>
            ) : (
              <>
                <button
                  onClick={() => setSelectedId(null)}
                  className="mb-3 flex items-center gap-1 text-sm font-medium text-[#666666] hover:text-[#171717] md:hidden"
                >
                  ‹ Retour à la liste
                </button>
                <ClientDetail
                  key={selected.id}
                  client={selected}
                  allClients={clients}
                  onChange={updateSelected}
                  onDelete={() => deleteClient(selected.id)}
                  onJumpToClient={openClient}
                  onDuplicateAsNewStay={duplicateAsNewStay}
                  onDeleteClientById={deleteClient}
                  canDelete={effectiveIsDirection}
                  canSeeMargins={effectiveIsDirection}
                  catalogue={catalogue}
                  catalogueTarifs={catalogueTarifs}
                  transfertTarifs={transfertTarifs}
                  catalogueOptions={catalogueOptions}
                  packs={packs}
                  onOpenHelp={() => setMode("help")}
                  autoOpenActivity={activityAutoOpenClientId === selected.id}
                  onAutoOpenActivityHandled={() => setActivityAutoOpenClientId(null)}
                  autoOpenSection={sectionAutoOpen?.clientId === selected.id ? sectionAutoOpen.section : undefined}
                  onAutoOpenSectionHandled={() => setSectionAutoOpen(null)}
                />
              </>
            )}
          </main>
        </div>
          )}
        </div>
      )}

      {mode === "catalogue" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-2 border-b border-[#eaeaea] px-4 pt-3">
            <button
              onClick={() => setCatalogueSubView("activites")}
              className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
                catalogueSubView === "activites"
                  ? "border border-b-0 border-[#eaeaea] bg-white text-[#171717]"
                  : "text-[#666666] hover:text-[#171717]"
              }`}
            >
              Activités
            </button>
            <button
              onClick={() => setCatalogueSubView("packs")}
              className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
                catalogueSubView === "packs"
                  ? "border border-b-0 border-[#eaeaea] bg-white text-[#171717]"
                  : "text-[#666666] hover:text-[#171717]"
              }`}
            >
              Packs
            </button>
          </div>
          {catalogueSubView === "packs" ? (
            <PacksAdminView packs={packs} catalogue={catalogue} onAdd={addPack} onUpdate={updatePack} onDelete={deletePack} />
          ) : (
          <CatalogueView
            items={catalogue}
            onAdd={addCatalogueItem}
            onUpdate={updateCatalogueItem}
            onReorder={reorderCatalogueItem}
            onDelete={deleteCatalogueItem}
            onDuplicate={duplicateCatalogueItem}
            tarifs={catalogueTarifs}
            onAddTarif={addCatalogueTarif}
            onUpdateTarif={updateCatalogueTarif}
            onDeleteTarif={deleteCatalogueTarif}
            transfertTarifs={transfertTarifs}
            onAddTransfertTarif={addTransfertTarif}
            onUpdateTransfertTarif={updateTransfertTarif}
            onDeleteTransfertTarif={deleteTransfertTarif}
            options={catalogueOptions}
            onAddOption={addCatalogueOption}
            onUpdateOption={updateCatalogueOption}
            onDeleteOption={deleteCatalogueOption}
            faq={catalogueFaq}
            onAddFaq={addCatalogueFaq}
            onUpdateFaq={updateCatalogueFaq}
            onDeleteFaq={deleteCatalogueFaq}
            jours={catalogueJours}
            onAddJour={addCatalogueJour}
            onUpdateJour={updateCatalogueJour}
            onDeleteJour={deleteCatalogueJour}
            onMoveJour={moveCatalogueJour}
            topVenteIds={topVenteIds}
            topRentabiliteIds={topRentabiliteIds}
            canSeeMargins={effectiveIsDirection}
          />
          )}
        </div>
      )}

      {mode === "planning" && (
        <div className="flex-1 overflow-y-auto">
          {!planningLoaded ? (
            <Spinner />
          ) : (
            <PlanningView
              sub={planningSub}
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              paiementsEtapes={allPaiementsEtapes}
              catalogue={catalogue}
              onOpenClient={openClient}
              onOpenRdvPaiement={openRdvPaiements}
              focusReservationId={focusReservationId}
              onBackToBillet={focusReservationId ? backFromReservationFocus : undefined}
            />
          )}
        </div>
      )}

      {mode === "recap" && (
        <div className="flex-1 overflow-y-auto">
          {!planningLoaded ? (
            <Spinner />
          ) : (
            <RecapMoisView
              reservations={allReservations}
              clients={clients}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              paiementsEtapes={allPaiementsEtapes}
            />
          )}
        </div>
      )}

      {mode === "suivis" && (
        <div className="flex-1 overflow-y-auto">
          {!suivisLoaded ? (
            <Spinner />
          ) : (
            <SuivisView
              sub={suivisSub}
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              paiementsEtapes={allPaiementsEtapes}
              remboursements={allRemboursements}
              onUpdateRemboursement={updateRemboursement}
              incidents={allIncidents}
              verifications={allVerifications}
              paypalPaiements={paypalPaiements}
              onRattacherPaiement={rattacherPaypalPaiement}
              profiles={teamProfiles}
              currentUserId={userId}
              planningShifts={teamPlanningShifts}
              catalogue={catalogue}
              onUpdateClient={updateClientById}
              onUpdateReservation={updateReservationById}
              onOpenClient={openClient}
              initialRdvModalClientId={rdvAutoOpenClientId}
              initialBilletId={billetAutoOpenId}
              onOpenReservationActivity={openReservationFromBillet}
            />
          )}
        </div>
      )}

      {mode === "rh" && (
        <div className="flex-1 overflow-y-auto">
          <PlanningRHView isDirection={effectiveIsDirection} viewAsUserId={simulatedProfile ? effectiveUserId : undefined} />
        </div>
      )}

      {mode === "generateur" && (
        <div className="flex flex-1 overflow-y-auto">
          {effectiveIsDirection ? (
            <GeneratorView catalogue={catalogue} clients={clients} />
          ) : (
            <OutilEnConstruction />
          )}
        </div>
      )}

      {mode === "preview" && (
        <div className={`flex-1 overflow-y-auto ${effectiveIsDirection ? "" : "flex"}`}>
          {!effectiveIsDirection ? (
            <OutilEnConstruction />
          ) : (
            (() => {
            // L'aperçu simule ce qu'un client confirmé voit de son propre
            // dossier — un prospect n'a pas encore de dossier à prévisualiser.
            const previewableClients = clients.filter((c) => CLIENT_STATUTS.includes(c.statut));
            if (previewableClients.length === 0) {
              return <div className="p-6 text-neutral-400">Créez un client pour voir son aperçu.</div>;
            }
            const previewClient =
              previewableClients.find((c) => c.id === previewId) || previewableClients[0];
            return (
              <>
                <div className="mx-auto max-w-xl px-6 pt-6">
                  <select
                    value={previewClient.id}
                    onChange={(e) => setPreviewId(e.target.value)}
                    className="input w-full"
                  >
                    {previewableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom || "Sans nom"}
                      </option>
                    ))}
                  </select>
                </div>
                <ClientPreviewView client={previewClient} catalogue={catalogue} />
              </>
            );
            })()
          )}
        </div>
      )}

      {mode === "help" && (
        <div className="flex-1 overflow-y-auto">
          <HelpView tab={helpSub} />
        </div>
      )}

      {mode === "direction" && (
        <div className="flex-1 overflow-y-auto">
          {!effectiveIsDirection ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="w-full max-w-sm rounded-md bg-white p-6 text-center">
                <p className="text-sm text-neutral-500">
                  Cette section est réservée à la Direction.
                </p>
              </div>
            </div>
          ) : !planningLoaded ? (
            <Spinner />
          ) : (
            <DirectionView
              sub={directionSub}
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              catalogue={catalogue}
              onUpdateCatalogueItem={updateCatalogueItem}
              coutsMap={allCoutsMap}
              catalogueModificationRequests={catalogueModificationRequests}
              onResolveCatalogueModificationRequest={resolveCatalogueModificationRequest}
              transfertTaxeModificationRequests={transfertTaxeModificationRequests}
              onResolveTransfertTaxeModificationRequest={resolveTransfertTaxeModificationRequest}
            />
          )}
        </div>
      )}

      {mode === "manager" && (
        <div className="flex-1 overflow-y-auto">
          {!effectiveIsManager ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="w-full max-w-sm rounded-md bg-white p-6 text-center">
                <p className="text-sm text-neutral-500">Cette section est réservée aux managers.</p>
              </div>
            </div>
          ) : !effectiveIsDirection ? (
            // Manager en pause pour Sylvie (compte réel, ou aperçu "Vue
            // manager" de la Direction) — même traitement que Générateur/
            // Aperçu client tant que ce n'est pas prêt à être utilisé.
            // "Vue Hossam" reste en Direction complète, donc voit le vrai
            // Manager.
            <OutilEnConstruction />
          ) : !planningLoaded ? (
            <Spinner />
          ) : (
            <ManagerView
              sub={managerSub}
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              catalogue={catalogue}
              onOpenClient={openClient}
              busEscalations={busEscalationsPending}
              jourEscalations={jourEscalationsPending}
              assouanVerifications={assouanVerificationsPending}
              profiles={teamProfiles}
              currentUserId={userId}
              remarquesEmploye={remarquesEmploye}
              onRemarqueSent={(r) => setRemarquesEmploye((prev) => [r, ...prev])}
              kommoReponsesEmploye={kommoReponsesEmploye}
            />
          )}
        </div>
      )}

      {mode !== "dashboard" &&
        mode !== "team" &&
        mode !== "prospects" &&
        mode !== "catalogue" &&
        mode !== "planning" &&
        mode !== "suivis" &&
        mode !== "rh" &&
        mode !== "generateur" &&
        mode !== "preview" &&
        mode !== "help" &&
        mode !== "direction" &&
        mode !== "manager" &&
        mode !== "recap" && (
          <div className="flex flex-1 items-center justify-center text-neutral-400">
            Bientôt disponible.
          </div>
        )}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[#eaeaea] bg-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {(
          [
            { key: "dashboard" as Mode, label: "Accueil", icon: IconHome },
            { key: "team" as Mode, label: "Clients", icon: IconUsers },
            { key: "planning" as Mode, label: "Résa", icon: IconCalendar },
            { key: "suivis" as Mode, label: "Suivis", icon: IconChecklist },
          ]
        ).map((t) => {
          const Icon = t.icon;
          const active = mode === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-[#8B4531]" : "text-[#666666]"
              }`}
            >
              <Icon />
              {t.label}
            </button>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-[#666666]"
        >
          <IconMenu />
          Menu
        </button>
      </nav>
    </div>
  );
}
