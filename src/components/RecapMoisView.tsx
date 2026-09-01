"use client";

import { useMemo, useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { cleanActivityTitle, participantsFor, reservationsActives } from "@/lib/resa";
import { localDateStr } from "@/lib/dates";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Repère précisément le motif "<montant> to pay ... activity" dans le texte
// libre "Info importante" (ex. "130 € to pay to activity") — c'est la
// convention de l'équipe pour signaler qu'un prestataire encaisse ce
// montant en cash directement, à ne pas confondre avec le montant "Paiement
// à l'activité" normal (encaissé par l'agence). N'importe quel autre
// montant écrit dans cette case (allergie, consigne...) n'est pas compté.
const CASH_PRESTATAIRE_RE = /(\d+(?:[.,]\d+)?)\s*€?\s*to\s*pay\b[^]*?activity/i;

function extractMontantPrestataire(texte: string): number | null {
  const m = texte.match(CASH_PRESTATAIRE_RE);
  if (!m) return null;
  const val = Number(m[1].replace(",", "."));
  return Number.isFinite(val) ? val : null;
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

type ActiviteAgg = {
  nom: string;
  reservationsCount: number;
  pax: number;
  montantPrestataire: number;
  // Détail des réservations avec un montant cash repéré, pour vérifier
  // d'où vient le total (client, date, note d'origine).
  cashDetails: { clientNom: string; date: string; montant: number; note: string }[];
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
        (r) => r.date_debut && monthKey(r.date_debut) === mois && r.statut_resa === "Confirmée"
      ),
    [reservations, mois]
  );

  const parActivite = useMemo(() => {
    const map: Record<string, ActiviteAgg> = {};
    reservationsDuMois.forEach((r) => {
      const nom = cleanActivityTitle(r.nom_activite) || "(sans nom)";
      const client = clientById[r.client_id];
      if (!map[nom]) {
        map[nom] = { nom, reservationsCount: 0, pax: 0, montantPrestataire: 0, cashDetails: [] };
      }
      const agg = map[nom];
      agg.reservationsCount += 1;
      if (client) {
        const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);
        agg.pax += nbAd + nbEnf + nbAcc + nbEnf3;
      }
      if (r.info_importante) {
        const montant = extractMontantPrestataire(r.info_importante);
        if (montant !== null) {
          agg.montantPrestataire += montant;
          agg.cashDetails.push({
            clientNom: client?.nom || "—",
            date: r.date_debut || "",
            montant,
            note: r.info_importante,
          });
        }
      }
    });
    return Object.values(map).sort((a, b) => b.pax - a.pax);
  }, [reservationsDuMois, clientById]);

  const activitesOptions = useMemo(() => parActivite.map((a) => a.nom), [parActivite]);
  const visibleActivites =
    activiteFiltre === "toutes" ? parActivite : parActivite.filter((a) => a.nom === activiteFiltre);

  const totalPax = parActivite.reduce((s, a) => s + a.pax, 0);
  const totalMontant = parActivite.reduce((s, a) => s + a.montantPrestataire, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Récap du mois</h1>
        <p className="mt-1.5 text-sm text-[#666666]">
          Combien de personnes envoyées, et combien un prestataire a récolté en cash, par activité.
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
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            Cash récolté par les prestataires (estimé)
          </div>
          <div className="font-heading text-xl font-semibold text-[#171717]">{euros(totalMontant)} €</div>
        </div>
      </div>

      <p className="text-xs text-[#999999]">
        Le montant cash repère uniquement le motif &quot;... to pay to activity&quot; dans la case
        &quot;Info importante&quot; de chaque activité confirmée (ex. &quot;130 € to pay to
        activity&quot;) — pas n&apos;importe quel montant qui y serait écrit pour une autre raison.
      </p>

      {visibleActivites.length === 0 ? (
        <p className="text-sm text-[#666666]">Aucune activité confirmée sur ce mois.</p>
      ) : (
        <div className="space-y-3">
          {visibleActivites.map((a) => (
            <div key={a.nom} className="rounded-[10px] border border-[#eaeaea] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-[#171717]">{a.nom}</div>
                <div className="flex gap-4 text-sm text-[#666666]">
                  <span>
                    <strong className="text-[#171717]">{a.reservationsCount}</strong> réservation
                    {a.reservationsCount > 1 ? "s" : ""}
                  </span>
                  <span>
                    <strong className="text-[#171717]">{a.pax}</strong> personnes
                  </span>
                  {a.montantPrestataire > 0 && (
                    <span>
                      <strong className="text-[#171717]">{euros(a.montantPrestataire)} €</strong> cash
                      prestataire
                    </span>
                  )}
                </div>
              </div>
              {a.cashDetails.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-[#f0f0f0] pt-2 text-xs text-[#666666]">
                  {a.cashDetails.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[#999999]">
                        {d.date ? new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR") : "—"}
                      </span>
                      <span>{d.clientNom}</span>
                      <span className="text-[#171717]">{euros(d.montant)} €</span>
                      <span className="text-[#999999]">— {d.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
