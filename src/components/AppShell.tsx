"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Client, EMPTY_CLIENT } from "@/lib/types";
import {
  CANAUX,
  INFOS_MANQUANTES_OPTIONS,
  RELATIONS,
  STATUTS,
  STATUT_COLORS,
} from "@/lib/constants";

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
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setClients(data as Client[]);
        if (data.length && !selectedId) setSelectedId(data[0].id);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <ContactStep client={selected} onChange={updateSelected} />
            )}
          </main>
        </div>
      )}

      {mode !== "team" && (
        <div className="flex flex-1 items-center justify-center text-neutral-400">
          Bientôt disponible.
        </div>
      )}
    </div>
  );
}

function ContactStep({
  client,
  onChange,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
}) {
  const toggleInfoManquante = (opt: string) => {
    const has = client.infos_manquantes.includes(opt);
    onChange({
      infos_manquantes: has
        ? client.infos_manquantes.filter((o) => o !== opt)
        : [...client.infos_manquantes, opt],
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Contact</h2>

      <Field label="Nom du client">
        <input
          value={client.nom}
          onChange={(e) => onChange({ nom: e.target.value })}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Statut">
          <select
            value={client.statut}
            onChange={(e) => onChange({ statut: e.target.value })}
            className="input"
          >
            {STATUTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Contact via">
          <select
            value={client.canal}
            onChange={(e) => onChange({ canal: e.target.value })}
            className="input"
          >
            {CANAUX.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      {client.canal === "Autre" && (
        <Field label="Préciser le canal">
          <input
            value={client.canal_autre}
            onChange={(e) => onChange({ canal_autre: e.target.value })}
            className="input"
          />
        </Field>
      )}

      {(client.canal === "Instagram" || client.canal === "TikTok") && (
        <Field label="Pseudo">
          <input
            value={client.pseudo_contact}
            onChange={(e) => onChange({ pseudo_contact: e.target.value })}
            className="input"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Téléphone">
          <input
            value={client.telephone}
            onChange={(e) => onChange({ telephone: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            value={client.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Relation grâce à">
        <select
          value={client.relation_grace_a}
          onChange={(e) => onChange({ relation_grace_a: e.target.value })}
          className="input"
        >
          {RELATIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      {client.relation_grace_a === "Autre" && (
        <Field label="Préciser">
          <input
            value={client.relation_autre}
            onChange={(e) => onChange({ relation_autre: e.target.value })}
            className="input"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Hôtel">
          <input
            value={client.hotel}
            onChange={(e) => onChange({ hotel: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Chambre">
          <input
            value={client.chambre}
            onChange={(e) => onChange({ chambre: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date début séjour">
          <input
            type="date"
            value={client.date_debut ?? ""}
            onChange={(e) => onChange({ date_debut: e.target.value || null })}
            className="input"
          />
        </Field>
        <Field label="Date fin séjour">
          <input
            type="date"
            value={client.date_fin ?? ""}
            onChange={(e) => onChange({ date_fin: e.target.value || null })}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Adultes">
          <input
            type="number"
            min={0}
            value={client.adultes}
            onChange={(e) => onChange({ adultes: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Enfants">
          <input
            type="number"
            min={0}
            value={client.enfants}
            onChange={(e) => onChange({ enfants: Number(e.target.value) })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Âges des enfants">
        <input
          value={client.ages_enfants}
          onChange={(e) => onChange({ ages_enfants: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Lien passeport (Drive)">
        <input
          value={client.lien_passeport}
          onChange={(e) => onChange({ lien_passeport: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Infos manquantes">
        <div className="flex flex-wrap gap-2">
          {INFOS_MANQUANTES_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleInfoManquante(opt)}
              className={`rounded-full border px-3 py-1 text-xs ${
                client.infos_manquantes.includes(opt)
                  ? "border-[#C9973E] bg-[#C9973E] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Commentaires">
        <textarea
          value={client.commentaires}
          onChange={(e) => onChange({ commentaires: e.target.value })}
          className="input h-24"
        />
      </Field>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 0.375rem;
          padding: 0.4rem 0.6rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #0f5c56;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
