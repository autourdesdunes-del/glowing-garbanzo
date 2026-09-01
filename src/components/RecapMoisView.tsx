"use client";

import { useMemo, useState } from "react";
import { Client, PaiementEtape, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import {
  activitePaiementWarning,
  cleanActivityTitle,
  participantsFor,
  reservationsActives,
} from "@/lib/resa";
import { localDateStr } from "@/lib/dates";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

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
  pax: number;
  montant: number | null;
  devise: "€" | "EGP" | null;
};

type ActiviteAgg = {
  nom: string;
  reservationsCount: number;
  pax: number;
  montantEur: number;
  montantEgp: number;
  // Une ligne par réservation (pas seulement celles avec un montant à
  // récupérer) — pour dérouler et vérifier "tel client, telle date" avec
  // le prestataire.
  details: ReservationDetail[];
};

export default function RecapMoisView({
  reservations,
  clients,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
}: {
  reservations: Reservation[];
  clients: Client[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
}) {
  const clientById = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  const etapesByClient = useMemo(() => {
    const m: Record<string, PaiementEtape[]> = {};
    paiementsEtapes.forEach((e) => {
      m[e.client_id] = [...(m[e.client_id] || []), e];
    });
    return m;
  }, [paiementsEtapes]);

  // activitePaiementWarning a besoin de TOUTES les réservations actives du
  // client (pas seulement celles du mois affiché) pour calculer le total du
  // séjour correctement — regroupées une fois ici, indépendamment du filtre
  // de mois appliqué plus bas.
  const reservationsParClient = useMemo(() => {
    const m: Record<string, Reservation[]> = {};
    reservationsActives(reservations).forEach((r) => {
      m[r.client_id] = [...(m[r.client_id] || []), r];
    });
    return m;
  }, [reservations]);

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
      reservationsActives(reservations).filter((r) => r.date_debut && monthKey(r.date_debut) === mois),
    [reservations, mois]
  );

  const parActivite = useMemo(() => {
    const map: Record<string, ActiviteAgg> = {};
    reservationsDuMois.forEach((r) => {
      const nom = cleanActivityTitle(r.nom_activite) || "(sans nom)";
      const client = clientById[r.client_id];
      if (!map[nom]) {
        map[nom] = { nom, reservationsCount: 0, pax: 0, montantEur: 0, montantEgp: 0, details: [] };
      }
      const agg = map[nom];
      agg.reservationsCount += 1;
      let pax = 0;
      let warning: { amount: number; devise: "€" | "EGP" } | null = null;
      if (client) {
        const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);
        pax = nbAd + nbEnf + nbAcc + nbEnf3;
        warning = activitePaiementWarning(
          client,
          r,
          reservationsParClient[client.id] || [],
          resaOptions,
          resaTarifs,
          etapesByClient[client.id] || []
        );
      }
      agg.pax += pax;
      if (warning) {
        if (warning.devise === "EGP") agg.montantEgp += warning.amount;
        else agg.montantEur += warning.amount;
      }
      agg.details.push({
        clientNom: client?.nom || "—",
        date: r.date_debut || "",
        pax,
        montant: warning?.amount ?? null,
        devise: warning?.devise ?? null,
      });
    });
    Object.values(map).forEach((a) => a.details.sort((x, y) => x.date.localeCompare(y.date)));
    return Object.values(map).sort((a, b) => b.pax - a.pax);
  }, [reservationsDuMois, clientById, reservationsParClient, resaOptions, resaTarifs, etapesByClient]);

  const activitesOptions = useMemo(() => parActivite.map((a) => a.nom), [parActivite]);
  const visibleActivites =
    activiteFiltre === "toutes" ? parActivite : parActivite.filter((a) => a.nom === activiteFiltre);

  const totalPax = parActivite.reduce((s, a) => s + a.pax, 0);
  const totalEur = parActivite.reduce((s, a) => s + a.montantEur, 0);
  const totalEgp = parActivite.reduce((s, a) => s + a.montantEgp, 0);

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
          Combien de personnes envoyées, et combien reste à récupérer sur place, par activité.
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
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">Personnes envoyées</div>
          <div className="font-heading text-xl font-semibold text-[#171717]">{totalPax}</div>
        </div>
        <div className="rounded-[10px] border border-[#eaeaea] bg-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">Reste à récupérer</div>
          <div className="font-heading text-xl font-semibold text-[#171717]">
            {totalEur > 0 ? `${euros(totalEur)} €` : ""}
            {totalEur > 0 && totalEgp > 0 ? " + " : ""}
            {totalEgp > 0 ? `${euros(totalEgp)} EGP` : ""}
            {totalEur === 0 && totalEgp === 0 ? "0 €" : ""}
          </div>
        </div>
      </div>

      <p className="text-xs text-[#999999]">
        Le montant à récupérer reprend le solde du séjour rattaché à cette activité précise (le même
        badge &quot;⚠️ à payer à l&apos;activité&quot; que sur la fiche client) — pas encore encaissé
        tant que le client n&apos;est pas marqué &quot;solde payé&quot;.
      </p>

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
                      <strong className="text-[#171717]">{a.pax}</strong> personnes
                    </span>
                    {a.montantEur > 0 && (
                      <span>
                        <strong className="text-[#171717]">{euros(a.montantEur)} €</strong> à récupérer
                      </span>
                    )}
                    {a.montantEgp > 0 && (
                      <span>
                        <strong className="text-[#171717]">{euros(a.montantEgp)} EGP</strong> à récupérer
                      </span>
                    )}
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
                        <span className="text-[#666666]">{d.pax} pers.</span>
                        {d.montant !== null && (
                          <span className="text-[#171717]">
                            {euros(d.montant)} {d.devise} à récupérer
                          </span>
                        )}
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
