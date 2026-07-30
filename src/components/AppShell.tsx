"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueItem,
  Client,
  EMPTY_CLIENT,
  Remboursement,
  Reservation,
  ReservationOption,
} from "@/lib/types";
import { STATUT_COLORS } from "@/lib/constants";
import ClientDetail from "@/components/ClientDetail";
import ChangePasswordButton from "@/components/ChangePasswordButton";
import CatalogueView from "@/components/CatalogueView";
import PlanningView from "@/components/PlanningView";
import SuivisView from "@/components/SuivisView";
import ClientPreviewView from "@/components/ClientPreviewView";
import DirectionView from "@/components/DirectionView";
import ConfirmProvider, { useConfirm } from "@/components/ConfirmProvider";
import ToastProvider, { useToast } from "@/components/ToastProvider";
import Spinner from "@/components/Spinner";

const DIRECTOR_PIN = "2026";

type Mode = "team" | "catalogue" | "suivis" | "planning" | "preview" | "direction";

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

const TABS: { key: Mode; label: string; icon: () => React.ReactElement }[] = [
  { key: "team", label: "Vue équipe", icon: IconUsers },
  { key: "catalogue", label: "Catalogue", icon: IconBook },
  { key: "suivis", label: "Suivis", icon: IconChecklist },
  { key: "planning", label: "Réservations", icon: IconCalendar },
  { key: "preview", label: "Aperçu client", icon: IconEye },
  { key: "direction", label: "Direction", icon: IconShield },
];

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function AppShell({ userEmail }: { userEmail: string }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShellInner userEmail={userEmail} />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function AppShellInner({ userEmail }: { userEmail: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("team");
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [allResaOptions, setAllResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [planningLoaded, setPlanningLoaded] = useState(false);
  const [allRemboursements, setAllRemboursements] = useState<Remboursement[]>([]);
  const [suivisLoaded, setSuivisLoaded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [directionUnlocked, setDirectionUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: cat, error: catError }] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase
          .from("catalogue_activites")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (!error && data) {
        setClients(data as Client[]);
        if (data.length && !selectedId) setSelectedId(data[0].id);
      }
      if (!catError && cat) setCatalogue(cat as CatalogueItem[]);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "planning" && mode !== "suivis" && mode !== "direction") return;
    // Direction shows revenue/margin data — don't even fetch it into the
    // browser until the PIN has been entered, not just hide it visually.
    if (mode === "direction" && !directionUnlocked) return;
    (async () => {
      const { data: resas } = await supabase.from("reservations").select("*");
      const list = (resas as Reservation[]) || [];
      setAllReservations(list);
      if (list.length) {
        const { data: opts } = await supabase
          .from("reservation_options")
          .select("*")
          .in(
            "reservation_id",
            list.map((r) => r.id)
          );
        const grouped: Record<string, ReservationOption[]> = {};
        ((opts as ReservationOption[]) || []).forEach((o) => {
          grouped[o.reservation_id] = [...(grouped[o.reservation_id] || []), o];
        });
        setAllResaOptions(grouped);
      } else {
        setAllResaOptions({});
      }
      setPlanningLoaded(true);

      if (mode === "suivis") {
        const { data: rembs } = await supabase.from("remboursements").select("*");
        setAllRemboursements((rembs as Remboursement[]) || []);
        setSuivisLoaded(true);
      }
    })();
  }, [mode, supabase, directionUnlocked]);

  const filtered = clients.filter((c) =>
    (c.nom || "").toLowerCase().includes(query.toLowerCase())
  );
  const selected = clients.find((c) => c.id === selectedId) || null;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<Client>>({});

  const flushSave = useCallback(
    async (id: string) => {
      const patch = pendingPatch.current;
      pendingPatch.current = {};
      if (Object.keys(patch).length === 0) return;
      setSaveState("saving");
      const { error } = await supabase.from("clients").update(patch).eq("id", id);
      setSaveState(error ? "error" : "saved");
      if (error) {
        toast("Échec de l'enregistrement — vérifie ta connexion et réessaie.");
      } else {
        setTimeout(() => setSaveState("idle"), 1000);
      }
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
    saveTimer.current = setTimeout(() => flushSave(selected.id), 600);
  };

  const addClient = async () => {
    const { data, error } = await supabase
      .from("clients")
      .insert(EMPTY_CLIENT)
      .select()
      .single();
    if (!error && data) {
      setClients((prev) => [data as Client, ...prev]);
      setSelectedId(data.id);
    } else {
      toast("Impossible de créer le client.");
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2E6D2]">
        <Spinner />
      </div>
    );
  }

  const currentTab = TABS.find((t) => t.key === mode);

  return (
    <div className="flex min-h-screen bg-[#F2E6D2]">
      <aside className="flex w-56 flex-shrink-0 flex-col bg-[#5C2A1D]">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C9973E] text-sm font-semibold text-white">
            AD
          </div>
          <div className="min-w-0">
            <div className="font-heading truncate text-sm font-semibold text-white">
              Autour des Dunes
            </div>
            <div className="truncate text-[11px] text-white/50">Espace interne</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = mode === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setMode(t.key);
                  if (t.key === "preview" && !previewId && clients[0]) setPreviewId(clients[0].id);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-2.5 py-3">
          <div
            className={`px-2.5 pb-2 text-[11px] transition-opacity ${
              saveState === "saving" ? "text-[#C9973E] opacity-100" : "text-white/40 opacity-100"
            }`}
          >
            {saveState === "saving" ? "Enregistrement…" : "Données synchronisées"}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#8B4531]/15 bg-white px-6 py-3">
          <h1 className="font-heading text-base font-semibold text-[#5C2A1D]">
            {currentTab?.label}
          </h1>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span className="max-w-[220px] truncate">{userEmail}</span>
            <ChangePasswordButton />
            <button
              onClick={handleSignOut}
              className="rounded-md border border-[#8B4531]/30 px-3 py-1.5 text-[#5C2A1D] hover:bg-[#F2E6D2]"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
      {mode === "team" && (
        <div className="flex flex-1">
          <aside className="flex w-72 flex-col border-r border-[#8B4531]/20 bg-white">
            <div className="flex gap-2 border-b border-[#8B4531]/10 p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un client…"
                className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-[#0F5C56] focus:outline-none"
              />
              <button
                onClick={addClient}
                className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                + Nouveau
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-4 text-sm text-neutral-400">Aucun client.</div>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`block w-full border-b border-[#8B4531]/10 px-4 py-3 text-left ${
                    c.id === selectedId ? "bg-[#F2E6D2]" : "hover:bg-[#F2E6D2]/50"
                  }`}
                >
                  <div className="font-medium text-[#5C2A1D]">
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
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-6">
            {!selected ? (
              <div className="text-neutral-400">
                Sélectionne ou crée un client pour commencer.
              </div>
            ) : (
              <ClientDetail
                client={selected}
                onChange={updateSelected}
                onDelete={() => deleteClient(selected.id)}
                catalogue={catalogue}
              />
            )}
          </main>
        </div>
      )}

      {mode === "catalogue" && (
        <div className="flex-1 overflow-y-auto">
          <CatalogueView
            items={catalogue}
            onAdd={addCatalogueItem}
            onUpdate={updateCatalogueItem}
            onDelete={deleteCatalogueItem}
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
              onOpenClient={(id) => {
                setSelectedId(id);
                setMode("team");
              }}
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
              clients={clients}
              reservations={allReservations}
              remboursements={allRemboursements}
              onUpdateClient={updateClientById}
              onOpenClient={(id) => {
                setSelectedId(id);
                setMode("team");
              }}
            />
          )}
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

      {mode === "direction" && (
        <div className="flex-1 overflow-y-auto">
          {!directionUnlocked ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="w-full max-w-xs rounded-md bg-white p-6 text-center">
                <p className="mb-3 text-sm text-neutral-600">
                  Accès direction — code requis
                </p>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pinInput === DIRECTOR_PIN) {
                      setDirectionUnlocked(true);
                    }
                  }}
                  className="input mb-3 w-full text-center"
                  placeholder="Code"
                />
                <button
                  onClick={() => {
                    if (pinInput === DIRECTOR_PIN) setDirectionUnlocked(true);
                  }}
                  className="w-full rounded-md bg-[#0F5C56] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Déverrouiller
                </button>
              </div>
            </div>
          ) : !planningLoaded ? (
            <Spinner />
          ) : (
            <DirectionView
              clients={clients}
              reservations={allReservations}
              resaOptions={allResaOptions}
              catalogue={catalogue}
              onUpdateCatalogueItem={updateCatalogueItem}
            />
          )}
        </div>
      )}

      {mode !== "team" &&
        mode !== "catalogue" &&
        mode !== "planning" &&
        mode !== "suivis" &&
        mode !== "preview" &&
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
