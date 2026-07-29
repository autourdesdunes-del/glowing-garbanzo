"use client";

import { useMemo, useState } from "react";
import { Client, Reservation, ReservationOption } from "@/lib/types";
import { participantsFor, resaTotalMontant } from "@/lib/resa";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function toStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function resaActiveOn(r: Reservation, dateStr: string) {
  if (!r.date_debut) return false;
  const end = r.date_fin || r.date_debut;
  return dateStr >= r.date_debut && dateStr <= end;
}
function rangesOverlap(rStart: string | null, rEnd: string | null, fStart: string, fEnd: string) {
  if (!rStart) return false;
  const end = rEnd || rStart;
  return rStart <= fEnd && end >= fStart;
}

const FILTERS = [
  { key: "hier", label: "Hier" },
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "demain", label: "Demain" },
  { key: "prochainement", label: "Prochainement" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "tout", label: "Tout" },
] as const;

export default function PlanningView({
  clients,
  reservations,
  resaOptions,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  onOpenClient: (clientId: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("aujourdhui");

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toStr(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const prochainStart = new Date(today);
    prochainStart.setDate(today.getDate() + 2);
    const prochainEnd = new Date(today);
    prochainEnd.setDate(today.getDate() + 8);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const rows: { client: Client; r: Reservation }[] = [];
    reservations.forEach((r) => {
      if (!r.date_debut) return;
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;

      let include = true;
      if (filter === "hier") include = resaActiveOn(r, toStr(yesterday));
      else if (filter === "aujourdhui") include = resaActiveOn(r, todayStr);
      else if (filter === "demain") include = resaActiveOn(r, toStr(tomorrow));
      else if (filter === "prochainement")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(prochainStart), toStr(prochainEnd));
      else if (filter === "mois")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(monthStart), toStr(monthEnd));
      if (!include) return;

      rows.push({ client, r });
    });

    rows.sort((a, b) => (a.r.date_debut || "").localeCompare(b.r.date_debut || ""));

    const byDate: Record<string, { client: Client; r: Reservation }[]> = {};
    rows.forEach((row) => {
      const key = row.r.date_debut as string;
      byDate[key] = [...(byDate[key] || []), row];
    });
    return { byDate, todayStr };
  }, [clients, reservations, filter]);

  const dateKeys = Object.keys(grouped.byDate).sort();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filter === f.key
                ? "border-[#0F5C56] bg-[#0F5C56] text-white"
                : "border-neutral-300 bg-white text-neutral-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {dateKeys.length === 0 && (
        <div className="text-sm text-neutral-400">Aucune activité sur cette période.</div>
      )}

      {dateKeys.map((date) => (
        <div key={date}>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#5C2A1D]">
            {fmtDate(date)}
            {date === grouped.todayStr ? " — aujourd'hui" : ""}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {grouped.byDate[date].map(({ client, r }) => {
              const options = resaOptions[r.id] || [];
              const total = resaTotalMontant(r, client, options);
              const { nbAd, nbEnf } = participantsFor(r, client);
              const soldeIci = client.solde_activite_id === r.id;
              const statutPaiement = soldeIci ? (client.solde_paye ? "Payé" : "À régler") : null;
              const infoStatut =
                client.infos_manquantes.length && !client.infos_manquantes.includes("Complet")
                  ? client.infos_manquantes[0]
                  : "Complet";

              return (
                <div
                  key={r.id}
                  onClick={() => onOpenClient(client.id)}
                  className="cursor-pointer rounded-md border border-[#8B4531]/20 bg-white p-3"
                >
                  <p className="font-medium text-[#5C2A1D]">
                    {r.nom_activite || "Activité"}
                    {soldeIci && !client.solde_paye && (
                      <span className="ml-2 text-xs text-red-600">⚠️ solde à régler ici</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {fmtDate(r.date_debut as string)}
                    {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""} ·{" "}
                    {r.moment}
                    {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
                  </p>
                  <p className="text-sm font-medium text-[#5C2A1D]">{client.nom || "Sans nom"}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    {soldeIci ? (
                      <span className="rounded-full bg-[#C9973E] px-2 py-0.5 text-xs text-white">
                        💰 Solde — {statutPaiement}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="font-amounts text-sm">{euros(total)} €</span>
                  </div>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                      infoStatut === "Complet"
                        ? "bg-[#0F5C56]/10 text-[#0F5C56]"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {infoStatut}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
