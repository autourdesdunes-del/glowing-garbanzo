"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client, Reservation, ReservationOption, UserShift } from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import { STATUTS, STATUT_COLORS } from "@/lib/constants";
import DonutChart from "@/components/charts/DonutChart";
import QuickAddClient from "@/components/QuickAddClient";

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
function firstNameFromEmail(email: string) {
  const local = email.split("@")[0] || "";
  const first = local.split(/[._-]/)[0] || local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "solid" | "solid-dark" | "highlight" | "pale";
}) {
  const toneClass = {
    solid: "bg-[#5C2A1D] text-white",
    "solid-dark": "bg-[#3d1c13] text-white",
    highlight: "bg-[#C9973E] text-white",
    pale: "bg-white text-[#5C2A1D] border border-[#8B4531]/15",
  }[tone];
  return (
    <div className={`rounded-lg p-4 shadow-sm ${toneClass}`}>
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          tone === "pale" ? "text-neutral-400" : "text-white/70"
        }`}
      >
        {label}
      </p>
      <p className="font-amounts mt-1 text-2xl font-semibold">{value}</p>
      {sub && (
        <p className={`mt-1 text-xs ${tone === "pale" ? "text-neutral-400" : "text-white/70"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md border border-neutral-100 bg-white px-3 py-2.5 ${
        onClick ? "cursor-pointer hover:border-[#8B4531]/30" : ""
      }`}
    >
      <span className="text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#5C2A1D]">{title}</p>
        <p className="truncate text-xs text-neutral-400">{sub}</p>
      </div>
      {onClick && <span className="text-neutral-300">›</span>}
    </div>
  );
}

export default function DashboardView({
  userEmail,
  clients,
  reservations,
  resaOptions,
  isDirection,
  onOpenClient,
  onCreateClient,
}: {
  userEmail: string;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  isDirection: boolean;
  onOpenClient: (id: string) => void;
  onCreateClient: (fields: { nom: string; telephone: string; canal: string }) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [shift, setShift] = useState<UserShift | null>(null);
  const [editingShift, setEditingShift] = useState(false);
  const [shiftDebut, setShiftDebut] = useState("");
  const [shiftFin, setShiftFin] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_shifts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setShift(data as UserShift);
        setShiftDebut((data as UserShift).shift_debut);
        setShiftFin((data as UserShift).shift_fin);
      }
    })();
  }, [supabase]);

  const saveShift = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_shifts")
      .upsert({ user_id: user.id, shift_debut: shiftDebut, shift_fin: shiftFin });
    setShift({ user_id: user.id, shift_debut: shiftDebut, shift_fin: shiftFin, updated_at: "" });
    setEditingShift(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = addDays(todayStr, 1);
  const in14Days = addDays(todayStr, 14);

  const clientById = (id: string) => clients.find((c) => c.id === id);

  const clientsInEgypt = clients.filter(
    (c) => c.date_debut && c.date_fin && c.date_debut <= todayStr && todayStr <= c.date_fin
  );

  const rdvToday = clients.filter((c) => !c.solde_activite_id && c.solde_date === todayStr);
  const paidToday = clients.filter((c) => c.solde_paye && c.solde_date === todayStr);
  const callsToday = clients
    .filter((c) => c.prochain_appel_date === todayStr)
    .sort((a, b) => a.prochain_appel_heure.localeCompare(b.prochain_appel_heure));

  const pickupsMissingTomorrow = reservations.filter(
    (r) => r.date_debut === tomorrowStr && !r.pickup_reel
  );

  const clientsArrivingTomorrow = clients.filter((c) => c.date_debut === tomorrowStr);
  const roomsMissingTomorrow = clientsArrivingTomorrow.filter(
    (c) => !c.chambre || c.infos_manquantes.includes("Room number")
  );

  const auRevoirToday = clients.filter(
    (c) => c.date_fin && addDays(c.date_fin, 1) === todayStr && !c.au_revoir_envoye
  );
  const avisToday = clients.filter(
    (c) => c.date_fin && addDays(c.date_fin, 7) === todayStr && !c.avis_envoye
  );

  const staleProspects = clients.filter(
    (c) =>
      (c.statut === "Prospect" || c.statut === "En négociation") &&
      c.date_debut &&
      c.date_debut >= todayStr &&
      c.date_debut <= in14Days &&
      daysSince(c.created_at) >= 2
  );

  const incompleteUpcoming = clients.filter(
    (c) =>
      c.statut === "Client confirmé" &&
      c.date_debut &&
      c.date_debut >= todayStr &&
      c.date_debut <= in14Days &&
      c.infos_manquantes.length > 0 &&
      !(c.infos_manquantes.length === 1 && c.infos_manquantes[0] === "Complet")
  );

  const urgentCount =
    rdvToday.length + pickupsMissingTomorrow.length + auRevoirToday.length + avisToday.length;

  // -- Priority queue: every client needing attention soon, ranked by departure date.
  type QueueRow = { client: Client; motif: string };
  const queueMap = new Map<string, QueueRow>();
  const addToQueue = (c: Client, motif: string) => {
    const existing = queueMap.get(c.id);
    queueMap.set(c.id, { client: c, motif: existing ? `${existing.motif} · ${motif}` : motif });
  };
  incompleteUpcoming.forEach((c) => addToQueue(c, "Dossier incomplet"));
  staleProspects.forEach((c) => addToQueue(c, "À relancer"));
  rdvToday.forEach((c) => addToQueue(c, "RDV paiement aujourd'hui"));
  const priorityQueue = Array.from(queueMap.values()).sort((a, b) =>
    (a.client.date_debut || "9999").localeCompare(b.client.date_debut || "9999")
  );

  const byStatut: Record<string, number> = {};
  clients.forEach((c) => {
    byStatut[c.statut] = (byStatut[c.statut] || 0) + 1;
  });

  const caTotal = isDirection
    ? reservations.reduce(
        (s, r) =>
          s + resaTotalMontant(r, clientById(r.client_id) as Client, resaOptions[r.id] || []),
        0
      )
    : 0;

  const firstName = firstNameFromEmail(userEmail);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#5C2A1D]">
            Bonjour {firstName}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {today.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {" — "}
            {editingShift ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="time"
                  value={shiftDebut}
                  onChange={(e) => setShiftDebut(e.target.value)}
                  className="rounded border border-neutral-300 px-1 py-0.5 text-xs"
                />
                <span>–</span>
                <input
                  type="time"
                  value={shiftFin}
                  onChange={(e) => setShiftFin(e.target.value)}
                  className="rounded border border-neutral-300 px-1 py-0.5 text-xs"
                />
                <button
                  onClick={saveShift}
                  className="ml-1 rounded bg-[#5C2A1D] px-2 py-0.5 text-xs text-white"
                >
                  OK
                </button>
              </span>
            ) : (
              <button
                onClick={() => setEditingShift(true)}
                className="underline decoration-dotted hover:text-[#5C2A1D]"
              >
                {shift && shift.shift_debut && shift.shift_fin
                  ? `Shift aujourd'hui : ${shift.shift_debut} – ${shift.shift_fin}`
                  : "Ajouter ton shift du jour"}
              </button>
            )}
          </p>
        </div>
        <QuickAddClient
          onCreate={onCreateClient}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Clients en Égypte" value={String(clientsInEgypt.length)} tone="solid" />
        <StatTile
          label="Cas urgents"
          value={String(urgentCount)}
          sub={urgentCount > 0 ? "aujourd'hui" : undefined}
          tone="pale"
        />
        <StatTile
          label="Prospects à relancer"
          value={String(staleProspects.length)}
          sub="arrivée < 14 j"
          tone="highlight"
        />
        <StatTile
          label="Dossiers incomplets"
          value={String(incompleteUpcoming.length)}
          sub="arrivée < 14 j"
          tone="solid-dark"
        />
        <StatTile
          label="Pick-ups manquants"
          value={String(pickupsMissingTomorrow.length)}
          sub="demain"
          tone="pale"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-[#5C2A1D]">
              File d&apos;attente prioritaire
            </h2>
            <span className="text-xs text-neutral-400">{priorityQueue.length} dossier(s)</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-neutral-100 bg-white">
            {priorityQueue.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-400">
                Rien de prioritaire pour l&apos;instant.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-2 font-medium">Client</th>
                    <th className="px-3 py-2 font-medium">Arrivée</th>
                    <th className="px-3 py-2 font-medium">Motif</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {priorityQueue.slice(0, 10).map(({ client, motif }) => (
                    <tr
                      key={client.id}
                      onClick={() => onOpenClient(client.id)}
                      className="cursor-pointer border-b border-neutral-50 last:border-0 hover:bg-[#F2E6D2]/40"
                    >
                      <td className="px-3 py-2.5 font-medium text-[#5C2A1D]">
                        {client.nom || "Sans nom"}
                      </td>
                      <td className="font-amounts px-3 py-2.5 text-neutral-500">
                        {fmtDate(client.date_debut)}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-600">{motif}</td>
                      <td className="px-3 py-2.5 text-right text-neutral-300">›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {priorityQueue.length > 0 && (
            <div className="rounded-md bg-[#5C2A1D] px-4 py-3 text-sm text-white">
              {priorityQueue.length} dossier(s) à traiter — commence par les arrivées les plus
              proches.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="font-heading mb-2 text-base font-semibold text-[#5C2A1D]">
              Actions rapides
            </h2>
            <div className="space-y-2">
              {callsToday.map((c) => (
                <ActionRow
                  key={"call-" + c.id}
                  icon="📞"
                  title={`Appel à ${c.prochain_appel_heure || "?"}`}
                  sub={c.nom || "Sans nom"}
                  onClick={() => onOpenClient(c.id)}
                />
              ))}
              <ActionRow
                icon="🔑"
                title="Numéros de chambre manquants"
                sub={
                  roomsMissingTomorrow.length > 0
                    ? `${roomsMissingTomorrow.length} client(s) arrivant demain`
                    : "Rien à demander"
                }
                onClick={
                  roomsMissingTomorrow[0] ? () => onOpenClient(roomsMissingTomorrow[0].id) : undefined
                }
              />
              <ActionRow
                icon="🚗"
                title="Pick-ups à ajouter"
                sub={
                  pickupsMissingTomorrow.length > 0
                    ? `${pickupsMissingTomorrow.length} activité(s) demain`
                    : "Rien à ajouter"
                }
                onClick={
                  pickupsMissingTomorrow[0]
                    ? () => onOpenClient(pickupsMissingTomorrow[0].client_id)
                    : undefined
                }
              />
              <ActionRow
                icon="💰"
                title="RDV paiements aujourd'hui"
                sub={rdvToday.length > 0 ? `${rdvToday.length} rendez-vous` : "Aucun aujourd'hui"}
                onClick={rdvToday[0] ? () => onOpenClient(rdvToday[0].id) : undefined}
              />
              <ActionRow
                icon="✅"
                title="Paiements encaissés à vérifier"
                sub={paidToday.length > 0 ? `${paidToday.length} solde(s) aujourd'hui` : "Rien de nouveau"}
                onClick={paidToday[0] ? () => onOpenClient(paidToday[0].id) : undefined}
              />
              <ActionRow
                icon="👋"
                title="Messages au revoir"
                sub={auRevoirToday.length > 0 ? `${auRevoirToday.length} à envoyer` : "Rien à envoyer"}
                onClick={auRevoirToday[0] ? () => onOpenClient(auRevoirToday[0].id) : undefined}
              />
              <ActionRow
                icon="⭐"
                title="Demandes d'avis"
                sub={avisToday.length > 0 ? `${avisToday.length} à envoyer` : "Rien à envoyer"}
                onClick={avisToday[0] ? () => onOpenClient(avisToday[0].id) : undefined}
              />
              <ActionRow
                icon="🔁"
                title="Relances prospects"
                sub={staleProspects.length > 0 ? `${staleProspects.length} à relancer` : "Rien à relancer"}
                onClick={staleProspects[0] ? () => onOpenClient(staleProspects[0].id) : undefined}
              />
            </div>
          </div>

          <div>
            <h2 className="font-heading mb-2 text-base font-semibold text-[#5C2A1D]">
              Répartition par statut
            </h2>
            <DonutChart
              centerLabel="clients"
              data={STATUTS.map((s) => ({
                label: s,
                value: byStatut[s] || 0,
                color: STATUT_COLORS[s],
              }))}
            />
          </div>

          {isDirection && (
            <StatTile label="CA (activités)" value={`${euros(caTotal)} €`} tone="solid" />
          )}
        </div>
      </div>
    </div>
  );
}
