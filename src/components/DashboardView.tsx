"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client, PlanningShift, Reservation, ReservationOption, ReservationTarif, UserShift } from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import { addDays, localDateStr } from "@/lib/dates";
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
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function firstNameFromEmail(email: string) {
  const local = email.split("@")[0] || "";
  const first = local.split(/[._-]/)[0] || local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

// Encre uniforme — pas de teinte hachée par client : l'encre est la
// marque, pas une palette décorative.
function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#171717] font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name || "Sans nom")}
    </div>
  );
}

function IconSvg({ path, className = "h-5 w-5" }: { path: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {path}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  users: (
    <>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" strokeLinecap="round" />
      <circle cx="14" cy="6.5" r="2" />
      <path d="M13 11.9c1.9.3 4.5 1.6 4.5 4.1" strokeLinecap="round" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3 2.5 16h15L10 3Z" strokeLinejoin="round" />
      <path d="M10 8.5v3.2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="3.5" width="10" height="14" rx="1.5" />
      <path d="M8 3.5V3a2 2 0 0 1 4 0v.5" />
      <path d="M7.5 9h5M7.5 12h5" strokeLinecap="round" />
    </>
  ),
  car: (
    <>
      <path d="M3 12.5 4.3 8a1.5 1.5 0 0 1 1.4-1h8.6a1.5 1.5 0 0 1 1.4 1l1.3 4.5" strokeLinejoin="round" />
      <rect x="2.5" y="12.5" width="15" height="3.5" rx="1.2" />
      <circle cx="6" cy="16.3" r="1.2" />
      <circle cx="14" cy="16.3" r="1.2" />
    </>
  ),
  key: (
    <>
      <circle cx="7" cy="13" r="3" />
      <path d="M9.1 10.9 16 4" strokeLinecap="round" />
      <path d="M13 7l2 2M15.2 4.8l2 2" strokeLinecap="round" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M6.8 10.2l2.1 2.1 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  wave: (
    <>
      <path
        d="M4 12c1-4 3-6 3-9M8 12c1-4 2-7 1-10M12 12c1-3 3-5 4-8"
        strokeLinecap="round"
      />
      <path d="M3 15c3 1.5 11 1.5 14 0" strokeLinecap="round" />
    </>
  ),
  star: (
    <path d="M10 2.8 12.2 7.6l5.2.6-3.9 3.6 1 5.1-4.5-2.6-4.5 2.6 1-5.1-3.9-3.6 5.2-.6L10 2.8Z" strokeLinejoin="round" />
  ),
  refresh: (
    <>
      <path d="M4 10a6 6 0 0 1 10.2-4.2L16 7.5" strokeLinecap="round" />
      <path d="M16 4v3.5h-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10a6 6 0 0 1-10.2 4.2L4 12.5" strokeLinecap="round" />
      <path d="M4 16v-3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  phone: (
    <path
      d="M4.5 3.5h2.7l1 3.3-1.7 1.4a10 10 0 0 0 4.3 4.3l1.4-1.7 3.3 1v2.7c0 .8-.7 1.4-1.5 1.3C8.6 15.2 4.8 11.4 4 5.9c-.1-.8.5-1.4 1.3-1.4Z"
      strokeLinejoin="round"
    />
  ),
};

function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return <IconSvg path={ICONS[name]} className={className} />;
}

// Traitement typographique, pas de carte : pas de bordure, pas de fond,
// pas d'icône par métrique — seule la couleur d'état signale la sévérité.
function Metric({
  label,
  value,
  sub,
  tone,
  first,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "default" | "error";
  first?: boolean;
}) {
  const valueClass = tone === "error" ? "text-[#EE0000]" : "text-[#171717]";
  return (
    <div className={`flex-1 px-5 ${first ? "pl-0" : "border-l border-[#eaeaea]"}`}>
      <p className="text-[11px] font-medium text-[#666666]">{label}</p>
      <p className={`font-amounts mt-1.5 text-[28px] font-bold leading-none ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[#666666]">{sub}</p>}
    </div>
  );
}

function ActionRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: keyof typeof ICONS;
  title: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 transition ${
        onClick ? "cursor-pointer hover:bg-[#fafafa]" : ""
      }`}
    >
      <Icon name={icon} className="h-4.5 w-4.5 flex-shrink-0 text-[#666666]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#171717]">{title}</p>
        <p className="truncate text-xs text-[#666666]">{sub}</p>
      </div>
      {onClick && (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-[#666666]">
          ›
        </span>
      )}
    </div>
  );
}

export default function DashboardView({
  userEmail,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  isDirection,
  onOpenClient,
  onCreateClient,
  onUpdateClient,
}: {
  userEmail: string;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  isDirection: boolean;
  onOpenClient: (id: string) => void;
  onCreateClient: (fields: {
    nom: string;
    telephone: string;
    canal: string;
    statut: "Prospect" | "Client confirmé";
  }) => Promise<Client | null>;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [shift, setShift] = useState<UserShift | null>(null);
  const [plannedShift, setPlannedShift] = useState<PlanningShift | null>(null);
  const [editingShift, setEditingShift] = useState(false);
  const [shiftDebut, setShiftDebut] = useState("");
  const [shiftFin, setShiftFin] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const [{ data: planned }, { data }] = await Promise.all([
        supabase
          .from("planning_shifts")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", todayStr)
          .maybeSingle(),
        supabase.from("user_shifts").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (planned) setPlannedShift(planned as PlanningShift);
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
  const todayStr = localDateStr(today);
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

  // "À relancer" se base sur le dernier contact réel (dernier_contact_date),
  // pas sur l'ancienneté de la fiche — sinon un prospect qu'on vient de
  // relancer reste marqué "à relancer" jusqu'à ce qu'il réponde.
  const staleProspects = clients.filter(
    (c) =>
      (c.statut === "Prospect" || c.statut === "En négociation") &&
      c.date_debut &&
      c.date_debut >= todayStr &&
      c.date_debut <= in14Days &&
      daysSince(c.dernier_contact_date || c.created_at) >= 2
  );

  const marquerRelance = (c: Client) => {
    onUpdateClient(c.id, {
      dernier_contact_date: todayStr,
      nb_relances: (c.nb_relances || 0) + 1,
    });
  };

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
  type QueueRow = { client: Client; motifs: string[] };
  const queueMap = new Map<string, QueueRow>();
  const addToQueue = (c: Client, motif: string) => {
    const existing = queueMap.get(c.id);
    if (existing) existing.motifs.push(motif);
    else queueMap.set(c.id, { client: c, motifs: [motif] });
  };
  incompleteUpcoming.forEach((c) => addToQueue(c, "Dossier incomplet"));
  staleProspects.forEach((c) => addToQueue(c, "À relancer"));
  rdvToday.forEach((c) => addToQueue(c, "RDV paiement"));
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
          s +
          resaTotalMontant(
            r,
            clientById(r.client_id) as Client,
            resaOptions[r.id] || [],
            resaTarifs[r.id] || []
          ),
        0
      )
    : 0;

  const firstName = firstNameFromEmail(userEmail);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[26px] font-semibold text-[#171717]">
            Bonjour {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[#666666]">
            {today.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            <span className="mx-2 text-[#eaeaea]">·</span>
            {plannedShift ? (
              <span className="text-[#666666]">
                {plannedShift.statut === "conge"
                  ? "Congé aujourd'hui"
                  : plannedShift.statut === "repos"
                    ? "OFF aujourd'hui"
                    : plannedShift.statut === "superviseur"
                      ? "Superviseur aujourd'hui"
                      : `Shift aujourd'hui : ${plannedShift.shift_debut} – ${plannedShift.shift_fin}`}
              </span>
            ) : editingShift ? (
              <span className="inline-flex items-center gap-1.5">
                <input
                  type="time"
                  value={shiftDebut}
                  onChange={(e) => setShiftDebut(e.target.value)}
                  className="rounded-[6px] border border-[#eaeaea] px-1.5 py-0.5 text-xs"
                />
                <span className="text-[#666666]">–</span>
                <input
                  type="time"
                  value={shiftFin}
                  onChange={(e) => setShiftFin(e.target.value)}
                  className="rounded-[6px] border border-[#eaeaea] px-1.5 py-0.5 text-xs"
                />
                <button
                  onClick={saveShift}
                  className="ml-1 rounded-[6px] bg-[#171717] px-2.5 py-0.5 text-xs font-medium text-white"
                >
                  OK
                </button>
              </span>
            ) : (
              <button
                onClick={() => setEditingShift(true)}
                className="text-[#0070f3] underline decoration-dotted underline-offset-2"
              >
                {shift && shift.shift_debut && shift.shift_fin
                  ? `Shift aujourd'hui : ${shift.shift_debut} – ${shift.shift_fin}`
                  : "Ajouter ton shift du jour"}
              </button>
            )}
          </p>
        </div>
        <QuickAddClient onCreate={onCreateClient} onUpdateClient={onUpdateClient} />
      </div>

      <div className="flex">
        <Metric first label="Clients en Égypte" value={String(clientsInEgypt.length)} tone="default" />
        <Metric
          label="Cas urgents"
          value={String(urgentCount)}
          sub={urgentCount > 0 ? "aujourd'hui" : "rien pour l'instant"}
          tone={urgentCount > 0 ? "error" : "default"}
        />
        <Metric
          label="Prospects à relancer"
          value={String(staleProspects.length)}
          sub="arrivée < 14 j"
          tone="default"
        />
        <Metric
          label="Dossiers incomplets"
          value={String(incompleteUpcoming.length)}
          sub="arrivée < 14 j"
          tone="default"
        />
        <Metric
          label="Pick-ups manquants"
          value={String(pickupsMissingTomorrow.length)}
          sub="demain"
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-[#171717]">
              File d&apos;attente prioritaire
            </h2>
            <span className="font-amounts text-xs font-medium text-[#666666]">
              {priorityQueue.length} dossier(s)
            </span>
          </div>
          <div
            className={
              priorityQueue.length === 0
                ? "py-10 text-center text-sm text-[#666666]"
                : "overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white"
            }
          >
            {priorityQueue.length === 0 ? (
              "Rien de prioritaire pour l'instant."
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[#666666]">
                    <th className="px-5 pb-3 pt-5 font-medium">Client</th>
                    <th className="px-3 pb-3 pt-5 font-medium">Arrivée</th>
                    <th className="px-3 pb-3 pt-5 font-medium">Motif</th>
                    <th className="px-5 pb-3 pt-5" />
                  </tr>
                </thead>
                <tbody>
                  {priorityQueue.slice(0, 10).map(({ client, motifs }) => (
                    <tr
                      key={client.id}
                      onClick={() => onOpenClient(client.id)}
                      className="cursor-pointer border-t border-[#eaeaea] hover:bg-[#fafafa]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.nom || "Sans nom"} />
                          <div>
                            <p className="font-medium text-[#171717]">
                              {client.nom || "Sans nom"}
                            </p>
                            <p
                              className="text-[11px] font-medium"
                              style={{ color: STATUT_COLORS[client.statut] }}
                            >
                              {client.statut}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="font-amounts px-3 py-3 text-[#666666]">
                        {fmtDate(client.date_debut)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {motifs.map((m) => (
                            <span
                              key={m}
                              className="whitespace-nowrap rounded-[4px] border border-[#eaeaea] bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#171717]"
                            >
                              {m}
                              {m === "À relancer" && client.nb_relances > 0
                                ? ` (${client.nb_relances})`
                                : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {motifs.includes("À relancer") ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              marquerRelance(client);
                            }}
                            className="whitespace-nowrap rounded-[6px] bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                          >
                            Relancé aujourd&apos;hui
                          </button>
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[#666666]">
                            ›
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {priorityQueue.length > 0 && (
            <div className="flex items-center justify-between rounded-[6px] border border-[#eaeaea] bg-[#fafafa] px-5 py-4 text-sm text-[#171717]">
              <span>
                {priorityQueue.length} dossier(s) à traiter — commence par les arrivées les plus
                proches.
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
              Actions rapides
            </h2>
            <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              {callsToday.map((c) => (
                <ActionRow
                  key={"call-" + c.id}
                  icon="phone"
                  title={`Appel à ${c.prochain_appel_heure || "?"}`}
                  sub={c.nom || "Sans nom"}
                  onClick={() => onOpenClient(c.id)}
                />
              ))}
              <ActionRow
                icon="key"
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
                icon="car"
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
                icon="wallet"
                title="RDV paiements aujourd'hui"
                sub={rdvToday.length > 0 ? `${rdvToday.length} rendez-vous` : "Aucun aujourd'hui"}
                onClick={rdvToday[0] ? () => onOpenClient(rdvToday[0].id) : undefined}
              />
              <ActionRow
                icon="check"
                title="Paiements encaissés à vérifier"
                sub={
                  paidToday.length > 0 ? `${paidToday.length} solde(s) aujourd'hui` : "Rien de nouveau"
                }
                onClick={paidToday[0] ? () => onOpenClient(paidToday[0].id) : undefined}
              />
              <ActionRow
                icon="wave"
                title="Messages au revoir"
                sub={auRevoirToday.length > 0 ? `${auRevoirToday.length} à envoyer` : "Rien à envoyer"}
                onClick={auRevoirToday[0] ? () => onOpenClient(auRevoirToday[0].id) : undefined}
              />
              <ActionRow
                icon="star"
                title="Demandes d'avis"
                sub={avisToday.length > 0 ? `${avisToday.length} à envoyer` : "Rien à envoyer"}
                onClick={avisToday[0] ? () => onOpenClient(avisToday[0].id) : undefined}
              />
              <ActionRow
                icon="refresh"
                title="Relances prospects"
                sub={
                  staleProspects.length > 0 ? `${staleProspects.length} à relancer` : "Rien à relancer"
                }
                onClick={staleProspects[0] ? () => onOpenClient(staleProspects[0].id) : undefined}
              />
            </div>
          </div>

          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
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
            <div>
              <p className="text-[11px] font-medium text-[#666666]">CA (activités)</p>
              <p className="font-amounts mt-1.5 text-[28px] font-bold leading-none text-[#171717]">
                {euros(caTotal)} €
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
