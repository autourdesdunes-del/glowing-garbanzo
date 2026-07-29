"use client";

import { CatalogueItem, Client, Reservation, ReservationOption } from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export default function DirectionView({
  clients,
  reservations,
  resaOptions,
  catalogue,
  onUpdateCatalogueItem,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  catalogue: CatalogueItem[];
  onUpdateCatalogueItem: (id: string, patch: Partial<CatalogueItem>) => void;
}) {
  const rows = reservations.map((r) => {
    const client = clients.find((c) => c.id === r.client_id);
    const total = resaTotalMontant(r, client as Client, resaOptions[r.id] || []);
    const cout = Number(r.cout_reel) || 0;
    return {
      nom: r.nom_activite || "Sans nom",
      date: r.date_debut,
      total,
      marge: total - cout,
      clientNom: client?.nom || "Sans nom",
    };
  });

  const byMonth: Record<string, number> = {};
  const byYear: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.date) return;
    byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + r.total;
    byYear[r.date.slice(0, 4)] = (byYear[r.date.slice(0, 4)] || 0) + r.total;
  });

  const byActivite: Record<string, { count: number; total: number; marge: number }> = {};
  rows.forEach((r) => {
    if (!byActivite[r.nom]) byActivite[r.nom] = { count: 0, total: 0, marge: 0 };
    byActivite[r.nom].count += 1;
    byActivite[r.nom].total += r.total;
    byActivite[r.nom].marge += r.marge;
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Vue direction</h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-white p-4 text-center">
          <p className="text-xs text-neutral-500">CA total</p>
          <p className="font-amounts text-xl font-semibold text-[#5C2A1D]">{euros(caTotal)} €</p>
        </div>
        <div className="rounded-md bg-white p-4 text-center">
          <p className="text-xs text-neutral-500">Marge totale</p>
          <p className="font-amounts text-xl font-semibold text-[#5C2A1D]">{euros(margeTotal)} €</p>
        </div>
        <div className="rounded-md bg-white p-4 text-center">
          <p className="text-xs text-neutral-500">Marge %</p>
          <p className="font-amounts text-xl font-semibold text-[#5C2A1D]">{margePct}%</p>
        </div>
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-[#5C2A1D]">
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
              <span className="flex-1 font-medium text-[#5C2A1D]">{a.nom || "Sans nom"}</span>
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
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">CA par mois</h3>
        {Object.keys(byMonth).length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore de données datées.</div>
        )}
        <div className="space-y-1">
          {Object.entries(byMonth)
            .sort()
            .reverse()
            .map(([m, v]) => (
              <div
                key={m}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
              >
                <span className="font-amounts text-neutral-500">{m}</span>
                <span>{euros(v)} €</span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">CA par année</h3>
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
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">Activités les plus vendues</h3>
        {topVendues.length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore d&apos;activités vendues.</div>
        )}
        <div className="space-y-1">
          {topVendues.map(([nom, d]) => (
            <div
              key={nom}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{nom}</strong> — {d.count} vente(s)
              </span>
              <span>{euros(d.total)} €</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">Activités les plus rentables</h3>
        {topRentables.length === 0 && (
          <div className="text-sm text-neutral-400">Pas encore de données de coût.</div>
        )}
        <div className="space-y-1">
          {topRentables.map(([nom, d]) => (
            <div
              key={nom}
              className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
            >
              <span>
                <strong>{nom}</strong>
              </span>
              <span>{euros(d.marge)} € de marge</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">Plus gros clients</h3>
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
