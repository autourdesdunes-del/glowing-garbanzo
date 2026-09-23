"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActivityLogEntry, Client, Profile } from "@/lib/types";
import { localDateStr, addDays } from "@/lib/dates";
import { ACTION_ICONS, ACTION_STYLES, actionLabel, fmtDateTime, tableLabel } from "@/lib/suiviStepFormat";

// Vue Direction uniquement : tout ce qui a été fait sur les fiches
// clients/réservations/paiements, journée par journée, tous employés
// confondus — demande de Mélanie (2026-09-23) suite à des cas où elle
// n'arrivait pas à savoir qui avait fait quelle manip. Complète
// l'historique par-fiche (client-steps.tsx) en donnant une vue globale
// filtrable par jour et par employée.
function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function JournalActiviteView({
  clients,
  teamProfiles,
  onOpenClient,
}: {
  clients: Client[];
  teamProfiles: Profile[];
  onOpenClient: (id: string) => void;
}) {
  const [date, setDate] = useState(localDateStr(new Date()));
  const [employeFiltre, setEmployeFiltre] = useState<string>("");
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const startIso = new Date(`${date}T00:00:00`).toISOString();
      const endIso = new Date(`${addDays(date, 1)}T00:00:00`).toISOString();
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(1000);
      setEntries((data as ActivityLogEntry[]) || []);
      setLoading(false);
    })();
  }, [date]);

  const prenomFor = (email: string | null) => {
    if (!email) return null;
    return teamProfiles.find((p) => p.email.toLowerCase() === email.toLowerCase())?.prenom || null;
  };

  const employesDuJour = Array.from(
    new Set(entries.map((e) => e.actor_email).filter((e): e is string => !!e))
  ).sort();

  const filtered = employeFiltre ? entries.filter((e) => e.actor_email === employeFiltre) : entries;

  const clientNom = (id: string | null) => (id ? clients.find((c) => c.id === id)?.nom || null : null);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Journal d&apos;activité</h1>
        <p className="mt-1 text-sm text-[#666666]">
          Tout ce qui a été fait sur les fiches clients, réservations et paiements — filtrable par jour et par
          employée.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input max-w-[180px]"
        />
        <select
          value={employeFiltre}
          onChange={(e) => setEmployeFiltre(e.target.value)}
          className="input max-w-[220px]"
        >
          <option value="">Tout le monde</option>
          {employesDuJour.map((email) => (
            <option key={email} value={email}>
              {prenomFor(email) || email}
            </option>
          ))}
        </select>
        <span className="text-sm text-neutral-500">
          {loading ? "Chargement…" : `${filtered.length} action(s)`}
        </span>
      </div>

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-neutral-400">Rien à signaler pour cette journée.</p>
      )}

      <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
        {filtered.map((entry) => {
          const changesCount = entry.changes ? Object.keys(entry.changes).length : 0;
          const isExpanded = expandedId === entry.id;
          const nom = clientNom(entry.client_id);
          return (
            <div key={entry.id} className="px-4 py-3 text-sm">
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] ${ACTION_STYLES[entry.action]}`}
                >
                  {ACTION_ICONS[entry.action]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[#171717]">
                    <span className="font-semibold">{prenomFor(entry.actor_email) || entry.actor_email || "Système (Kommo/sync)"}</span>{" "}
                    {entry.description || `${actionLabel(entry.action)} ${tableLabel(entry.table_name)}`}
                    {nom && entry.client_id && (
                      <>
                        {" — "}
                        <button
                          onClick={() => onOpenClient(entry.client_id!)}
                          className="font-medium text-[#8B4531] hover:underline"
                        >
                          {nom}
                        </button>
                      </>
                    )}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                    <span>{fmtDateTime(entry.created_at)}</span>
                    {changesCount > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="font-medium text-[#0F5C56] hover:underline"
                      >
                        {isExpanded ? "Masquer le détail" : `Voir le détail (${changesCount} champ${changesCount > 1 ? "s" : ""})`}
                      </button>
                    )}
                  </div>
                  {isExpanded && entry.changes && (
                    <div className="mt-2 space-y-1 rounded-md bg-[#fafafa] p-2.5 text-xs">
                      {Object.entries(entry.changes).map(([field, { old, new: newVal }]) => (
                        <div key={field} className="flex flex-wrap items-baseline gap-1.5">
                          <span className="font-mono text-neutral-500">{field}</span>
                          <span className="text-neutral-400">:</span>
                          <span className="text-red-600 line-through">{formatValue(old)}</span>
                          <span className="text-neutral-400">→</span>
                          <span className="font-medium text-green-700">{formatValue(newVal)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
