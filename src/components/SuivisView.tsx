"use client";

import { useEffect, useState } from "react";
import {
  CatalogueItem,
  Client,
  PlanningShift,
  Profile,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { addDays, localDateStr, todayStr } from "@/lib/dates";
import {
  acompteWaitingWarning,
  activitePaiementWarning,
  hideMoment,
  hossamBilletMessage,
  paiementBadge,
  participantsFor,
  resaTotalMontant,
} from "@/lib/resa";
import { profileName, profilesOnShiftAt } from "@/lib/planning";
import { BILLET_ETAPES, VILLES_VOL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function daysBetween(laterStr: string, earlierStr: string) {
  const a = new Date(laterStr + "T00:00:00");
  const b = new Date(earlierStr + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function VoirRibLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.storage.from("rib-screenshots").createSignedUrl(path, 3600);
        setLoading(false);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      }}
      className="text-xs font-medium text-[#171717] underline hover:no-underline"
    >
      {loading ? "Ouverture…" : "Voir le RIB"}
    </button>
  );
}

function BilletEtapeTracker({
  etape,
  demandeEnvoyeeLe,
  onChange,
}: {
  etape: string;
  demandeEnvoyeeLe: string | null;
  onChange: (patch: { billet_etape: string; billet_demande_envoyee_le?: string }) => void;
}) {
  const currentIdx = Math.max(
    0,
    BILLET_ETAPES.findIndex((e) => e.key === etape)
  );
  const joursAttente =
    etape === "attente_hossam" && demandeEnvoyeeLe
      ? Math.floor((Date.parse(todayStr()) - Date.parse(demandeEnvoyeeLe)) / 86400000)
      : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        {BILLET_ETAPES.map((e, i) => (
          <button
            key={e.key}
            type="button"
            title={e.label}
            onClick={() =>
              onChange({
                billet_etape: e.key,
                ...(e.key === "attente_hossam" && !demandeEnvoyeeLe
                  ? { billet_demande_envoyee_le: todayStr() }
                  : {}),
              })
            }
            className={`h-2.5 w-7 rounded-full transition-colors ${
              i <= currentIdx ? "bg-[#0F5C56]" : "bg-neutral-200"
            } ${i === currentIdx ? "ring-2 ring-[#0F5C56]/40" : ""}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-[#171717]">{BILLET_ETAPES[currentIdx].label}</span>
      {joursAttente !== null && joursAttente >= 2 && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          ⏱ En attente depuis {joursAttente} j
        </span>
      )}
    </div>
  );
}

function VoirBilletLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.storage.from("billets-avion").createSignedUrl(path, 3600);
        setLoading(false);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      }}
      className="text-xs font-medium text-[#171717] underline hover:no-underline"
    >
      {loading ? "Ouverture…" : "Voir le billet"}
    </button>
  );
}

function RemboursementCard({
  r,
  client,
  activite,
  isOpen,
  onToggle,
  onOpenClient,
}: {
  r: Remboursement;
  client: Client;
  activite: Reservation | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onOpenClient: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div onClick={onToggle} className="cursor-pointer px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ClientNameLink
            nom={client.nom}
            onClick={() => onOpenClient(client.id)}
            className="font-heading text-sm font-semibold text-[#171717] hover:underline"
          />
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                r.statut === "Effectué" ? "bg-green-100 text-green-700" : "bg-[#f5a623]/20 text-[#8B4531]"
              }`}
            >
              {r.statut}
            </span>
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
              {r.mode}
            </span>
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          <strong className="text-[#171717]">
            {r.raison === "Autre" ? r.raison_autre || "Autre" : r.raison}
          </strong>
          {" — "}
          {activite ? activite.nom_activite : "Aucune activité liée"}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="font-heading text-sm font-semibold text-[#171717]">
            {euros(r.montant)} €
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-2 border-t border-neutral-100 px-3 py-2.5 text-xs text-neutral-600">
          {r.details && <div className="rounded-md bg-[#fafafa] p-3 text-[#171717]">{r.details}</div>}
          <div className="grid grid-cols-2 gap-2">
            <div>
              Date de l&apos;activité : {activite?.date_debut ? fmtDate(activite.date_debut) : "—"}
            </div>
            <div>Date de l&apos;annulation : {fmtDate(r.date_probleme)}</div>
            <div>Fait par : {r.par || "—"}</div>
            <div>
              Date du remboursement : {r.date_remboursement ? fmtDate(r.date_remboursement) : "—"}
            </div>
          </div>
          {r.mode === "PayPal" && r.paypal_email && <div>Adresse PayPal : {r.paypal_email}</div>}
          {r.mode === "Virement bancaire" && r.rib_photo_path && (
            <div>
              <VoirRibLink path={r.rib_photo_path} />
            </div>
          )}
        </div>
      )}
    </div>
  );
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
// Bloc copié-collé pour Hossam — le nom complet doit être recopié tel quel
// (comme au passeport) pour éviter toute faute transmise au prestataire.
export const SUIVIS_SUBS = [
  { key: "j1", label: "Pick-ups (J-1)" },
  { key: "chambres", label: "Numéros de chambre" },
  { key: "rdv", label: "RDV paiements" },
  { key: "appels", label: "Appels" },
  { key: "aurevoir", label: "Au revoir" },
  { key: "avis", label: "Avis clients" },
  { key: "remb", label: "Remboursements" },
  { key: "billets", label: "Billets d'avion" },
] as const;

export type SuivisSub = (typeof SUIVIS_SUBS)[number]["key"];

const APPEL_PLATEFORMES = ["Instagram", "WhatsApp", "Mobile", "Google Meet", "Zoom"];

// Remplace le bouton "→ Fiche client" : le prénom/nom lui-même amène à la
// fiche, en un clic au lieu de deux.
function ClientNameLink({
  nom,
  onClick,
  className,
}: {
  nom: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={className ?? "font-semibold text-[#171717] hover:underline"}
    >
      {nom || "Sans nom"}
    </button>
  );
}

const AVIS_STATUT_STYLES: Record<Client["avis_statut"], string> = {
  "À demander": "border-[#4A7FD6]/40 bg-[#4A7FD6]/10 text-[#3861A8]",
  "À ne pas demander": "border-[#D6544A]/40 bg-[#D6544A]/10 text-[#B23F36]",
  "Déjà publié": "border-[#3E8F5C]/40 bg-[#3E8F5C]/10 text-[#2C6B44]",
};

function AvisStatutSelector({
  value,
  onChange,
}: {
  value: Client["avis_statut"];
  onChange: (v: Client["avis_statut"]) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Client["avis_statut"])}
      className={`ml-auto shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium outline-none ${AVIS_STATUT_STYLES[value]}`}
    >
      <option value="À demander">À demander</option>
      <option value="À ne pas demander">À ne pas demander</option>
      <option value="Déjà publié">Déjà publié</option>
    </select>
  );
}

