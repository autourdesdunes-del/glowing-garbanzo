"use client";

import { useMemo, useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { cleanActivityTitle, participantsFor, reservationsActives } from "@/lib/resa";
import { localDateStr } from "@/lib/dates";

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

type ReservationDetail = {
  clientNom: string;
  date: string;
  nbAd: number;
  nbEnf: number;
  nbBebe: number;
};

type ActiviteAgg = {
  nom: string;
  reservationsCount: number;
  nbAd: number;
  nbEnf: number;
  nbBebe: number;
  details: ReservationDetail[];
};

export default function RecapMoisView({
  reservations,
  clients,
}: {
  reservations: Reservation[];
  clients: Client[];
}) {
  const clientById = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  const monthsAvailable = useMemo(() => {
    const set = new Set<string>();
    reservations.forEach((r) => {
      if (r.date_debut) set.add(monthKey(r.date_debut));
    });
    // Toujours proposer le mois en cours, même sans activité dedans encore.
    set.add(monthKey(localDateStr(new Date())));
    return Array.from(set).sort().reverse();
  }, [reservations]);

  const [mois, setMois] = useState(monthsAvailable[0] || monthKey(localDateStr(new Date())));
  const [activiteFiltre, setActiviteFiltre] = useState<string>("toutes");

  const reservationsDuMois = useMemo(
    () =>
      reservationsActives(reservations).filter(
        (r) =>
          r.date_debut &&
          monthKey(r.date_debut) === mois &&
          // Un prospect non confirmé n'a jamais de vraie activité à
          // récupérer auprès d'un prestataire (incident vécu, 2026-10-19).
          clientById[r.client_id]?.statut === "Client confirmé"
      ),
    [reservations, mois, clientById]
  );

  const parActivite = useMemo(() => {
    const map: Record<string, ActiviteAgg> = {};
    reservationsDuMois.forEach((r) => {
      const nom = cleanActivityTitle(r.nom_activite) || "(sans nom)";
      const client = clientById[r.client_id];
      if (!map[nom]) {
        map[nom] = { nom, reservationsCount: 0, nbAd: 0, nbEnf: 0, nbBebe: 0, details: [] };
      }
      const agg = map[nom];
      agg.reservationsCount += 1;
      let nbAd = 0;
      let nbEnf = 0;
      let nbBebe = 0;
      if (client) {
        const p = participantsFor(r, client);
        nbAd = p.nbAd + p.nbAcc;
        nbEnf = p.nbEnf + p.nbEnf3;
        nbBebe = p.nbBebe;
      }
      agg.nbAd += nbAd;
      agg.nbEnf += nbEnf;
      agg.nbBebe += nbBebe;
      agg.details.push({
        clientNom: client?.nom || "—",
        date: r.date_debut || "",
        nbAd,
        nbEnf,
        nbBebe,
      });
    });
    Object.values(map).forEach((a) => a.details.sort((x, y) => x.date.localeCompare(y.date)));
    return Object.values(map).sort((a, b) => b.nbAd + b.nbEnf + b.nbBebe - (a.nbAd + a.nbEnf + a.nbBebe));
  }, [reservationsDuMois, clientById]);

  const activitesOptions = useMemo(() => parActivite.map((a) => a.nom), [parActivite]);
  const visibleActivites =
    activiteFiltre === "toutes" ? parActivite : parActivite.filter((a) => a.nom === activiteFiltre);

  const totalAd = parActivite.reduce((s, a) => s + a.nbAd, 0);
  const totalEnf = parActivite.reduce((s, a) => s + a.nbEnf, 0);
  const totalBebe = parActivite.reduce((s, a) => s + a.nbBebe, 0);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (nom: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      return next;
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Récap du mois</h1>
        <p className="mt-1.5 text-sm text-[#666666]">
          Combien de personnes envoyées, par activité — détail adultes / enfants / bébés.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={mois}
          onChange={(e) => setMois(e.target.value)}
          className="rounded-[8px] border border-[#eaeaea] bg-white px-3 py-2 text-sm"
        >
          {monthsAvailable.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={activiteFiltre}
          onChange={(e) => setActiviteFiltre(e.target.value)}
          className="rounded-[8px] border border-[#eaeaea] bg-white px-3 py-2 text-sm"
        >
          <option value="toutes">Toutes les activités</option>
          {activitesOptions.map((nom) => (
            <option key={nom} value={nom}>
              {nom}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="rounded-[10px] border border-[#eaeaea] bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">Adultes</div>
          <div className="font-heading text-xl font-semibold text-[#171717]">{totalAd}</div>
        </div>
        <div className="rounded-[10px] border border-[#eaeaea] bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">Enfants</div>
          <div className="font-heading text-xl font-semibold text-[#171717]">{totalEnf}</div>
        </div>
        <div className="rounded-[10px] border border-[#eaeaea] bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">Bébés</div>
          <div className="font-heading text-xl font-semibold text-[#171717]">{totalBebe}</div>
        </div>
      </div>

      {visibleActivites.length === 0 ? (
        <p className="text-sm text-[#666666]">Aucune activité sur ce mois.</p>
      ) : (
        <div className="space-y-3">
          {visibleActivites.map((a) => {
            const isOpen = expanded.has(a.nom);
            return (
              <div key={a.nom} className="rounded-[10px] border border-[#eaeaea] bg-white">
                <button
                  onClick={() => toggleExpanded(a.nom)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
                >
                  <div className="flex items-center gap-2 font-medium text-[#171717]">
                    <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>
                      ›
                    </span>
                    {a.nom}
                  </div>
                  <div className="flex gap-4 text-sm text-[#666666]">
                    <span>
                      <strong className="text-[#171717]">{a.reservationsCount}</strong> réservation
                      {a.reservationsCount > 1 ? "s" : ""}
                    </span>
                    <span>
                      <strong className="text-[#171717]">{a.nbAd}</strong> adulte{a.nbAd > 1 ? "s" : ""}
                    </span>
                    <span>
                      <strong className="text-[#171717]">{a.nbEnf}</strong> enfant{a.nbEnf > 1 ? "s" : ""}
                    </span>
                    <span>
                      <strong className="text-[#171717]">{a.nbBebe}</strong> bébé{a.nbBebe > 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="space-y-1 border-t border-[#f0f0f0] p-4 pt-3 text-sm">
                    {a.details.map((d, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <span className="w-20 shrink-0 text-[#999999]">
                          {d.date ? new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR") : "—"}
                        </span>
                        <span className="text-[#171717]">{d.clientNom}</span>
                        <span className="text-[#666666]">
                          {d.nbAd} adulte{d.nbAd > 1 ? "s" : ""}
                          {d.nbEnf > 0 ? `, ${d.nbEnf} enfant${d.nbEnf > 1 ? "s" : ""}` : ""}
                          {d.nbBebe > 0 ? `, ${d.nbBebe} bébé${d.nbBebe > 1 ? "s" : ""}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
