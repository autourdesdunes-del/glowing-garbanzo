"use client";

import { Client, Reservation, ReservationOption } from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-white p-4 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="font-amounts mt-1 text-2xl font-semibold text-[#5C2A1D]">{value}</p>
    </div>
  );
}

function Row({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-neutral-100 bg-white px-3 py-2 text-sm hover:border-[#8B4531]/30"
    >
      {children}
    </div>
  );
}

export default function DashboardView({
  clients,
  reservations,
  resaOptions,
  isDirection,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  isDirection: boolean;
  onOpenClient: (id: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = addDays(todayStr, 1);
  const weekEnd = addDays(todayStr, 7);

  const clientById = (id: string) => clients.find((c) => c.id === id);

  const rdvToday = clients.filter(
    (c) => !c.solde_activite_id && c.solde_date === todayStr
  );

  const pickupsToConfirm = reservations.filter(
    (r) => r.date_debut === tomorrowStr && !r.pickup_reel
  );

  const auRevoirToday = clients.filter(
    (c) => c.date_fin && addDays(c.date_fin, 1) === todayStr && !c.au_revoir_envoye
  );

  const avisToday = clients.filter(
    (c) => c.date_fin && addDays(c.date_fin, 7) === todayStr && !c.avis_envoye
  );

  const pendingNegotiation = clients
    .filter((c) => c.statut === "En négociation" && daysSince(c.created_at) >= 3)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, 6);

  const incompleteDossiers = clients
    .filter(
      (c) =>
        c.statut !== "Perdu" &&
        c.infos_manquantes.length > 0 &&
        !(c.infos_manquantes.length === 1 && c.infos_manquantes[0] === "Complet")
    )
    .slice(0, 6);

  const departuresThisWeek = clients
    .filter((c) => c.date_debut && c.date_debut >= todayStr && c.date_debut <= weekEnd)
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  const byStatut: Record<string, number> = {};
  clients.forEach((c) => {
    byStatut[c.statut] = (byStatut[c.statut] || 0) + 1;
  });

  const caTotal = isDirection
    ? reservations.reduce(
        (s, r) => s + resaTotalMontant(r, clientById(r.client_id) as Client, resaOptions[r.id] || []),
        0
      )
    : 0;

  const urgentCount =
    rdvToday.length + pickupsToConfirm.length + auRevoirToday.length + avisToday.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Tableau de bord</h2>

      <div className={`grid gap-4 ${isDirection ? "grid-cols-4" : "grid-cols-3"}`}>
        <StatTile
          label="Clients actifs"
          value={String(clients.filter((c) => c.statut !== "Perdu").length)}
          accent="#5C2A1D"
        />
        <StatTile
          label="Départs (7 j)"
          value={String(departuresThisWeek.length)}
          accent="#8B4531"
        />
        <StatTile
          label="En négociation"
          value={String(byStatut["En négociation"] || 0)}
          accent="#C9973E"
        />
        {isDirection && (
          <StatTile label="CA (activités)" value={`${euros(caTotal)} €`} accent="#5C2A1D" />
        )}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">
          Ça presse aujourd&apos;hui {urgentCount > 0 && `(${urgentCount})`}
        </h3>
        {urgentCount === 0 ? (
          <div className="text-sm text-neutral-400">Rien d&apos;urgent pour l&apos;instant.</div>
        ) : (
          <div className="space-y-2">
            {rdvToday.map((c) => (
              <Row key={"rdv-" + c.id} onClick={() => onOpenClient(c.id)}>
                <span>
                  💰 RDV paiement — <strong>{c.nom || "Sans nom"}</strong>
                  {c.solde_rdv_heure ? ` à ${c.solde_rdv_heure}` : ""}
                </span>
                <span className="font-amounts text-neutral-500">{euros(c.solde_montant)} €</span>
              </Row>
            ))}
            {pickupsToConfirm.map((r) => {
              const c = clientById(r.client_id);
              return (
                <Row key={"pickup-" + r.id} onClick={() => c && onOpenClient(c.id)}>
                  <span>
                    🚗 Pick-up à confirmer — <strong>{c?.nom || "Sans nom"}</strong> ·{" "}
                    {r.nom_activite || "Activité"}
                  </span>
                  <span className="text-neutral-500">demain</span>
                </Row>
              );
            })}
            {auRevoirToday.map((c) => (
              <Row key={"aurevoir-" + c.id} onClick={() => onOpenClient(c.id)}>
                <span>
                  👋 Message au revoir — <strong>{c.nom || "Sans nom"}</strong>
                </span>
              </Row>
            ))}
            {avisToday.map((c) => (
              <Row key={"avis-" + c.id} onClick={() => onOpenClient(c.id)}>
                <span>
                  ⭐ Demande d&apos;avis — <strong>{c.nom || "Sans nom"}</strong>
                </span>
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">Dossiers en attente</h3>
        {pendingNegotiation.length === 0 && incompleteDossiers.length === 0 ? (
          <div className="text-sm text-neutral-400">Rien à relancer pour l&apos;instant.</div>
        ) : (
          <div className="space-y-2">
            {pendingNegotiation.map((c) => (
              <Row key={"neg-" + c.id} onClick={() => onOpenClient(c.id)}>
                <span>
                  ⏳ En négociation depuis {daysSince(c.created_at)} j —{" "}
                  <strong>{c.nom || "Sans nom"}</strong>
                </span>
              </Row>
            ))}
            {incompleteDossiers.map((c) => (
              <Row key={"incomplete-" + c.id} onClick={() => onOpenClient(c.id)}>
                <span>
                  📋 Infos manquantes ({c.infos_manquantes.join(", ")}) —{" "}
                  <strong>{c.nom || "Sans nom"}</strong>
                </span>
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">Départs cette semaine</h3>
        {departuresThisWeek.length === 0 ? (
          <div className="text-sm text-neutral-400">Aucun départ dans les 7 prochains jours.</div>
        ) : (
          <div className="space-y-2">
            {departuresThisWeek.map((c) => (
              <Row key={"dep-" + c.id} onClick={() => onOpenClient(c.id)}>
                <span>
                  <strong>{c.nom || "Sans nom"}</strong> — {c.hotel || "Hôtel ?"}
                </span>
                <span className="font-amounts text-neutral-500">{fmtDate(c.date_debut)}</span>
              </Row>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
