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
import CatalogueView from "@/components/CatalogueView";
import PlanningView from "@/components/PlanningView";
import SuivisView from "@/components/SuivisView";

type Mode = "team" | "catalogue" | "suivis" | "planning" | "preview" | "direction";

const TABS: { key: Mode; label: string }[] = [
  { key: "team", label: "Vue équipe" },
  { key: "catalogue", label: "Catalogue" },
  { key: "suivis", label: "Suivis" },
  { key: "planning", label: "Réservations" },
  { key: "preview", label: "Aperçu client" },
  { key: "direction", label: "Direction" },
];

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function AppShell({ userEmail }: { userEmail: string }) {
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
    if (mode !== "planning" && mode !== "suivis") return;
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
  }, [mode, supabase]);

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
      if (!error) setTimeout(() => setSaveState("idle"), 1000);
    },
    [supabase]
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
    }
  };

  const deleteClient = async (id: string) => {
    const next = clients.filter((c) => c.id !== id);
    setClients(next);
    if (selectedId === id) setSelectedId(next[0] ? next[0].id : null);
    await supabase.from("clients").delete().eq("id", id);
  };

  const updateClientById = async (id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("clients").update(patch).eq("id", id);
  };

  const addCatalogueItem = async () => {
    const { data, error } = await supabase
      .from("catalogue_activites")
      .insert({})
      .select()
      .single();
    if (!error && data) setCatalogue((prev) => [data as CatalogueItem, ...prev]);
  };

  const updateCatalogueItem = async (id: string, patch: Partial<CatalogueItem>) => {
    setCatalogue((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await supabase.from("catalogue_activites").update(patch).eq("id", id);
  };

  const deleteCatalogueItem = async (id: string) => {
    setCatalogue((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("catalogue_activites").delete().eq("id", id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#5C2A1D]">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F2E6D2]">
      <header className="flex items-center justify-between border-b border-[#8B4531]/20 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5C2A1D] font-semibold text-[#F2E6D2]">
            AD
          </div>
          <div>
            <div className="font-heading text-sm font-semibold text-[#5C2A1D]">
              Autour des Dunes — Espace interne
            </div>
            <div className="text-xs text-neutral-500">
              {saveState === "saving"
                ? "Enregistrement…"
                : "Données partagées entre l'équipe"}
            </div>
          </div>
        </div>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                mode === t.key
                  ? "bg-[#0F5C56] text-white"
                  : "text-[#5C2A1D] hover:bg-[#F2E6D2]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-[#8B4531]/30 px-3 py-1.5 text-[#5C2A1D] hover:bg-[#F2E6D2]"
          >
            Déconnexion
          </button>
        </div>
      </header>

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
            <div className="p-6 text-neutral-400">Chargement…</div>
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
            <div className="p-6 text-neutral-400">Chargement…</div>
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

      {mode !== "team" &&
        mode !== "catalogue" &&
        mode !== "planning" &&
        mode !== "suivis" && (
          <div className="flex flex-1 items-center justify-center text-neutral-400">
            Bientôt disponible.
          </div>
        )}
    </div>
  );
}
