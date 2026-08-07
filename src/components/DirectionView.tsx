"use client";

import { useMemo, useState } from "react";
import { CatalogueItem, Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import MonthlyBarChart from "@/components/charts/MonthlyBarChart";
import { todayStr } from "@/lib/dates";
import { generateMonthlyReport } from "@/lib/generateMonthlyReport";

const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MOIS_FR[Number(m) - 1]} ${y}`;
}
function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell);
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";")
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DirectionView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  catalogue,
  onUpdateCatalogueItem,
  coutsMap,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  catalogue: CatalogueItem[];
  onUpdateCatalogueItem: (id: string, patch: Partial<CatalogueItem>) => void;
  coutsMap: Record<string, number>;
}) {
  const currentMonth = todayStr().slice(0, 7);
  const monthOptions = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    reservations.forEach((r) => {
      if (r.date_debut) set.add(r.date_debut.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [reservations, currentMonth]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [customRange, setCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
  const [dateTo, setDateTo] = useState(`${currentMonth}-${String(lastDayOfMonth(currentMonth)).padStart(2, "0")}`);

  const pickMonth = (ym: string) => {
    setSelectedMonth(ym);
    setCustomRange(false);
    setDateFrom(`${ym}-01`);
    setDateTo(`${ym}-${String(lastDayOfMonth(ym)).padStart(2, "0")}`);
  };

  const inRange = (date: string | null) => {
    if (!date) return !dateFrom && !dateTo;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  };

  const rows = reservations
    .filter((r) => inRange(r.date_debut))
    .map((r) => {
      const client = clients.find((c) => c.id === r.client_id);
      const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
      const cout = Number(coutsMap[r.id]) || 0;
      // Groupe par modèle catalogue quand la réservation en vient (le nom
      // catalogue à jour prime), sinon par nom d'activité saisi à la main.
      const catalogueMatch = r.catalogue_item_id
        ? catalogue.find((a) => a.id === r.catalogue_item_id)
        : null;
      return {
        groupKey: r.catalogue_item_id || `manuel:${r.nom_activite || "Sans nom"}`,
        nom: catalogueMatch?.nom || r.nom_activite || "Sans nom",
        date: r.date_debut,
        total,
        marge: total - cout,
        clientNom: client?.nom || "Sans nom",
      };
    });

  const exportCsv = () => {
    downloadCsv(
      `direction-${dateFrom || "debut"}_${dateTo || "fin"}.csv`,
      [
        ["Activité", "Date", "Client", "Total (€)", "Marge (€)"],
        ...rows.map((r) => [r.nom, r.date || "", r.clientNom, r.total, r.marge]),
      ]
    );
  };

  const byMonth: Record<string, number> = {};
  const byYear: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.date) return;
    byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + r.total;
    byYear[r.date.slice(0, 4)] = (byYear[r.date.slice(0, 4)] || 0) + r.total;
  });

  const byActivite: Record<string, { nom: string; count: number; total: number; marge: number }> =
    {};
  rows.forEach((r) => {
    if (!byActivite[r.groupKey]) {
      byActivite[r.groupKey] = { nom: r.nom, count: 0, total: 0, marge: 0 };
    }
    byActivite[r.groupKey].count += 1;
    byActivite[r.groupKey].total += r.total;
    byActivite[r.groupKey].marge += r.marge;
  });
  const topVendues = Object.entries(byActivite).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const topRentables = Object.entries(byActivite)
    .sort((a, b) => b[1].marge - a[1].marge)
    .slice(0, 8);

  const byClient: Record<string, number> = {};
  rows.forEach((r) => {
    byClient[r.clientNom] = (byClient[r.clientNom] || 0) + r.total;
  });
  const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const caTotal = rows.reduce((s, r) => s + r.total, 0);
  const margeTotal = rows.reduce((s, r) => s + r.marge, 0);
  const margePct = caTotal > 0 ? Math.round((margeTotal / caTotal) * 100) : 0;

  const exportPdf = () => {
    generateMonthlyReport({
      periodeLabel: customRange
        ? `${dateFrom || "début"} → ${dateTo || "fin"}`
        : monthLabel(selectedMonth),
      caTotal,
      margeTotal,
      margePct,
      topVentes: topVendues.map(([, d]) => ({ nom: d.nom, count: d.count, total: d.total })),
      topRentables: topRentables.map(([, d]) => ({ nom: d.nom, marge: d.marge })),
      topClients: topClients.map(([nom, total]) => ({ nom, total })),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Vue direction</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-500">
            Mois
            <select
              value={customRange ? "custom" : selectedMonth}
              onChange={(e) => {
                if (e.target.value === "custom") setCustomRange(true);
                else pickMonth(e.target.value);
              }}
              className="input mt-1 block"
            >
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {monthLabel(ym)}
                </option>
              ))}
              <option value="custom">Personnalisé…</option>
            </select>
          </label>
          {customRange && (
            <>
              <label className="text-xs text-neutral-500">
                Du
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input mt-1 block"
                />
              </label>
              <label className="text-xs text-neutral-500">
                Au
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input mt-1 block"
                />
              </label>
            </>
          )}
          <button
            onClick={exportPdf}
            className="rounded-md bg-[#666666] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Rapport PDF
          </button>
          <button
            onClick={exportCsv}
            className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Exporter en CSV
          </button>
        </div>
      </div>
      <p className="-mt-5 text-xs text-neutral-400">
        Rapport figé au moment de l&apos;export — les chiffres à l&apos;écran, eux, se
        recalculent en direct.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="CA total" value={`${euros(caTotal)} €`} />
        <StatTile label="Marge totale" value={`${euros(margeTotal)} €`} />
        <StatTile label="Marge" value={`${margePct}%`} />
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-[#171717]">
          Marge de référence par activité (catalogue)
        </h3>
        <p className="mb-2 text-xs text-neutral-500">
          Note indicative par type d&apos;activité — la marge réelle par dossier reste calculée
          depuis le &quot;Coût réel&quot; saisi sur chaque réservation.
        </p>
        {catalogue.length === 0 && (
          <div className="text-sm text-neutral-400">Aucune activité dans le catalogue.</div>
        )}
        <div className="space-y-2">
          {catalogue.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-2 text-sm"
            >
              <span className="flex-1 font-medium text-[#171717]">{a.nom || "Sans nom"}</span>
              <input
                type="number"
                value={a.marge_pct}
                onChange={(e) =>
                  onUpdateCatalogueItem(a.id, { marge_pct: Number(e.target.value) })
                }
                className="input max-w-[90px]"
              />
              <span className="text-neutral-500">% de marge visée</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">CA par mois</h3>
        <MonthlyBarChart
          data={Object.entries(byMonth)
            .sort()
            .map(([m, v]) => ({ label: m.slice(2), value: v }))}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">CA par année</h3>
        <div className="space-y-1">
          {Object.entries(byYear)
            .sort()
            .reverse()
            .map(([y, v]) => (
              <div
                key={y}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
              >
                <span className="font-amounts text-neutral-500">{y}</span>
                <span>{euros(v)} €</span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Activités les plus vendues</h3>
        {topVendues.length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore d&apos;activités vendues.</div>
        )}
        <div className="space-y-1">
          {topVendues.map(([key, d]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{d.nom}</strong> — {d.count} vente(s)
              </span>
              <span>{euros(d.total)} €</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Activités les plus rentables</h3>
        {topRentables.length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore de données de coût.</div>
        )}
        <div className="space-y-1">
          {topRentables.map(([key, d]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{d.nom}</strong>
              </span>
              <span>{euros(d.marge)} € de marge</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Plus gros clients</h3>
        {topClients.length === 0 && (
          <div className="text-sm text-neutral-400">
            Pas encore de clients avec activités.
          </div>
        )}
        <div className="space-y-1">
          {topClients.map(([nom, total]) => (
            <div
              key={nom}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{nom}</strong>
              </span>
              <span>{euros(total)} €</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="font-amounts mt-1 text-2xl font-semibold text-[#171717]">{value}</p>
    </div>
  );
}
