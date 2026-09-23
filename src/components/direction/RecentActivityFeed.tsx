"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActivityLogEntry, Client, Profile } from "@/lib/types";
import { actionLabel, fmtDateTime, tableLabel } from "@/lib/suiviStepFormat";

// Mini version de JournalActiviteView (les 6 dernières actions, tous
// employés/clients confondus, sans filtre) — pour la Vue d'ensemble du
// tableau de bord Direction, façon "Team Activity" (maquette Mélanie,
// 2026-09-23). Le Journal d'activité complet reste l'endroit pour tout
// détailler/filtrer par jour.
export default function RecentActivityFeed({
  clients,
  teamProfiles,
  onOpenClient,
}: {
  clients: Client[];
  teamProfiles: Profile[];
  onOpenClient: (id: string) => void;
}) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      setEntries((data as ActivityLogEntry[]) || []);
    })();
  }, []);

  const prenomFor = (email: string | null) => {
    if (!email) return "Système";
    return teamProfiles.find((p) => p.email.toLowerCase() === email.toLowerCase())?.prenom || email;
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 && <p className="text-sm text-neutral-400">Rien pour l&apos;instant.</p>}
      {entries.map((entry) => {
        const nom = entry.client_id ? clients.find((c) => c.id === entry.client_id)?.nom : null;
        return (
          <div key={entry.id} className="flex items-start gap-2.5 text-sm">
            <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#171717] text-[10px] font-medium text-white">
              {prenomFor(entry.actor_email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[#171717]">
                <span className="font-medium">{prenomFor(entry.actor_email)}</span>{" "}
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
              <p className="text-xs text-neutral-400">{fmtDateTime(entry.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
