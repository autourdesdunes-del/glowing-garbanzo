"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueFaq,
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  Client,
  EMPTY_CLIENT,
  PlanningShift,
  Profile,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import { STATUT_COLORS } from "@/lib/constants";
import ClientDetail from "@/components/ClientDetail";
import DashboardView from "@/components/DashboardView";
import GlobalSearch from "@/components/GlobalSearch";
import PipelineView from "@/components/PipelineView";
import ChangePasswordButton from "@/components/ChangePasswordButton";
import QuickAddClient from "@/components/QuickAddClient";
import CatalogueView from "@/components/CatalogueView";
import PlanningView from "@/components/PlanningView";
import SuivisView, { SUIVIS_SUBS, SuivisSub } from "@/components/SuivisView";
import ClientPreviewView from "@/components/ClientPreviewView";
import DirectionView from "@/components/DirectionView";
import HelpView from "@/components/HelpView";
import PlanningRHView from "@/components/PlanningRHView";
import GeneratorView from "@/components/GeneratorView";
import ConfirmProvider, { useConfirm } from "@/components/ConfirmProvider";
import ToastProvider, { useToast } from "@/components/ToastProvider";
import Spinner from "@/components/Spinner";

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
  | "rh"
  | "generateur";

const CLIENT_STATUTS = ["Client confirmé", "Perdu"];
const PROSPECT_STATUTS = ["Prospect", "En négociation"];

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