function DateRangeBadge({ debut, fin }: { debut: string | null; fin: string | null }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F2E6D2] px-2 py-0.5 text-[11px] text-[#8B4531]">
      <span>{debut ? fmtDate(debut) : "?"}</span>
      <span className="text-[#C9973E]">→</span>
      <span>{fin ? fmtDate(fin) : "?"}</span>
    </span>
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
          <div className="font-medium text-[#171717]">Montant : {euros(montant)} €</div>
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
  return `Missing pick-up — ${client.nom || "No name"} — ${r.nom_activite || "No activity name"}${
    detail ? ` (${detail})` : ""
  }`;
}

function pickupClientMessage(
  r: Reservation,
  client: Client,
  montantRestant: number,
  catalogue: CatalogueItem[]
) {
  const prenom = firstNameOf(client.nom) || "—";
  const catalogueItem = r.catalogue_item_id
    ? catalogue.find((a) => a.id === r.catalogue_item_id)
    : null;
  // Ce qu'il faut prévoir vient du catalogue (liste structurée), pas du
  // champ libre de la réservation — c'est la vraie liste tenue à jour par
  // activité, alors que la copie sur la réservation peut être vide/périmée.
  const aPrevoirListe = catalogueItem?.a_prevoir_liste?.length
    ? catalogueItem.a_prevoir_liste.join(", ")
    : catalogueItem?.a_prevoir || r.a_prevoir || "le nécessaire pour l'activité";
  const soldeIci = client.solde_activite_id === r.id && !client.solde_paye;
  const paiementLigne = soldeIci
    ? `\n\nComme convenu, vous pourrez régler le solde de ${euros(montantRestant)}€ en espèces en euros demain, auprès de notre représentant sur place.`
    : "";
  return `Bonjour ${prenom},\n\nPour votre activité ${r.nom_activite || "—"} demain, le chauffeur viendra vous récupérer à ${r.pickup_reel}, devant la réception de votre hôtel, côté extérieur.\n\nÀ prévoir avec vous pour l'activité : ${aPrevoirListe}.${paiementLigne}\n\nVous retrouverez le programme complet de votre journée de demain sur votre page client. ☀️`;
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
  onAskPickup,
}: {
  r: Reservation;
  client: Client;
  total: number;
  badge: { label: string; className: string } | null;
  paiementWarning: { amount: number; devise: "€" | "EGP" } | null;
  acompteWarning: { montant: number; mode: string } | null;
  onAskPickup: (r: Reservation) => void;
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
        {r.pickup_reel ? (
          <span>· Pick-up {r.pickup_reel}</span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAskPickup(r);
            }}
            title="Pick-up manquant"
            className="text-red-500 hover:text-red-600"
          >
            ⏰
          </button>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[#171717]">{euros(total)} €</span>
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
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <ClientNameLink
            nom={c.nom}
            onClick={() => onOpenClient(c.id)}
            className="font-heading text-sm font-semibold text-[#171717] hover:underline"
          />
          <button
            onClick={() => onUpdateClient(c.id, { prochain_appel_confirme: false })}
            className="shrink-0 text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
          >
            Annuler la confirmation
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span>
            {fmtDate(c.prochain_appel_date)} {c.prochain_appel_heure}
          </span>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
            {c.prochain_appel_fuseau === "egypte" ? "Heure égyptienne" : "Heure française"}
          </span>
          {c.prochain_appel_plateforme && (
            <span className="rounded-full bg-[#0F5C56]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#0F5C56]">
              {c.prochain_appel_plateforme}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {assignee && (
            <span className="rounded-full bg-[#171717]/10 px-1.5 py-0.5 text-[11px] text-[#171717]">
              👤 {assignee}
            </span>
          )}
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700">
            Confirmé ✓
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white p-3 text-sm shadow-sm ${
        c.prochain_appel_date === todayStr ? "border-[#f5a623]" : "border-neutral-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <ClientNameLink
          nom={c.nom}
          onClick={() => onOpenClient(c.id)}
          className="font-heading text-sm font-semibold text-[#171717] hover:underline"
        />
        {c.prochain_appel_date === todayStr && (
          <span className="rounded-full bg-[#f5a623]/20 px-1.5 py-0.5 text-[11px] font-medium text-[#8B4531]">
            Aujourd&apos;hui
          </span>
        )}
        {assignee && (
          <span className="rounded-full bg-[#171717]/10 px-1.5 py-0.5 text-[11px] text-[#171717]">
            👤 {assignee}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
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
      </div>
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
  catalogue,
  onUpdateClient,
  onUpdateReservation,
  onOpenClient,
  initialRdvModalClientId,
}: {
  sub: SuivisSub;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  remboursements: Remboursement[];
  profiles: Profile[];
  planningShifts: PlanningShift[];
  catalogue: CatalogueItem[];
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onOpenClient: (id: string) => void;
  initialRdvModalClientId?: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newAppelClientId, setNewAppelClientId] = useState("");
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, string>>({});
  const [chambreDrafts, setChambreDrafts] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rdvModalClientId, setRdvModalClientId] = useState<string | null>(null);
  // Synchronisation depuis un prop externe (clic "RDV paiement planifié"
  // dans le calendrier) — comparaison au rendu plutôt qu'un useEffect, pour
  // ne déclencher qu'une fois par nouvelle valeur sans cascade de rendus.
  const [lastConsumedRdvId, setLastConsumedRdvId] = useState<string | null | undefined>(undefined);
  if (initialRdvModalClientId && initialRdvModalClientId !== lastConsumedRdvId) {
    setLastConsumedRdvId(initialRdvModalClientId);
    setRdvModalClientId(initialRdvModalClientId);
  }
  const [rdvKanbanView, setRdvKanbanView] = useState<string>("demain");
  const [billetsMonthFilter, setBilletsMonthFilter] = useState<string>("tous");
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
  const askPickup = (r: Reservation) => {
    if (!window.confirm("Pick up manquant, voulez-vous ajouter un pick up ?")) return;
    const val = window.prompt("Pick-up réel (heure / lieu) :", "");
    if (val && val.trim()) onUpdateReservation(r.id, { pickup_reel: val.trim() });
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

  // Une fois "Envoyé" coché, le client sort de la liste "à envoyer" — sinon
  // il y restait pour toujours (coché mais jamais retiré), ce qui donnait
  // l'impression que ça ne menait nulle part.
  const auRevoirRows = clients
    .filter((c) => c.date_fin && !c.au_revoir_envoye)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 1) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  // "Récemment" se base sur la date RÉELLE où l'employée a coché "Envoyé"
  // (au_revoir_envoye_le), pas sur la date cible théorique — sinon un
  // message envoyé en retard (coché aujourd'hui, dû il y a 6 jours)
  // disparaîtrait immédiatement au lieu d'apparaître comme envoyé aujourd'hui.
  const auRevoirEnvoyesRecemment = clients
    .filter((c) => c.au_revoir_envoye && c.au_revoir_envoye_le)
    .filter((c) => daysBetween(todayStr, c.au_revoir_envoye_le as string) <= 3)
    .sort((a, b) => (b.au_revoir_envoye_le as string).localeCompare(a.au_revoir_envoye_le as string));

  const auRevoirUpcomingRows = clients
    .filter((c) => c.date_fin && !c.au_revoir_envoye)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 1) }))
    .filter((x) => x.dateCible > todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const avisRows = clients
    .filter((c) => c.date_fin && !c.avis_envoye)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 7) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const avisEnvoyesRecemment = clients
    .filter((c) => c.avis_envoye && c.avis_envoye_le)
    .filter((c) => daysBetween(todayStr, c.avis_envoye_le as string) <= 3)
    .sort((a, b) => (b.avis_envoye_le as string).localeCompare(a.avis_envoye_le as string));

  const avisUpcomingRows = clients
    .filter((c) => c.date_fin && !c.avis_envoye)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 7) }))
    .filter((x) => x.dateCible > todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const remboursementsEnAttente = remboursements
    .filter((r) => r.statut !== "Effectué")
    .sort((a, b) => (a.date_probleme || "").localeCompare(b.date_probleme || ""));

  // "Effectués" se trie par semaine puis par mois — date de référence : le
  // jour où l'argent est réellement parti, sinon la date du problème.
  const remboursementDateRef = (r: Remboursement) => r.date_remboursement || r.date_probleme || "";
  const remboursementWeekStart = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return localDateStr(d);
  };
  const remboursementsEffectuesParMoisSemaine = (() => {
    const withDate = remboursements
      .filter((r) => r.statut === "Effectué" && remboursementDateRef(r))
      .sort((a, b) => remboursementDateRef(b).localeCompare(remboursementDateRef(a)));
    const parMois = new Map<string, Map<string, Remboursement[]>>();
    withDate.forEach((r) => {
      const date = remboursementDateRef(r);
      const moisKey = date.slice(0, 7);
      const semaineKey = remboursementWeekStart(date);
      if (!parMois.has(moisKey)) parMois.set(moisKey, new Map());
      const parSemaine = parMois.get(moisKey)!;
      parSemaine.set(semaineKey, [...(parSemaine.get(semaineKey) || []), r]);
    });
    return Array.from(parMois.entries()).map(([mois, semaines]) => ({
      mois,
      semaines: Array.from(semaines.entries()).sort((a, b) => b[0].localeCompare(a[0])),
    }));
  })();
  const remboursementsSansDate = remboursements.filter(
    (r) => r.statut === "Effectué" && !remboursementDateRef(r)
  );

  const billetsAllRows = reservations
    .filter((r) => r.billet_requis && (!r.billet_date || r.billet_date >= todayStr))
    .sort((a, b) => (a.billet_date || "").localeCompare(b.billet_date || ""));
  const billetsMonthKeys = Array.from(
    new Set(billetsAllRows.map((r) => (r.billet_date || "").slice(0, 7)).filter(Boolean))
  ).sort();
  const billetsRows =
    billetsMonthFilter === "tous"
      ? billetsAllRows
      : billetsMonthFilter === "sans_date"
        ? billetsAllRows.filter((r) => !r.billet_date)
        : billetsAllRows.filter((r) => (r.billet_date || "").slice(0, 7) === billetsMonthFilter);

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

  // Le numéro de chambre se demande à J-1 de la toute première activité du
  // client (pas de son arrivée à l'hôtel) — donc calculé depuis la date la
  // plus proche parmi ses réservations, pas depuis client.date_debut.
  const firstActivityDateByClient = new Map<string, string>();
  reservations.forEach((r) => {
    if (!r.date_debut) return;
    const current = firstActivityDateByClient.get(r.client_id);
    if (!current || r.date_debut < current) firstActivityDateByClient.set(r.client_id, r.date_debut);
  });
  const roomsJ1 = clients.filter(
    (c) => !c.chambre && firstActivityDateByClient.get(c.id) === tomorrowStr
  );

  // Un client sans numéro de chambre à J-1 doit être signalé automatiquement
  // dans "infos manquantes" — pas besoin de le cocher à la main en plus de
  // le voir dans cette liste.
  useEffect(() => {
    if (sub !== "j1") return;
    roomsJ1.forEach((c) => {
      if (!c.chambre && !c.infos_manquantes.includes("Room number")) {
        onUpdateClient(c.id, { infos_manquantes: [...c.infos_manquantes, "Room number"] });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, clients, tomorrowStr]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      {sub === "j1" && (
        <div className="space-y-6">
          <div className="rounded-md border border-[#f5a623]/30 bg-[#f5a623]/10 p-3 text-xs text-[#666666]">
            Règle : le pick-up réel n&apos;est communiqué au client qu&apos;à J-1, avant 18h
            maximum — jamais avant.
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pickupsJ1Missing.map(({ r, client }) => {
                  const urgent = pastDeadline;
                  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
                  const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
                  const badge = paiementBadge(client, r);
                  const paiementWarning = activitePaiementWarning(
                    client,
                    r,
                    clientReservations,
                    resaOptions,
                    resaTarifs
                  );
                  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);
                  const teamMsg = pickupMissingTeamMessage(r, client);
                  return (
                    <div
                      key={r.id}
                      className={`rounded-md border p-3 ${
                        urgent ? "border-red-400 bg-red-50" : "border-[#f5a623]/40 bg-[#f5a623]/5"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center gap-2 text-xs">
                        <button
                          onClick={() => onOpenClient(client.id)}
                          className="text-sm font-semibold text-[#171717] hover:underline"
                        >
                          {client.nom || "Sans nom"}
                        </button>
                        {urgent && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
                            En retard — 18h dépassé
                          </span>
                        )}
                      </div>
                      <PickupActivityCard
                        r={r}
                        client={client}
                        total={total}
                        badge={badge}
                        paiementWarning={paiementWarning}
                        acompteWarning={acompteWarning}
                        onAskPickup={askPickup}
                      />
                      <div className="mt-2 flex flex-col gap-2">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pickupsJ1Done.map(({ r, client }) => {
                  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
                  const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
                  const badge = paiementBadge(client, r);
                  const paiementWarning = activitePaiementWarning(
                    client,
                    r,
                    clientReservations,
                    resaOptions,
                    resaTarifs
                  );
                  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);
                  const montantRestant = soldeRestantFor(client);
                  const clientMsg = pickupClientMessage(r, client, montantRestant, catalogue);
                  return (
                    <div key={r.id} className="rounded-md border border-neutral-200 bg-white p-3">
                      <div className="mb-1.5 flex items-center gap-2 text-xs">
                        <button
                          onClick={() => onOpenClient(client.id)}
                          className="text-sm font-semibold text-[#171717] hover:underline"
                        >
                          {client.nom || "Sans nom"}
                        </button>
                        <span className="rounded-full bg-[#171717]/10 px-2 py-0.5 text-[11px] text-[#171717]">
                          Pick-up {r.pickup_reel}
                        </span>
                      </div>
                      <PickupActivityCard
                        r={r}
                        client={client}
                        total={total}
                        badge={badge}
                        paiementWarning={paiementWarning}
                        acompteWarning={acompteWarning}
                        onAskPickup={askPickup}
                      />
                      <button
                        onClick={() => copyText("pickup-client-" + r.id, clientMsg)}
                        className="mt-2 w-full rounded-md bg-[#171717] px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        {copiedKey === "pickup-client-" + r.id ? "Copié ✓" : "Copier message client"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {sub === "chambres" && (
        <div className="space-y-6">
          <div className="rounded-md border border-[#0F5C56]/30 bg-[#0F5C56]/5 p-3 text-xs text-[#666666]">
            Règle : le numéro de chambre se demande à J-1 de la première activité du client.
          </div>

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              Numéros de chambre à demander
            </h3>
            {roomsJ1.length === 0 && (
              <div className="text-sm text-neutral-400">Aucun numéro de chambre manquant.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roomsJ1.map((c) => {
                const urgent = pastDeadline;
                return (
                  <div
                    key={c.id}
                    className={`overflow-hidden rounded-lg border bg-white p-3 text-sm shadow-sm ${
                      urgent ? "border-[#0F5C56]" : "border-neutral-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onOpenClient(c.id)}
                        className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                      >
                        {c.nom || "Sans nom"}
                      </button>
                      <span className="rounded-full bg-[#0F5C56]/10 px-1.5 py-0.5 text-[11px] text-[#0F5C56]">
                        {c.hotel || "Hôtel ?"}
                      </span>
                      {urgent && (
                        <span className="rounded-full bg-[#0F5C56] px-1.5 py-0.5 text-[11px] font-medium text-white">
                          En retard — 18h dépassé
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="N° de chambre"
                        value={chambreDrafts[c.id] ?? ""}
                        onChange={(e) => setChambreDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                        className="input w-28 text-xs"
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
                    </div>
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
                        <span className="text-neutral-600">{c.solde_rdv_heure}</span>
                        <span>
                          <ClientNameLink nom={c.nom} onClick={() => onOpenClient(c.id)} /> —{" "}
                          {c.hotel || "Hôtel ?"}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#171717]">
                          👤 {c.solde_assigne_a || "Non assigné"}
                        </span>
                        <span className="font-medium text-[#171717]">
                          {euros(montant)} €
                        </span>
                        <span className="flex-1" />
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
                            <div className="text-neutral-500">{c.solde_rdv_heure}</div>
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
              Appels à passer aujourd&apos;hui
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
        <div className="space-y-8">
          <div>
            <h3 className="font-heading mb-3 text-sm font-semibold text-[#171717]">
              Messages de bon retour à envoyer (J+1)
            </h3>
            {auRevoirRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à envoyer pour l&apos;instant.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {auRevoirRows.map(({ c, dateCible }) => {
                const lateDays = daysBetween(todayStr, dateCible);
                const enRetard = lateDays > 1;
                return (
                  <div
                    key={c.id}
                    className={`overflow-hidden rounded-lg border bg-white p-3 shadow-sm ${
                      enRetard
                        ? "border-red-300"
                        : dateCible === todayStr
                        ? "border-[#f5a623]"
                        : "border-neutral-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-neutral-500">
                        {fmtDate(dateCible)}
                        {dateCible === todayStr ? " — aujourd'hui" : ""}
                      </span>
                      <ClientNameLink
                        nom={c.nom}
                        onClick={() => onOpenClient(c.id)}
                        className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                      />
                      <DateRangeBadge debut={c.date_debut} fin={c.date_fin} />
                    </div>
                    {enRetard && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        ⚠️ En retard — ce message aurait dû être envoyé il y a {lateDays} jour
                        {lateDays > 1 ? "s" : ""}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyText("aurevoir-" + c.id, auRevoirMessage(c.nom))}
                        className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        {copiedKey === "aurevoir-" + c.id ? "Copié ✓" : "Copier le message"}
                      </button>
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <input
                          type="checkbox"
                          checked={c.au_revoir_envoye}
                          onChange={(e) =>
                            onUpdateClient(c.id, {
                              au_revoir_envoye: e.target.checked,
                              au_revoir_envoye_le: e.target.checked ? todayStr : null,
                            })
                          }
                        />
                        Envoyé
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-3 text-sm font-semibold text-[#171717]">
              Envoyés récemment (3 derniers jours)
            </h3>
            {auRevoirEnvoyesRecemment.length === 0 && (
              <div className="text-sm text-neutral-400">Aucun envoi récent.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {auRevoirEnvoyesRecemment.map((c) => (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-lg border border-green-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-500">
                      Envoyé le {fmtDate(c.au_revoir_envoye_le)}
                    </span>
                    <ClientNameLink
                      nom={c.nom}
                      onClick={() => onOpenClient(c.id)}
                      className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                    />
                    <DateRangeBadge debut={c.date_debut} fin={c.date_fin} />
                    <span className="ml-auto rounded-full bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                      Envoyé ✓
                    </span>
                  </div>
                  <label className="mt-3 flex items-center gap-1.5 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={c.au_revoir_envoye}
                      onChange={(e) =>
                        onUpdateClient(c.id, {
                          au_revoir_envoye: e.target.checked,
                          au_revoir_envoye_le: e.target.checked ? todayStr : null,
                        })
                      }
                    />
                    Envoyé
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-3 text-sm font-semibold text-[#171717]">À venir</h3>
            {auRevoirUpcomingRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à venir pour l&apos;instant.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {auRevoirUpcomingRows.map(({ c, dateCible }) => (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-500">{fmtDate(dateCible)}</span>
                    <ClientNameLink
                      nom={c.nom}
                      onClick={() => onOpenClient(c.id)}
                      className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                    />
                    <DateRangeBadge debut={c.date_debut} fin={c.date_fin} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "avis" && (
        <div className="space-y-8">
          <div>
            <h3 className="font-heading mb-3 text-sm font-semibold text-[#171717]">
              Demandes d&apos;avis à envoyer (J+7)
            </h3>
            {avisRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à envoyer pour l&apos;instant.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {avisRows.map(({ c, dateCible }) => {
                const lateDays = daysBetween(todayStr, dateCible);
                const enRetard = lateDays > 2;
                return (
                  <div
                    key={c.id}
                    className={`overflow-hidden rounded-lg border bg-white p-3 shadow-sm ${
                      enRetard
                        ? "border-red-300"
                        : dateCible === todayStr
                        ? "border-[#f5a623]"
                        : "border-neutral-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-neutral-500">
                        {fmtDate(dateCible)}
                        {dateCible === todayStr ? " — aujourd'hui" : ""}
                      </span>
                      <ClientNameLink
                        nom={c.nom}
                        onClick={() => onOpenClient(c.id)}
                        className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                      />
                      <DateRangeBadge debut={c.date_debut} fin={c.date_fin} />
                    </div>
                    {enRetard && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        ⚠️ En retard — cette demande aurait dû être envoyée il y a {lateDays} jour
                        {lateDays > 1 ? "s" : ""}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyText("avis-" + c.id, avisMessage(c.nom))}
                        className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        {copiedKey === "avis-" + c.id ? "Copié ✓" : "Copier le message"}
                      </button>
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <input
                          type="checkbox"
                          checked={c.avis_envoye}
                          onChange={(e) =>
                            onUpdateClient(c.id, {
                              avis_envoye: e.target.checked,
                              avis_envoye_le: e.target.checked ? todayStr : null,
                            })
                          }
                        />
                        Envoyé
                      </label>
                      <AvisStatutSelector
                        value={c.avis_statut}
                        onChange={(v) => onUpdateClient(c.id, { avis_statut: v })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-3 text-sm font-semibold text-[#171717]">
              Envoyés récemment (3 derniers jours)
            </h3>
            {avisEnvoyesRecemment.length === 0 && (
              <div className="text-sm text-neutral-400">Aucun envoi récent.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {avisEnvoyesRecemment.map((c) => (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-lg border border-green-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-500">
                      Envoyé le {fmtDate(c.avis_envoye_le)}
                    </span>
                    <ClientNameLink
                      nom={c.nom}
                      onClick={() => onOpenClient(c.id)}
                      className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                    />
                    <DateRangeBadge debut={c.date_debut} fin={c.date_fin} />
                    <span className="ml-auto rounded-full bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                      Envoyé ✓
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={c.avis_envoye}
                        onChange={(e) =>
                          onUpdateClient(c.id, {
                            avis_envoye: e.target.checked,
                            avis_envoye_le: e.target.checked ? todayStr : null,
                          })
                        }
                      />
                      Envoyé
                    </label>
                    <AvisStatutSelector
                      value={c.avis_statut}
                      onChange={(v) => onUpdateClient(c.id, { avis_statut: v })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-3 text-sm font-semibold text-[#171717]">À venir</h3>
            {avisUpcomingRows.length === 0 && (
              <div className="text-sm text-neutral-400">Rien à venir pour l&apos;instant.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {avisUpcomingRows.map(({ c, dateCible }) => (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-500">{fmtDate(dateCible)}</span>
                    <ClientNameLink
                      nom={c.nom}
                      onClick={() => onOpenClient(c.id)}
                      className="font-heading text-sm font-semibold text-[#171717] hover:underline"
                    />
                    <DateRangeBadge debut={c.date_debut} fin={c.date_fin} />
                  </div>
                  <div className="mt-3">
                    <AvisStatutSelector
                      value={c.avis_statut}
                      onChange={(v) => onUpdateClient(c.id, { avis_statut: v })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "remb" && (
        <div className="space-y-8">
          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
              À faire ({remboursementsEnAttente.length})
            </h3>
            {remboursementsEnAttente.length === 0 && (
              <div className="text-sm text-neutral-400">Rien en attente.</div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {remboursementsEnAttente.map((r) => {
                const client = clients.find((c) => c.id === r.client_id);
                if (!client) return null;
                const activite = reservations.find((res) => res.id === r.activite_id);
                const key = "remb-" + r.id;
                return (
                  <RemboursementCard
                    key={r.id}
                    r={r}
                    client={client}
                    activite={activite}
                    isOpen={!!expanded[key]}
                    onToggle={() => toggleExpand(key)}
                    onOpenClient={onOpenClient}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">Effectués</h3>
            {remboursementsEffectuesParMoisSemaine.length === 0 &&
              remboursementsSansDate.length === 0 && (
                <div className="text-sm text-neutral-400">Aucun remboursement effectué.</div>
              )}
            <div className="space-y-6">
              {remboursementsEffectuesParMoisSemaine.map(({ mois, semaines }) => (
                <div key={mois}>
                  <h4 className="mb-2 text-sm font-semibold capitalize text-[#8B4531]">
                    {fmtMonthLabel(mois)}
                  </h4>
                  <div className="space-y-4">
                    {semaines.map(([semaine, rows]) => (
                      <div key={semaine}>
                        <p className="mb-2 text-xs font-medium text-neutral-400">
                          Semaine du {fmtDate(semaine)}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {rows.map((r) => {
                            const client = clients.find((c) => c.id === r.client_id);
                            if (!client) return null;
                            const activite = reservations.find((res) => res.id === r.activite_id);
                            const key = "remb-" + r.id;
                            return (
                              <RemboursementCard
                                key={r.id}
                                r={r}
                                client={client}
                                activite={activite}
                                isOpen={!!expanded[key]}
                                onToggle={() => toggleExpand(key)}
                                onOpenClient={onOpenClient}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {remboursementsSansDate.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-neutral-400">Date inconnue</h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {remboursementsSansDate.map((r) => {
                      const client = clients.find((c) => c.id === r.client_id);
                      if (!client) return null;
                      const activite = reservations.find((res) => res.id === r.activite_id);
                      const key = "remb-" + r.id;
                      return (
                        <RemboursementCard
                          key={r.id}
                          r={r}
                          client={client}
                          activite={activite}
                          isOpen={!!expanded[key]}
                          onToggle={() => toggleExpand(key)}
                          onOpenClient={onOpenClient}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sub === "billets" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
            Billets d&apos;avion — pour Hossam
          </h3>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => setBilletsMonthFilter("tous")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                billetsMonthFilter === "tous"
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 bg-white text-neutral-600"
              }`}
            >
              Tous
            </button>
            {billetsMonthKeys.map((ym) => (
              <button
                key={ym}
                onClick={() => setBilletsMonthFilter(ym)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  billetsMonthFilter === ym
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                {fmtMonthLabel(ym)}
              </button>
            ))}
            <button
              onClick={() => setBilletsMonthFilter("sans_date")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                billetsMonthFilter === "sans_date"
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 bg-white text-neutral-600"
              }`}
            >
              Sans date
            </button>
          </div>

          {billetsRows.length === 0 && (
            <div className="text-sm text-neutral-400">
              Aucune activité avec billet à gérer pour cette période.
            </div>
          )}
          <div className="space-y-2">
            {billetsRows.map((r) => {
              const client = clients.find((c) => c.id === r.client_id);
              if (!client) return null;
              const { nbAd, nbEnf } = participantsFor(r, client);
              const pax = r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`;
              const key = "billet-" + r.id;
              return (
                <div key={r.id} className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      title="Vérifié"
                      checked={r.billet_verifie}
                      onChange={(e) => onUpdateReservation(r.id, { billet_verifie: e.target.checked })}
                    />
                    <span className="text-neutral-500">
                      {r.billet_date ? fmtDate(r.billet_date) : "Date ?"}
                    </span>
                    <span>
                      <ClientNameLink nom={client.nom} onClick={() => onOpenClient(client.id)} /> —{" "}
                      {r.nom_activite || "Activité"}
                    </span>
                  </div>

                  <div className="mt-2">
                    <BilletEtapeTracker
                      etape={r.billet_etape}
                      demandeEnvoyeeLe={r.billet_demande_envoyee_le}
                      onChange={(patch) => onUpdateReservation(r.id, patch)}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-neutral-500">{pax} PAX</span>
                    <select
                      value={r.billet_ville_depart}
                      onChange={(e) => onUpdateReservation(r.id, { billet_ville_depart: e.target.value })}
                      className="input w-32 text-xs"
                    >
                      <option value="">Départ…</option>
                      {VILLES_VOL.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    <span className="text-neutral-400">→</span>
                    <select
                      value={r.billet_ville_arrivee}
                      onChange={(e) => onUpdateReservation(r.id, { billet_ville_arrivee: e.target.value })}
                      className="input w-32 text-xs"
                    >
                      <option value="">Arrivée…</option>
                      {VILLES_VOL.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => copyText(key, hossamBilletMessage(r, client))}
                      className="rounded-full bg-[#171717] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                    >
                      {copiedKey === key ? "Copié ✓" : "Copier la demande"}
                    </button>
                    <button
                      onClick={() =>
                        copyText("nom-" + key, r.billet_nom_complet.trim() || client.nom)
                      }
                      className="rounded-full border border-[#171717]/30 px-3 py-1 text-xs font-medium text-[#171717] hover:bg-[#fafafa]"
                    >
                      {copiedKey === "nom-" + key ? "Copié ✓" : "Copier les noms clients"}
                    </button>
                    {r.billet_lien && <VoirBilletLink path={r.billet_lien} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
