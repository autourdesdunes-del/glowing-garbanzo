"use client";

import { useState } from "react";
import {
  Client,
  PlanningShift,
  Profile,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { addDays, localDateStr } from "@/lib/dates";
import {
  acompteWaitingWarning,
  activitePaiementWarning,
  hideMoment,
  paiementBadge,
  participantsFor,
  resaTotalMontant,
} from "@/lib/resa";
import { profileName, profilesOnShiftAt } from "@/lib/planning";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtDayColumn(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}
function fmtMonthLabel(ym: string) {
  const d = new Date(ym + "-01T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function firstNameOf(nom: string) {
  return nom.trim().split(/\s+/)[0] || "";
}
function auRevoirMessage(nom: string) {
  const prenom = firstNameOf(nom) || "—";
  return `Bonjour ${prenom} \n\nNous espérons que votre retour s'est bien passé.\n\nNous vous remercions d'avoir fait confiance à Autour des Dunes pour l'organisation de vos activités.\n\nCe sera avec grand plaisir que nous vous accueillerons à nouveau prochainement.\n\nL'équipe Autour des Dunes ☀️`;
}
function avisMessage(nom: string) {
  const prenom = firstNameOf(nom) || "—";
  return `Bonjour ${prenom} \n\nJ'espère que vous allez bien ☺️\n\nJe me permets de vous envoyer un message pour savoir si vous seriez d'accord pour nous laisser un avis et partager avec nos voyageurs votre expérience à nos côtés \n\nCela prend quelques petites secondes mais cela nous aide beaucoup pour nous faire connaître comme nous sommes une jeune agence \n\nJe vous laisse le lien juste ici : \n\n➡️ Google : https://g.co/kgs/jUu71x\n\n➡️ Trip Advisor : https://www.tripadvisor.fr/Attraction_Review-g297549-d26856860-Reviews-Autour_des_Dunes-Hurghada_Red_Sea_and_Sinai.html\n\nEn vous remerciant par avance 🙏`;
}

export const SUIVIS_SUBS = [
  { key: "j1", label: "Pick-ups & chambres (J-1)" },
  { key: "rdv", label: "RDV paiements" },
  { key: "appels", label: "Appels" },
  { key: "aurevoir", label: "Au revoir" },
  { key: "avis", label: "Avis clients" },
  { key: "remb", label: "Remboursements" },
  { key: "billets", label: "Billets d'avion" },
] as const;

export type SuivisSub = (typeof SUIVIS_SUBS)[number]["key"];

const APPEL_PLATEFORMES = ["Instagram", "WhatsApp", "Mobile", "Google Meet", "Zoom"];

function JumpBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-[#171717] hover:bg-neutral-200"
    >
      → Fiche client
    </button>
  );
}

function RdvPaiementModal({
  c,
  montant,
  copiedKey,
  onCopy,
  onOpenClient,
  onClose,
}: {
  c: Client;
  montant: number;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  onOpenClient: (id: string) => void;
  onClose: () => void;
}) {
  const clientMsg = `Bonjour ${c.nom || ""}, petit rappel pour aujourd'hui : rendez-vous à ${c.solde_rdv_heure || "l'heure convenue"} devant l'hôtel ${c.hotel || "—"} (à l'extérieur) pour le règlement du solde de ${euros(montant)} €. À tout à l'heure !`;
  const teamMsg = `Payment appointment — ${c.nom || "No name"} — Hotel ${c.hotel || "—"} — ${c.solde_rdv_heure || "time ?"} — Amount to collect: ${euros(montant)} €`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border-2 border-[#0070f3] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <button
            onClick={() => {
              onOpenClient(c.id);
              onClose();
            }}
            className="font-heading text-base font-semibold text-[#171717] hover:underline"
          >
            {c.nom || "Sans nom"}
          </button>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <div className="mt-2 space-y-1 text-sm text-[#666666]">
          <div>
            {fmtDate(c.solde_date)} {c.solde_rdv_heure && `— ${c.solde_rdv_heure}`}
          </div>
          <div>Hôtel : {c.hotel || "—"}</div>
          {c.solde_rdv_lieu && <div>Lieu : {c.solde_rdv_lieu}</div>}
          <div>👤 Assigné à : {c.solde_assigne_a || "Non assigné"}</div>
          <div className="font-amounts font-medium text-[#171717]">Montant : {euros(montant)} €</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onCopy("modal-client-" + c.id, clientMsg)}
            className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            {copiedKey === "modal-client-" + c.id ? "Copié ✓" : "Copier message client"}
          </button>
          <button
            onClick={() => onCopy("modal-team-" + c.id, teamMsg)}
            className="rounded-full bg-[#666666] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            {copiedKey === "modal-team-" + c.id
              ? "Copié ✓"
              : `Copier message ${c.solde_assigne_a || "équipe"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Détail d'horaire à citer dans les messages pick-up : l'heure précise si
// elle a été choisie, sinon le moment (sauf quand hideMoment dit que ça ne
// veut rien dire pour cette activité, ex. speedboat sunset déjà dans le nom).
function horaireDetail(r: Reservation) {
  if (r.horaire_souhaite) return r.horaire_souhaite;
  if (r.moment && !hideMoment(r.nom_activite, r.horaire_souhaite)) return r.moment;
  return "";
}

function pickupMissingTeamMessage(r: Reservation, client: Client) {
  const detail = horaireDetail(r);
  return `Pick-up manquant — ${client.nom || "Sans nom"} — ${r.nom_activite || "Activité sans nom"}${
    detail ? ` (${detail})` : ""
  }. Merci de confirmer l'heure de pick-up avant 18h.`;
}

function pickupClientMessage(r: Reservation, client: Client, montantRestant: number) {
  const prenom = firstNameOf(client.nom) || "—";
  const soldeIci = client.solde_activite_id === r.id && !client.solde_paye;
  const paiementLigne = soldeIci
    ? `\nComme convenu, vous pourrez régler le solde de ${euros(montantRestant)}€ en espèces en euros sur place demain auprès de notre représentant sur place.`
    : "";
  return `Bonjour ${prenom}, pour demain pour votre activité ${r.nom_activite || "—"} le chauffeur viendra vous récupérer à ${r.pickup_reel} devant la réception de votre hôtel, côté extérieur.\nPour cette activité n'oubliez pas ${r.a_prevoir || "le nécessaire pour l'activité"}.${paiementLigne}\nVous trouverez dans votre page client le rappel du programme de la journée de demain.☀️`;
}

// Même style de carte que la fiche client (ReservationCard, vue repliée) —
// pour reconnaître une activité au premier coup d'œil, y compris quand il y
// en a 50 dans la journée.
// Reprend exactement la carte repliée de l'Itinéraire (fiche client), pour
// qu'une activité soit reconnaissable au premier coup d'œil ici aussi.
function PickupActivityCard({
  r,
  client,
  total,
  badge,
  paiementWarning,
  acompteWarning,
}: {
  r: Reservation;
  client: Client;
  total: number;
  badge: { label: string; className: string } | null;
  paiementWarning: { amount: number; devise: "€" | "EGP" } | null;
  acompteWarning: { montant: number; mode: string } | null;
}) {
  const { nbAd, nbEnf } = participantsFor(r, client);
  return (
    <div className="rounded-md bg-[#fafafa]/50 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-[#171717]">
          {r.nom_activite || "Activité sans nom"}
          {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
        </span>
        {acompteWarning && (
          <span className="text-xs font-medium text-yellow-700">
            ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
          </span>
        )}
        {paiementWarning && (
          <span className="text-xs font-medium text-red-600">
            ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
        <span>{fmtDate(r.date_debut)}</span>
        {r.moment && !hideMoment(r.nom_activite, r.horaire_souhaite) && <span>· {r.moment}</span>}
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-amounts text-xs font-medium text-[#171717]">{euros(total)} €</span>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

function AppelRow({
  c,
  todayStr,
  assignee,
  onUpdateClient,
  onOpenClient,
}: {
  c: Client;
  todayStr: string;
  assignee: string;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  onOpenClient: (id: string) => void;
}) {
  if (c.prochain_appel_confirme) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm">
        <span className="font-amounts text-neutral-500">
          {fmtDate(c.prochain_appel_date)} {c.prochain_appel_heure}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {c.prochain_appel_fuseau === "egypte" ? "Heure égyptienne" : "Heure française"}
        </span>
        {c.prochain_appel_plateforme && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {c.prochain_appel_plateforme}
          </span>
        )}
        <span>
          <strong>{c.nom || "Sans nom"}</strong>
        </span>
        {assignee && (
          <span className="rounded-full bg-[#171717]/10 px-2 py-0.5 text-xs text-[#171717]">
            👤 {assignee}
          </span>
        )}
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
          Confirmé ✓
        </span>
        <span className="flex-1" />
        <button
          onClick={() => onUpdateClient(c.id, { prochain_appel_confirme: false })}
          className="text-xs text-neutral-500 hover:underline"
        >
          Annuler la confirmation
        </button>
        <JumpBtn onClick={() => onOpenClient(c.id)} />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm ${
        c.prochain_appel_date === todayStr
          ? "border-[#f5a623] bg-[#f5a623]/10"
          : "border-neutral-200 bg-white"
      }`}
    >
      <input
        type="date"
        value={c.prochain_appel_date ?? ""}
        onChange={(e) => onUpdateClient(c.id, { prochain_appel_date: e.target.value || null })}
        className="input w-36 text-xs"
      />
      <input
        type="time"
        value={c.prochain_appel_heure}
        onChange={(e) => onUpdateClient(c.id, { prochain_appel_heure: e.target.value })}
        className="input w-28 text-xs"
      />
      <select
        value={c.prochain_appel_fuseau}
        onChange={(e) =>
          onUpdateClient(c.id, { prochain_appel_fuseau: e.target.value as "france" | "egypte" })
        }
        className="input w-32 text-xs"
      >
        <option value="france">Heure française</option>
        <option value="egypte">Heure égyptienne</option>
      </select>
      <select
        value={c.prochain_appel_plateforme}
        onChange={(e) => onUpdateClient(c.id, { prochain_appel_plateforme: e.target.value })}
        className="input w-36 text-xs"
      >
        <option value="">Plateforme…</option>
        {APPEL_PLATEFORMES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <span>
        <strong>{c.nom || "Sans nom"}</strong>
      </span>
      {assignee && (
        <span className="rounded-full bg-[#171717]/10 px-2 py-0.5 text-xs text-[#171717]">
          👤 {assignee}
        </span>
      )}
      <span className="flex-1" />
      <label className="flex items-center gap-1 text-xs text-neutral-600">
        <input
          type="checkbox"
          checked={c.prochain_appel_confirme}
          onChange={(e) => onUpdateClient(c.id, { prochain_appel_confirme: e.target.checked })}
        />
        Confirmé
      </label>
      <button
        onClick={() =>
          onUpdateClient(c.id, {
            prochain_appel_date: null,
            prochain_appel_heure: "",
            prochain_appel_fuseau: "france",
            prochain_appel_plateforme: "",
            prochain_appel_confirme: false,
          })
        }
        className="text-xs text-red-600 hover:underline"
      >
        Retirer
      </button>
      <JumpBtn onClick={() => onOpenClient(c.id)} />
    </div>
  );
}

export default function SuivisView({
  sub,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  remboursements,
  profiles,
  planningShifts,
  onUpdateClient,
  onUpdateReservation,
  onOpenClient,
}: {
  sub: SuivisSub;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  remboursements: Remboursement[];
  profiles: Profile[];
  planningShifts: PlanningShift[];
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onOpenClient: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newAppelClientId, setNewAppelClientId] = useState("");
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, string>>({});
  const [chambreDrafts, setChambreDrafts] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rdvModalClientId, setRdvModalClientId] = useState<string | null>(null);
  const [rdvKanbanView, setRdvKanbanView] = useState<string>("demain");
  const toggleExpand = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));
  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };
  const soldeRestantFor = (c: Client) => {
    const acomptePaye =
      c.paiement_type === "acompte" && c.acompte_paye ? Number(c.acompte_montant) || 0 : 0;
    const totalSejour = reservations
      .filter((r) => r.client_id === c.id)
      .reduce((sum, r) => sum + resaTotalMontant(r, c, resaOptions[r.id] || [], resaTarifs[r.id] || []), 0);
    return Math.max(totalSejour - acomptePaye, 0);
  };
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);
  const tomorrowStr = addDays(todayStr, 1);
  const pastDeadline = now.getHours() >= 18;

  const rdvRows = clients
    .filter((c) => !c.solde_activite_id && (c.solde_rdv_heure || c.solde_rdv_lieu))
    .sort((a, b) => (a.solde_date || "").localeCompare(b.solde_date || ""));

  // RDV paiement à l'hôtel prévu aujourd'hui : à envoyer le matin même —
  // rappel horaire au client, et hôtel + heure + montant à la personne
  // assignée (Bodé ou Sylvie) qui récupère le règlement.
  const rdvTodayRows = rdvRows.filter((c) => c.solde_date === todayStr);

  // Kanban "à venir" : une vue Demain, une vue 7 prochains jours, puis une
  // vue par mois (calculée à partir des RDV réellement programmés, pas
  // tous les mois du calendrier) — colonnes par jour dans chaque vue.
  const rdvUpcomingRows = rdvRows.filter((c) => (c.solde_date || "") > todayStr);
  const rdvMonthKeys = Array.from(
    new Set(rdvUpcomingRows.map((c) => (c.solde_date || "").slice(0, 7)).filter(Boolean))
  ).sort();
  const rdvKanbanViews = [
    { key: "demain", label: "Demain" },
    { key: "7jours", label: "7 prochains jours" },
    ...rdvMonthKeys.map((ym) => ({ key: ym, label: fmtMonthLabel(ym) })),
  ];
  const in7DaysStr = addDays(todayStr, 7);
  const rdvKanbanRows = rdvUpcomingRows.filter((c) => {
    const d = c.solde_date || "";
    if (rdvKanbanView === "demain") return d === tomorrowStr;
    if (rdvKanbanView === "7jours") return d > todayStr && d <= in7DaysStr;
    return d.slice(0, 7) === rdvKanbanView;
  });
  const rdvKanbanDays = Array.from(
    new Set(rdvKanbanRows.map((c) => c.solde_date as string))
  ).sort();

  const auRevoirRows = clients
    .filter((c) => c.date_fin)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 1) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const auRevoirUpcomingRows = clients
    .filter((c) => c.date_fin)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 1) }))
    .filter((x) => x.dateCible > todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const avisRows = clients
    .filter((c) => c.date_fin)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 7) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const avisUpcomingRows = clients
    .filter((c) => c.date_fin)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 7) }))
    .filter((x) => x.dateCible > todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const remboursementRows = [...remboursements].sort((a, b) =>
    (b.date_probleme || "").localeCompare(a.date_probleme || "")
  );

  const billetsRows = reservations.filter((r) => r.billet_requis);

  // Personne assignée à un appel : déduite du planning équipe (qui travaille
  // à cette date, à cette heure), pas une saisie manuelle — plusieurs noms
  // possibles si plusieurs personnes sont en poste au même moment.
  const personneAssigneeAppel = (date: string | null, heure: string) =>
    profilesOnShiftAt(profiles, planningShifts, date, heure).map(profileName).join(" / ");

  const appelsRows = clients
    .filter((c) => c.prochain_appel_date)
    .sort((a, b) => (a.prochain_appel_date || "").localeCompare(b.prochain_appel_date || ""));

  const appelsDueRows = appelsRows.filter((c) => (c.prochain_appel_date || "") <= todayStr);
  const appelsUpcomingRows = appelsRows.filter((c) => (c.prochain_appel_date || "") > todayStr);

  // Règle métier : le pick-up réel n'est jamais communiqué au client avant
  // J-1, et doit toujours être confirmé avant 18h la veille — jamais plus
  // tôt, jamais plus tard. Idem pour demander le numéro de chambre.
  const pickupsJ1 = reservations
    .filter((r) => r.date_debut === tomorrowStr)
    .map((r) => ({ r, client: clients.find((c) => c.id === r.client_id) }))
    .filter((x): x is { r: Reservation; client: Client } => !!x.client)
    .sort((a, b) => (a.r.moment || "").localeCompare(b.r.moment || ""));
  // Trié entre manquants et déjà renseignés — pour s'y retrouver quand il y
  // a 50 pick-ups dans la journée.
  const pickupsJ1Missing = pickupsJ1.filter(({ r }) => !r.pickup_reel);
  const pickupsJ1Done = pickupsJ1.filter(({ r }) => r.pickup_reel);

  const roomsJ1 = clients.filter((c) => c.date_debut === tomorrowStr);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      {sub === "j1" && (
        <div className="space-y-6">
          <div className="rounded-md border border-[#f5a623]/30 bg-[#f5a623]/10 p-3 text-xs text-[#666666]">
            Règle : le pick-up réel n&apos;est communiqué au client qu&apos;à J-1, avant 18h
            maximum — jamais avant. Le numéro de chambre se demande aussi à J-1.
          </div>

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              Pick-ups manquants pour demain ({fmtDate(tomorrowStr)})
            </h3>
            {pickupsJ1Missing.length === 0 ? (
              <div className="text-sm text-neutral-400">
                {pickupsJ1.length === 0 ? "Aucune activité prévue demain." : "Tous les pick-ups sont renseignés ✓"}
              </div>
            ) : (
              <div className="space-y-2">
                {pickupsJ1Missing.map(({ r, client }) => {
                  const urgent = pastDeadline;
                  const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
                  const badge = paiementBadge(client, r);
                  const paiementWarning = activitePaiementWarning(
                    client,
                    r,
                    reservations,
                    resaOptions,
                    resaTarifs
                  );
                  const acompteWarning = acompteWaitingWarning(client, r, reservations);
                  const teamMsg = pickupMissingTeamMessage(r, client);
                  return (
                    <div
                      key={r.id}
                      className={`flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start ${
                        urgent ? "border-red-400 bg-red-50" : "border-[#f5a623]/40 bg-[#f5a623]/5"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="mb-1.5 flex items-center gap-2 text-xs">
                          <strong className="text-sm text-[#171717]">{client.nom || "Sans nom"}</strong>
                          {urgent && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
                              En retard — 18h dépassé
                            </span>
                          )}
                          <span className="flex-1" />
                          <JumpBtn onClick={() => onOpenClient(client.id)} />
                        </div>
                        <PickupActivityCard
                          r={r}
                          client={client}
                          total={total}
                          badge={badge}
                          paiementWarning={paiementWarning}
                          acompteWarning={acompteWarning}
                        />
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-56">
                        <input
                          type="text"
                          placeholder="Pick-up réel (heure / lieu)"
                          value={pickupDrafts[r.id] ?? ""}
                          onChange={(e) => setPickupDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                          className="input text-xs"
                        />
                        <button
                          onClick={() => {
                            const val = (pickupDrafts[r.id] || "").trim();
                            if (!val) return;
                            onUpdateReservation(r.id, { pickup_reel: val });
                            setPickupDrafts((d) => ({ ...d, [r.id]: "" }));
                          }}
                          className="rounded-md bg-[#171717] px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => copyText("pickup-missing-" + r.id, teamMsg)}
                          className="rounded-md border border-red-600 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          {copiedKey === "pickup-missing-" + r.id
                            ? "Copié ✓"
                            : "Rappel pick-up manquant"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pickupsJ1Done.length > 0 && (
            <div>
              <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
                Pick-ups confirmés pour demain
              </h3>
              <div className="space-y-2">
                {pickupsJ1Done.map(({ r, client }) => {
                  const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
                  const badge = paiementBadge(client, r);
                  const paiementWarning = activitePaiementWarning(
                    client,
                    r,
                    reservations,
                    resaOptions,
                    resaTarifs
                  );
                  const acompteWarning = acompteWaitingWarning(client, r, reservations);
                  const montantRestant = soldeRestantFor(client);
                  const clientMsg = pickupClientMessage(r, client, montantRestant);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 sm:flex-row sm:items-start"
                    >
                      <div className="flex-1">
                        <div className="mb-1.5 flex items-center gap-2 text-xs">
                          <strong className="text-sm text-[#171717]">{client.nom || "Sans nom"}</strong>
                          <span className="rounded-full bg-[#171717]/10 px-2 py-0.5 text-[11px] text-[#171717]">
                            Pick-up {r.pickup_reel}
                          </span>
                          <span className="flex-1" />
                          <JumpBtn onClick={() => onOpenClient(client.id)} />
                        </div>
                        <PickupActivityCard
                          r={r}
                          client={client}
                          total={total}
                          badge={badge}
                          paiementWarning={paiementWarning}
                          acompteWarning={acompteWarning}
                        />
                      </div>
                      <div className="flex w-full sm:w-56">
                        <button
                          onClick={() => copyText("pickup-client-" + r.id, clientMsg)}
                          className="w-full rounded-md bg-[#171717] px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          {copiedKey === "pickup-client-" + r.id ? "Copié ✓" : "Copier message client"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              Numéros de chambre à demander pour demain
            </h3>
            {roomsJ1.length === 0 && (
              <div className="text-sm text-neutral-400">Aucune arrivée prévue demain.</div>
            )}
            <div className="space-y-2">
              {roomsJ1.map((c) => {
                const missing = !c.chambre;
                const urgent = missing && pastDeadline;
                return (
                  <div
                    key={c.id}
                    className={`flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm ${
                      urgent
                        ? "border-red-400 bg-red-50"
                        : missing
                          ? "border-[#f5a623] bg-[#f5a623]/10"
                          : "border-neutral-200 bg-white"
                    }`}
                  >
                    <span>
                      <strong>{c.nom || "Sans nom"}</strong> — {c.hotel || "Hôtel ?"}
                    </span>
                    {missing ? (
                      <>
                        {urgent && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
                            En retard — 18h dépassé
                          </span>
                        )}
                        <input
                          type="text"
                          placeholder="N° de chambre"
                          value={chambreDrafts[c.id] ?? ""}
                          onChange={(e) =>
                            setChambreDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                          }
                          className="input w-32 text-xs"
                        />
                        <button
                          onClick={() => {
                            const val = (chambreDrafts[c.id] || "").trim();
                            if (!val) return;
                            onUpdateClient(c.id, { chambre: val });
                            setChambreDrafts((d) => ({ ...d, [c.id]: "" }));
                          }}
                          className="rounded-md bg-[#171717] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                          Confirmer
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-[#171717]/10 px-2 py-0.5 text-[11px] text-[#171717]">
                        Chambre {c.chambre}
                      </span>
                    )}
                    <span className="flex-1" />
                    <JumpBtn onClick={() => onOpenClient(c.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {sub === "rdv" && (
        <div className="space-y-6">
          {rdvModalClientId &&
            (() => {
              const c = clients.find((cl) => cl.id === rdvModalClientId);
              if (!c) return null;
              return (
                <RdvPaiementModal
                  c={c}
                  montant={soldeRestantFor(c)}
                  copiedKey={copiedKey}
                  onCopy={copyText}
                  onOpenClient={onOpenClient}
                  onClose={() => setRdvModalClientId(null)}
                />
              );
            })()}

          {rdvTodayRows.length > 0 && (
            <div>
              <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
                RDV paiement aujourd&apos;hui — à envoyer ce matin
              </h3>
              <div className="space-y-3">
                {rdvTodayRows.map((c) => {
                  const montant = soldeRestantFor(c);
                  const clientMsg = `Bonjour ${c.nom || ""}, petit rappel pour aujourd'hui : rendez-vous à ${c.solde_rdv_heure || "l'heure convenue"} devant l'hôtel ${c.hotel || "—"} (à l'extérieur) pour le règlement du solde de ${euros(montant)} €. À tout à l'heure !`;
                  const teamMsg = `Payment appointment today — ${c.nom || "No name"} — Hotel ${c.hotel || "—"} — ${c.solde_rdv_heure || "time ?"} — Amount to collect: ${euros(montant)} €`;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setRdvModalClientId(c.id)}
                      className="cursor-pointer rounded-md border border-[#0070f3] bg-[#0070f3]/10 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-amounts text-neutral-600">{c.solde_rdv_heure}</span>
                        <span>
                          <strong>{c.nom || "Sans nom"}</strong> — {c.hotel || "Hôtel ?"}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#171717]">
                          👤 {c.solde_assigne_a || "Non assigné"}
                        </span>
                        <span className="font-amounts font-medium text-[#171717]">
                          {euros(montant)} €
                        </span>
                        <span className="flex-1" />
                        <JumpBtn onClick={() => onOpenClient(c.id)} />
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyText("client-" + c.id, clientMsg);
                          }}
                          className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                          {copiedKey === "client-" + c.id ? "Copié ✓" : "Copier message client"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyText("team-" + c.id, teamMsg);
                          }}
                          className="rounded-full bg-[#666666] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                          {copiedKey === "team-" + c.id
                            ? "Copié ✓"
                            : `Copier message ${c.solde_assigne_a || "équipe"}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              Rendez-vous de paiement à venir
            </h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {rdvKanbanViews.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setRdvKanbanView(v.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    rdvKanbanView === v.key
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-neutral-300 bg-white text-neutral-600"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {rdvKanbanDays.length === 0 ? (
              <div className="text-sm text-neutral-400">Aucun RDV paiement sur cette période.</div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {rdvKanbanDays.map((day) => {
                  const dayRows = rdvKanbanRows.filter((c) => c.solde_date === day);
                  return (
                    <div key={day} className="w-56 flex-shrink-0 rounded-md border border-neutral-200 bg-[#fafafa] p-2">
                      <div className="mb-2 px-1 text-xs font-semibold capitalize text-[#171717]">
                        {fmtDayColumn(day)}
                        <span className="ml-1 font-normal text-neutral-400">({dayRows.length})</span>
                      </div>
                      <div className="space-y-2">
                        {dayRows.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setRdvModalClientId(c.id)}
                            className="cursor-pointer rounded-md border border-neutral-200 bg-white p-2.5 text-xs hover:border-[#0070f3]"
                          >
                            <div className="font-amounts text-neutral-500">{c.solde_rdv_heure}</div>
                            <div className="font-medium text-[#171717]">{c.nom || "Sans nom"}</div>
                            <div className="text-neutral-500">{c.hotel || "Hôtel ?"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {sub === "appels" && (
        <div className="space-y-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white p-3">
            <select
              value={newAppelClientId}
              onChange={(e) => setNewAppelClientId(e.target.value)}
              className="input flex-1"
            >
              <option value="">Choisir un client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom || "Sans nom"}
                </option>
              ))}
            </select>
            <input
              type="date"
              onChange={(e) => {
                if (newAppelClientId && e.target.value) {
                  onUpdateClient(newAppelClientId, { prochain_appel_date: e.target.value });
                  setNewAppelClientId("");
                }
              }}
              className="input w-40"
            />
          </div>

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              Appels programmés
            </h3>
            {appelsDueRows.length === 0 && (
              <div className="text-sm text-neutral-400">Aucun appel programmé.</div>
            )}
            <div className="space-y-2">
              {appelsDueRows.map((c) => (
                <AppelRow
                  key={c.id}
                  c={c}
                  todayStr={todayStr}
                  assignee={personneAssigneeAppel(c.prochain_appel_date, c.prochain_appel_heure)}
                  onUpdateClient={onUpdateClient}
                  onOpenClient={onOpenClient}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              Prochains appels à venir
            </h3>
            {appelsUpcomingRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à venir pour l&apos;instant.</div>
            )}
            <div className="space-y-2">
              {appelsUpcomingRows.map((c) => (
                <AppelRow
                  key={c.id}
                  c={c}
                  todayStr={todayStr}
                  assignee={personneAssigneeAppel(c.prochain_appel_date, c.prochain_appel_heure)}
                  onUpdateClient={onUpdateClient}
                  onOpenClient={onOpenClient}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "aurevoir" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
            Messages de bon retour à envoyer (J+1)
          </h3>
          {auRevoirRows.length === 0 && (
            <div className="text-sm text-neutral-400">Rien à envoyer pour l&apos;instant.</div>
          )}
          <div className="space-y-2">
            {auRevoirRows.map(({ c, dateCible }) => (
              <div
                key={c.id}
                className={`rounded-md border p-3 text-sm ${
                  dateCible === todayStr
                    ? "border-[#f5a623] bg-[#f5a623]/10"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-amounts text-neutral-500">
                    {fmtDate(dateCible)}
                    {dateCible === todayStr ? " — aujourd'hui" : ""}
                  </span>
                  <span>
                    <strong>{c.nom || "Sans nom"}</strong>
                  </span>
                  <label className="flex items-center gap-1 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={c.au_revoir_envoye}
                      onChange={(e) => onUpdateClient(c.id, { au_revoir_envoye: e.target.checked })}
                    />
                    Envoyé
                  </label>
                  <span className="flex-1" />
                  <button
                    onClick={() => copyText("aurevoir-" + c.id, auRevoirMessage(c.nom))}
                    className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    {copiedKey === "aurevoir-" + c.id ? "Copié ✓" : "Copier le message"}
                  </button>
                  <JumpBtn onClick={() => onOpenClient(c.id)} />
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-heading mb-2 mt-6 text-sm font-semibold text-[#171717]">
              À venir
            </h3>
            {auRevoirUpcomingRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à venir pour l&apos;instant.</div>
            )}
            <div className="space-y-2">
              {auRevoirUpcomingRows.map(({ c, dateCible }) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm"
                >
                  <span className="font-amounts text-neutral-500">{fmtDate(dateCible)}</span>
                  <span>
                    <strong>{c.nom || "Sans nom"}</strong>
                  </span>
                  <span className="flex-1" />
                  <JumpBtn onClick={() => onOpenClient(c.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "avis" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
            Demandes d&apos;avis à envoyer (J+7)
          </h3>
          {avisRows.length === 0 && (
            <div className="text-sm text-neutral-400">Rien à envoyer pour l&apos;instant.</div>
          )}
          <div className="space-y-2">
            {avisRows.map(({ c, dateCible }) => (
              <div
                key={c.id}
                className={`rounded-md border p-3 text-sm ${
                  dateCible === todayStr
                    ? "border-[#f5a623] bg-[#f5a623]/10"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-amounts text-neutral-500">
                    {fmtDate(dateCible)}
                    {dateCible === todayStr ? " — aujourd'hui" : ""}
                  </span>
                  <span>
                    <strong>{c.nom || "Sans nom"}</strong>
                  </span>
                  <label className="flex items-center gap-1 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={c.avis_envoye}
                      onChange={(e) => onUpdateClient(c.id, { avis_envoye: e.target.checked })}
                    />
                    Envoyé
                  </label>
                  <span className="flex-1" />
                  <button
                    onClick={() => copyText("avis-" + c.id, avisMessage(c.nom))}
                    className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    {copiedKey === "avis-" + c.id ? "Copié ✓" : "Copier le message"}
                  </button>
                  <JumpBtn onClick={() => onOpenClient(c.id)} />
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-heading mb-2 mt-6 text-sm font-semibold text-[#171717]">
              À venir
            </h3>
            {avisUpcomingRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à venir pour l&apos;instant.</div>
            )}
            <div className="space-y-2">
              {avisUpcomingRows.map(({ c, dateCible }) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm"
                >
                  <span className="font-amounts text-neutral-500">{fmtDate(dateCible)}</span>
                  <span>
                    <strong>{c.nom || "Sans nom"}</strong>
                  </span>
                  <span className="flex-1" />
                  <JumpBtn onClick={() => onOpenClient(c.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "remb" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
            Remboursements
          </h3>
          {remboursementRows.length === 0 && (
            <div className="text-sm text-neutral-400">Aucun remboursement enregistré.</div>
          )}
          <div className="space-y-2">
            {remboursementRows.map((r) => {
              const client = clients.find((c) => c.id === r.client_id);
              if (!client) return null;
              const activite = reservations.find((res) => res.id === r.activite_id);
              const key = "remb-" + r.id;
              const isOpen = expanded[key];
              return (
                <div key={r.id} className="rounded-md border border-neutral-200 bg-white">
                  <div
                    onClick={() => toggleExpand(key)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm"
                  >
                    <span className="font-amounts text-neutral-500">
                      {fmtDate(r.date_probleme)}
                    </span>
                    <span>
                      <strong>{client.nom || "Sans nom"}</strong> —{" "}
                      {r.raison === "Autre" ? r.raison_autre || "Autre" : r.raison}
                    </span>
                    <span className="text-neutral-500">
                      {activite ? activite.nom_activite : "Non liée"}
                    </span>
                    <span className="font-amounts">{euros(r.montant)} €</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.statut === "Effectué"
                          ? "bg-[#171717]/10 text-[#171717]"
                          : "bg-[#f5a623]/20 text-[#666666]"
                      }`}
                    >
                      {r.statut}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="space-y-1 border-t border-neutral-100 p-3 text-sm text-neutral-600">
                      <div>Mode : {r.mode || "—"}</div>
                      <div>Fait par : {r.par || "—"}</div>
                      <div>
                        Date du remboursement :{" "}
                        {r.date_remboursement ? fmtDate(r.date_remboursement) : "—"}
                      </div>
                      <JumpBtn onClick={() => onOpenClient(client.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sub === "billets" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
            Billets d&apos;avion — pour Hossam
          </h3>
          {billetsRows.length === 0 && (
            <div className="text-sm text-neutral-400">
              Aucune activité avec billet à gérer pour l&apos;instant.
            </div>
          )}
          <div className="space-y-2">
            {billetsRows.map((r) => {
              const client = clients.find((c) => c.id === r.client_id);
              if (!client) return null;
              const key = "billet-" + r.id;
              const isOpen = expanded[key];
              return (
                <div key={r.id} className="rounded-md border border-neutral-200 bg-white">
                  <div
                    onClick={() => toggleExpand(key)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm"
                  >
                    <span className="font-amounts text-neutral-500">
                      {r.billet_date ? fmtDate(r.billet_date) : "Date ?"}
                    </span>
                    <span>
                      <strong>{client.nom || "Sans nom"}</strong> —{" "}
                      {r.nom_activite || "Activité"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.billet_acompte_paye
                          ? "bg-[#171717]/10 text-[#171717]"
                          : "bg-[#f5a623]/20 text-[#666666]"
                      }`}
                    >
                      Acompte {r.billet_acompte_paye ? "payé" : "en attente"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.billet_envoye
                          ? "bg-[#171717]/10 text-[#171717]"
                          : "bg-[#f5a623]/20 text-[#666666]"
                      }`}
                    >
                      {r.billet_envoye ? "Envoyé" : "Pas envoyé"}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {r.billet_statut}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="space-y-1 border-t border-neutral-100 p-3 text-sm text-neutral-600">
                      {r.billet_lien && (
                        <div>
                          <a
                            href={r.billet_lien}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#171717] underline"
                          >
                            Voir le billet
                          </a>
                        </div>
                      )}
                      <div>Notes : {r.billet_notes || "—"}</div>
                      <JumpBtn onClick={() => onOpenClient(client.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