const TABS: { key: Mode; label: string; icon: () => React.ReactElement }[] = [
  { key: "dashboard", label: "Tableau de bord", icon: IconHome },
  { key: "team", label: "Clients", icon: IconUsers },
  { key: "prospects", label: "Prospects", icon: IconTarget },
  { key: "catalogue", label: "Catalogue", icon: IconBook },
  { key: "suivis", label: "Suivis", icon: IconChecklist },
  { key: "planning", label: "Réservations", icon: IconCalendar },
  { key: "rh", label: "Planning équipe", icon: IconClipboard },
  { key: "generateur", label: "Générateur de programme", icon: IconSparkles },
  { key: "preview", label: "Aperçu client", icon: IconEye },
  { key: "help", label: "HELP", icon: IconHelp },
  { key: "direction", label: "Direction", icon: IconShield },
];

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function AppShell({
  userEmail,
  role,
}: {
  userEmail: string;
  role: "direction" | "equipe";
}) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShellInner userEmail={userEmail} role={role} />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppShellInner({
  userEmail,
  role,
}: {
  userEmail: string;
  role: "direction" | "equipe";
}) {
  const isDirection = role === "direction";
  const [viewAsTeam, setViewAsTeam] = useState(false);
  // La Direction voit tout ce que voit l'équipe, plus quelques options en
  // plus (marge, onglet Direction…) — ce toggle masque ces options en plus
  // pour prévisualiser/former sans changer de compte. Ça ne restreint
  // jamais un vrai accès équipe : isDirection reste utilisé tel quel pour
  // les fetch de données sensibles.
  const effectiveIsDirection = isDirection && !viewAsTeam;
  const confirm = useConfirm();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("dashboard");
  const [suivisSub, setSuivisSub] = useState<SuivisSub>("j1");
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [teamView, setTeamView] = useState<"liste" | "pipeline">("liste");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allCoutsMap, setAllCoutsMap] = useState<Record<string, number>>({});
  const [allResaOptions, setAllResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [planningLoaded, setPlanningLoaded] = useState(false);
  const [allRemboursements, setAllRemboursements] = useState<Remboursement[]>([]);
  const [suivisLoaded, setSuivisLoaded] = useState(false);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  const [teamPlanningShifts, setTeamPlanningShifts] = useState<PlanningShift[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [catalogueTarifs, setCatalogueTarifs] = useState<Record<string, CatalogueTarif[]>>({});
  const [catalogueOptions, setCatalogueOptions] = useState<Record<string, CatalogueOption[]>>({});
  const [catalogueFaq, setCatalogueFaq] = useState<Record<string, CatalogueFaq[]>>({});
  const [allResaTarifs, setAllResaTarifs] = useState<Record<string, ReservationTarif[]>>({});

  useEffect(() => {
    (async () => {
      const [
        { data, error },
        { data: cat, error: catError },
        { data: catTarifs },
        { data: catOptions },
        { data: catFaq },
      ] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase
          .from("catalogue_activites")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("catalogue_tarifs").select("*"),
        supabase.from("catalogue_options").select("*"),
        supabase.from("catalogue_faq").select("*").order("created_at", { ascending: true }),
      ]);
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
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      mode !== "planning" &&
      mode !== "suivis" &&
      mode !== "direction" &&
      mode !== "dashboard" &&
      mode !== "catalogue"
    )
      return;
    // Direction shows revenue/margin data — don't even fetch it into the
    // browser for team members who don't have the Direction role.
    if (mode === "direction" && !isDirection) return;
    (async () => {
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
      setPlanningLoaded(true);

      if (mode === "suivis") {
        const [{ data: rembs }, { data: profs }, { data: shifts }] = await Promise.all([
          supabase.from("remboursements").select("*"),
          supabase.from("profiles").select("*"),
          supabase.from("planning_shifts").select("*"),
        ]);
        setAllRemboursements((rembs as Remboursement[]) || []);
        setTeamProfiles((profs as Profile[]) || []);
        setTeamPlanningShifts((shifts as PlanningShift[]) || []);
        setSuivisLoaded(true);
      }
    })();
  }, [mode, supabase, isDirection]);

  useEffect(() => {
    if (viewAsTeam && mode === "direction") setMode("dashboard");
  }, [viewAsTeam, mode]);

  const activeStatuts = mode === "prospects" ? PROSPECT_STATUTS : CLIENT_STATUTS;
  const scoped = clients.filter((c) => activeStatuts.includes(c.statut));
  const allTags = Array.from(new Set(scoped.flatMap((c) => c.tags || []))).sort();
  const filtered = scoped
    .filter((c) => (c.nom || "").toLowerCase().includes(query.toLowerCase()))
    .filter((c) => !tagFilter || (c.tags || []).includes(tagFilter));
  const selected = clients.find((c) => c.id === selectedId) || null;

  const openClient = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    setMode(c && PROSPECT_STATUTS.includes(c.statut) ? "prospects" : "team");
    setSelectedId(id);
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<Client>>({});
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorToastShown = useRef(false);

  const flushSave = useCallback(
    async (id: string, attempt = 0) => {
      const patch = pendingPatch.current;
      if (Object.keys(patch).length === 0) return;
      setSaveState("saving");
      const { error } = await supabase.from("clients").update(patch).eq("id", id);

      if (!error) {
        // Only clear the fields we actually just sent — the user may have
        // kept typing (and queuing more changes) while this request was in flight.
        Object.keys(patch).forEach((k) => delete (pendingPatch.current as Record<string, unknown>)[k]);
        setSaveState("saved");
        errorToastShown.current = false;
        setTimeout(() => setSaveState("idle"), 1000);
        return;
      }

      // Keep the patch queued (never drop unsaved changes) and retry.
      // A silently-expired auth session is the most common real-world cause
      // here — the UI still looks "connecté" but requests 401 until the
      // token is refreshed — so force a refresh before retrying.
      setSaveState("error");
      if (!errorToastShown.current) {
        toast("Échec de l'enregistrement — nouvelle tentative en cours…");
        errorToastShown.current = true;
      }
      if (attempt === 0) {
        await supabase.auth.refreshSession();
      }
      const delay = Math.min(2000 * 2 ** attempt, 15000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => flushSave(id, attempt + 1), delay);
    },
    [supabase, toast]
  );

  const updateSelected = (patch: Partial<Client>) => {
    if (!selected) return;
    setClients((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, ...patch } : c))
    );
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    saveTimer.current = setTimeout(() => flushSave(selected.id), 600);
  };

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

  const deleteClient = async (id: string) => {
    const client = clients.find((c) => c.id === id);
    const ok = await confirm({
      title: "Supprimer ce client ?",
      message: `${client?.nom || "Ce client"} sera supprimé définitivement, avec toutes ses réservations, paiements et remboursements. Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    const next = clients.filter((c) => c.id !== id);
    setClients(next);
    if (selectedId === id) setSelectedId(next[0] ? next[0].id : null);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast("Échec de la suppression du client.");
  };

  const updateClientById = async (id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from("clients").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const updateReservationById = async (id: string, patch: Partial<Reservation>) => {
    setAllReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const addCatalogueItem = async () => {
    const { data, error } = await supabase
      .from("catalogue_activites")
      .insert({})
      .select()
      .single();
    if (!error && data) {
      setCatalogue((prev) => [data as CatalogueItem, ...prev]);
    } else {
      toast("Impossible de créer l'activité.");
    }
  };

  const duplicateCatalogueItem = async (source: CatalogueItem) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, ...rest } = source;
    const { data, error } = await supabase
      .from("catalogue_activites")
      .insert({ ...rest, nom: `${source.nom} (copie)`, valide: false })
      .select()
      .single();
    if (!error && data) {
      const newItem = data as CatalogueItem;
      setCatalogue((prev) => [newItem, ...prev]);
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
    } else {
      toast("Impossible de dupliquer l'activité.");
    }
  };

  const updateCatalogueItem = async (id: string, patch: Partial<CatalogueItem>) => {
    setCatalogue((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("catalogue_activites").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
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

  const currentTab = TABS.find((t) => t.key === mode);

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#eaeaea] bg-white">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9973E] text-sm font-semibold text-white">
            AD
          </div>
          <div className="min-w-0">
            <div className="font-heading truncate text-sm font-semibold text-[#171717]">
              Autour des Dunes
            </div>
            <div className="truncate text-[11px] text-[#666666]">Espace interne</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5">
          {TABS.filter((t) => t.key !== "direction" || effectiveIsDirection).map((t) => {
            const Icon = t.icon;
            const active = mode === t.key;
            return (
              <div key={t.key}>
                <button
                  onClick={() => {
                    setMode(t.key);
                    if (t.key === "preview" && !previewId && clients[0]) setPreviewId(clients[0].id);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#fafafa] text-[#171717]"
                      : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                  }`}
                >
                  <Icon />
                  {t.label}
                </button>
                {t.key === "suivis" && active && (
                  <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[#eaeaea] pl-2.5">
                    {SUIVIS_SUBS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSuivisSub(s.key)}
                        className={`block w-full rounded-[6px] px-2 py-1.5 text-left text-xs font-medium transition ${
                          suivisSub === s.key
                            ? "bg-[#fafafa] text-[#171717]"
                            : "text-[#666666] hover:bg-[#fafafa] hover:text-[#171717]"
                        }`}
                      >
                        {s.label}
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
            <button
              onClick={() => setViewAsTeam((v) => !v)}
              className={`flex w-full items-center justify-between rounded-[6px] px-2.5 py-2 text-xs font-medium transition ${
                viewAsTeam
                  ? "bg-[#C9973E] text-white"
                  : "bg-[#fafafa] text-[#666666] hover:bg-[#eaeaea]"
              }`}
            >
              <span>{viewAsTeam ? "Vue équipe (aperçu)" : "Voir comme l'équipe"}</span>
              <span
                className={`flex h-4 w-7 flex-shrink-0 items-center rounded-full px-0.5 transition ${
                  viewAsTeam ? "justify-end bg-[#171717]/40" : "justify-start bg-[#171717]/20"
                }`}
              >
                <span className="h-3 w-3 rounded-full bg-white" />
              </span>
            </button>
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[#666666]/15 bg-white px-6 py-3">
          <h1 className="flex-shrink-0 whitespace-nowrap font-heading text-base font-semibold text-[#171717]">
            {currentTab?.label}
          </h1>
          <div className="flex min-w-0 flex-1 justify-center">
            <GlobalSearch
              clients={clients}
              reservations={allReservations}
              onOpenClient={openClient}
            />
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 text-sm text-neutral-500">
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

        <div className="flex min-h-0 flex-1 flex-col">
      {mode === "dashboard" && (
        <div className="flex-1 overflow-y-auto">
          {!planningLoaded ? (
            <Spinner />
          ) : (
            <DashboardView
              userEmail={userEmail}
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              isDirection={effectiveIsDirection}
              onOpenClient={openClient}
              onCreateClient={addClient}
              onUpdateClient={updateClientById}
            />
          )}
        </div>
      )}

      {(mode === "team" || mode === "prospects") && (
        <div className="flex flex-1 flex-col">
          <div className="flex justify-end gap-1 border-b border-[#666666]/10 bg-white px-3 py-1.5">
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

          {teamView === "pipeline" ? (
            <PipelineView
              clients={scoped}
              statuts={activeStatuts}
              groupBy={mode === "team" ? "timing" : "statut"}
              onUpdateStatut={(id, statut) => updateClientById(id, { statut })}
              onOpenClient={(id) => {
                setSelectedId(id);
                setTeamView("liste");
              }}
            />
          ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex w-72 flex-col border-r border-[#666666]/20 bg-white">
            <div className="flex gap-2 border-b border-[#666666]/10 p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mode === "prospects" ? "Rechercher un prospect…" : "Rechercher un client…"}
                className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#171717] focus:outline-none"
              />
              <QuickAddClient
                onCreate={addClient}
                onUpdateClient={updateClientById}
                defaultStatut={mode === "prospects" ? "Prospect" : "Client confirmé"}
              />
            </div>
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
                <div className="p-4 text-sm text-neutral-400">
                  {mode === "prospects" ? "Aucun prospect." : "Aucun client."}
                </div>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
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
          </aside>

          <main className="flex-1 overflow-y-auto p-6">
            {!selected || !activeStatuts.includes(selected.statut) ? (
              <div className="text-neutral-400">
                {mode === "prospects"
                  ? "Sélectionne ou crée un prospect pour commencer."
                  : "Sélectionne ou crée un client pour commencer."}
              </div>
            ) : (
              <ClientDetail
                client={selected}
                allClients={clients}
                onChange={updateSelected}
                onDelete={() => deleteClient(selected.id)}
                onJumpToClient={openClient}
                onDuplicateAsNewStay={duplicateAsNewStay}
                canDelete={effectiveIsDirection}
                canSeeMargins={effectiveIsDirection}
                catalogue={catalogue}
                catalogueTarifs={catalogueTarifs}
                catalogueOptions={catalogueOptions}
                onOpenHelp={() => setMode("help")}
              />
            )}
          </main>
        </div>
          )}
        </div>
      )}

      {mode === "catalogue" && (
        <div className="flex-1 overflow-y-auto">
          <CatalogueView
            items={catalogue}
            onAdd={addCatalogueItem}
            onUpdate={updateCatalogueItem}
            onDelete={deleteCatalogueItem}
            onDuplicate={duplicateCatalogueItem}
            tarifs={catalogueTarifs}
            onAddTarif={addCatalogueTarif}
            onUpdateTarif={updateCatalogueTarif}
            onDeleteTarif={deleteCatalogueTarif}
            options={catalogueOptions}
            onAddOption={addCatalogueOption}
            onUpdateOption={updateCatalogueOption}
            onDeleteOption={deleteCatalogueOption}
            faq={catalogueFaq}
            onAddFaq={addCatalogueFaq}
            onUpdateFaq={updateCatalogueFaq}
            onDeleteFaq={deleteCatalogueFaq}
            topVenteIds={topVenteIds}
            topRentabiliteIds={topRentabiliteIds}
            canSeeMargins={effectiveIsDirection}
          />
        </div>
      )}

      {mode === "planning" && (
        <div className="flex-1 overflow-y-auto">
          {!planningLoaded ? (
            <Spinner />
          ) : (
            <PlanningView
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              onOpenClient={openClient}
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
              remboursements={allRemboursements}
              profiles={teamProfiles}
              planningShifts={teamPlanningShifts}
              onUpdateClient={updateClientById}
              onUpdateReservation={updateReservationById}
              onOpenClient={openClient}
            />
          )}
        </div>
      )}

      {mode === "rh" && (
        <div className="flex-1 overflow-y-auto">
          <PlanningRHView isDirection={effectiveIsDirection} />
        </div>
      )}

      {mode === "generateur" && (
        <div className="flex-1 overflow-y-auto">
          <GeneratorView catalogue={catalogue} clients={clients} />
        </div>
      )}

      {mode === "preview" && (
        <div className="flex-1 overflow-y-auto">
          {clients.length === 0 ? (
            <div className="p-6 text-neutral-400">Créez un client pour voir son aperçu.</div>
          ) : (
            <>
              <div className="mx-auto max-w-xl px-6 pt-6">
                <select
                  value={previewId ?? ""}
                  onChange={(e) => setPreviewId(e.target.value)}
                  className="input w-full"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom || "Sans nom"}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                const previewClient = clients.find((c) => c.id === previewId) || clients[0];
                return <ClientPreviewView client={previewClient} catalogue={catalogue} />;
              })()}
            </>
          )}
        </div>
      )}

      {mode === "help" && (
        <div className="flex-1 overflow-y-auto">
          <HelpView />
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
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              resaTarifs={allResaTarifs}
              catalogue={catalogue}
              onUpdateCatalogueItem={updateCatalogueItem}
              coutsMap={allCoutsMap}
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
        mode !== "direction" && (
          <div className="flex flex-1 items-center justify-center text-neutral-400">
            Bientôt disponible.
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
