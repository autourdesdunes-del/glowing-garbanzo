"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Client,
  HotelReference,
  PaiementEtape,
  PaiementPrevu,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import {
  canonicalRecapActivityName,
  cleanActivityTitle,
  participantsFor,
  reservationsActives,
} from "@/lib/resa";
import { localDateStr } from "@/lib/dates";
import { generateRecapActiviteReport } from "@/lib/generateRecapActiviteReport";
import { ActivityDetailModal } from "@/components/planning/ActivityDetailModal";

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function normalizeSearch(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

type ReservationDetail = {
  client: Client;
  r: Reservation;
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
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  paiementsPrevus = [],
  onOpenClient,
  onOpenRdvPaiement,
  onUpdateReservation,
  onUpdateClient,
}: {
  reservations: Reservation[];
  clients: Client[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  paiementsPrevus?: PaiementPrevu[];
  onOpenClient: (clientId: string) => void;
  onOpenRdvPaiement: (clientId: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
}) {
  const clientById = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  // Chargée ici (comme PlanningView.tsx) plutôt que reçue en prop — évite
  // de faire remonter hotelsRef jusqu'à AppShell/DirectionView juste pour
  // le popup "Voir l'activité".
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("hotels_reference").select("*");
      if (data) setHotelsRef(data as HotelReference[]);
    })();
  }, []);

  const monthsAvailable = useMemo(() => {
    const set = new Set<string>();
    reservations.forEach((r) => {
      if (r.date_debut) set.add(monthKey(r.date_debut));
    });
    // Toujours proposer le mois en cours, même sans activité dedans encore.
    set.add(monthKey(localDateStr(new Date())));
    return Array.from(set).sort().reverse();
  }, [reservations]);

  // Toujours le mois en cours par défaut, pas le mois le plus récent trouvé
  // dans les réservations (qui peut être un mois futur, ex. une activité
  // saisie trop loin à l'avance) — demande de Mélanie, 2026-10-28.
  const [mois, setMois] = useState(monthKey(localDateStr(new Date())));
  const [recherche, setRecherche] = useState("");

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
      const nom = canonicalRecapActivityName(cleanActivityTitle(r.nom_activite)) || "(sans nom)";
      const client = clientById[r.client_id];
      if (!client) return;
      if (!map[nom]) {
        map[nom] = { nom, reservationsCount: 0, nbAd: 0, nbEnf: 0, nbBebe: 0, details: [] };
      }
      const agg = map[nom];
      agg.reservationsCount += 1;
      const p = participantsFor(r, client);
      const nbAd = p.nbAd + p.nbAcc;
      const nbEnf = p.nbEnf + p.nbEnf3;
      const nbBebe = p.nbBebe;
      agg.nbAd += nbAd;
      agg.nbEnf += nbEnf;
      agg.nbBebe += nbBebe;
      agg.details.push({ client, r, date: r.date_debut || "", nbAd, nbEnf, nbBebe });
    });
    Object.values(map).forEach((a) => a.details.sort((x, y) => x.date.localeCompare(y.date)));
    return Object.values(map).sort((a, b) => b.nbAd + b.nbEnf + b.nbBebe - (a.nbAd + a.nbEnf + a.nbBebe));
  }, [reservationsDuMois, clientById]);

  const rechercheNorm = normalizeSearch(recherche);
  const visibleActivites = rechercheNorm
    ? parActivite.filter((a) => normalizeSearch(a.nom).includes(rechercheNorm))
    : parActivite;

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

  const [activeActivity, setActiveActivity] = useState<{ client: Client; r: Reservation } | null>(null);

  const exportActivitePdf = (a: ActiviteAgg) => {
    generateRecapActiviteReport({
      activiteNom: a.nom,
      moisLabel: monthLabel(mois),
      rows: a.details.map((d) => ({
        date: d.date,
        clientNom: d.client.nom || "Sans nom",
        nbAd: d.nbAd,
        nbEnf: d.nbEnf,
        nbBebe: d.nbBebe,
      })),
      totalAd: a.nbAd,
      totalEnf: a.nbEnf,
      totalBebe: a.nbBebe,
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Récap du mois</h1>
        <p className="mt-1.5 text-sm text-[#666666]">
          Combien de personnes envoyées, par activité — détail adultes / enfants / bébés.
        </p>
      </div>

      <input
        type="text"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher une activité (ex. Mahmya, transfert, speedboat…)"
        className="w-full rounded-[8px] border border-[#eaeaea] bg-white px-3 py-2 text-sm"
      />

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
                <div className="flex w-full flex-wrap items-center justify-between gap-2 p-4">
                  <button
                    onClick={() => toggleExpanded(a.nom)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium text-[#171717]"
                  >
                    <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>
                      ›
                    </span>
                    {a.nom}
                  </button>
                  <div className="flex items-center gap-4 text-sm text-[#666666]">
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
                    <button
                      onClick={() => exportActivitePdf(a)}
                      className="rounded-md border border-[#eaeaea] px-2 py-1 text-xs font-medium text-[#666666] hover:bg-[#fafafa]"
                      title="Exporter cette catégorie en PDF"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="space-y-1 border-t border-[#f0f0f0] p-4 pt-3 text-sm">
                    {a.details.map((d, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <span className="w-20 shrink-0 text-[#999999]">
                          {d.date ? new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR") : "—"}
                        </span>
                        <span className="text-[#171717]">{d.client.nom || "Sans nom"}</span>
                        <span className="text-[#666666]">
                          {d.nbAd} adulte{d.nbAd > 1 ? "s" : ""}
                          {d.nbEnf > 0 ? `, ${d.nbEnf} enfant${d.nbEnf > 1 ? "s" : ""}` : ""}
                          {d.nbBebe > 0 ? `, ${d.nbBebe} bébé${d.nbBebe > 1 ? "s" : ""}` : ""}
                        </span>
                        <button
                          onClick={() => setActiveActivity({ client: d.client, r: d.r })}
                          className="ml-auto shrink-0 rounded-md border border-[#eaeaea] px-2 py-1 text-xs font-medium text-[#666666] hover:bg-[#fafafa]"
                        >
                          Voir l&apos;activité
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeActivity && (
        <ActivityDetailModal
          key={activeActivity.r.id}
          client={activeActivity.client}
          r={activeActivity.r}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          paiementsPrevus={paiementsPrevus}
          onOpenClient={onOpenClient}
          onOpenActivity={(rr) => setActiveActivity({ client: activeActivity.client, r: rr })}
          onOpenRdvPaiement={onOpenRdvPaiement}
          onUpdateReservation={onUpdateReservation}
          onUpdateClient={(patch) => onUpdateClient(activeActivity.client.id, patch)}
          hotelsRef={hotelsRef}
          onClose={() => setActiveActivity(null)}
        />
      )}
    </div>
  );
}
