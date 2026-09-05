"use client";

import { useState } from "react";
import {
  CatalogueItem,
  Client,
  Incident,
  PaypalPaiement,
  Remboursement,
  Reservation,
} from "@/lib/types";
import { todayStr } from "@/lib/dates";
import { deaccent } from "@/lib/deaccent";
import {
  agesLabel,
  billetEtapeShortLabel,
  billetUploadPatch,
  cleanActivityTitle,
  hideMoment,
  hossamBilletMessage,
  isLeCaireEnAvion,
  missingChampsFor,
  participantsFor,
} from "@/lib/resa";
import { BILLET_ETAPES, VILLES_VOL } from "@/lib/constants";
import BilletAvionUpload from "@/components/BilletAvionUpload";
import { VoirPreuveRemboursementLink } from "@/components/RemboursementSummaryCard";
import { ClientNameLink, VoirRibLink } from "@/components/suivis/SuivisPrimitives";
import { euros, fmtDate, fmtDateTime } from "@/lib/suivisFormat";

// Petites cartes/lignes/modales des différentes vues Suivis — extraites de
// SuivisView.tsx pour l'alléger, sans changement de comportement.

export function BilletEtapeTracker({
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
      <span className="whitespace-nowrap text-xs font-medium text-[#171717]">
        {billetEtapeShortLabel(etape)}
      </span>
      {joursAttente !== null && joursAttente >= 2 && (
        <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          ⏱ {joursAttente} j
        </span>
      )}
    </div>
  );
}

export function RemboursementCard({
  r,
  client,
  activite,
  isOpen,
  onToggle,
  onOpenClient,
  isDirection,
  onDelete,
}: {
  r: Remboursement;
  client: Client;
  activite: Reservation | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onOpenClient: (id: string) => void;
  isDirection?: boolean;
  onDelete?: () => void;
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
          {r.statut === "Effectué" && (
            <div className="flex items-center gap-2 border-t border-neutral-100 pt-2 text-emerald-700">
              <span className="font-medium">
                Remboursé le {r.date_remboursement_ts ? fmtDateTime(r.date_remboursement_ts) : fmtDate(r.date_remboursement)}
              </span>
              {r.preuve_photo_path && <VoirPreuveRemboursementLink path={r.preuve_photo_path} />}
            </div>
          )}
          {isDirection && onDelete && (
            <div className="border-t border-neutral-100 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Supprimer ce remboursement (Direction)"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function IncidentRow({
  incident,
  client,
  onOpenClient,
}: {
  incident: Incident;
  client: Client;
  onOpenClient: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpenClient(client.id)}
      className={`cursor-pointer overflow-hidden rounded-lg border px-3 py-2.5 shadow-sm ${
        incident.statut === "Ouvert" ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <ClientNameLink
          nom={client.nom}
          onClick={() => onOpenClient(client.id)}
          className="font-heading text-sm font-semibold text-[#171717] hover:underline"
        />
        <span
          className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
            incident.statut === "Ouvert" ? "bg-red-100 text-red-700" : "bg-[#0F5C56]/10 text-[#0F5C56]"
          }`}
        >
          {incident.statut}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-[#171717]">{incident.titre}</p>
      {incident.details && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{incident.details}</p>}
      <p className="mt-1.5 text-[11px] text-neutral-400">
        {fmtDate(incident.date_incident)}
        {incident.par ? ` · ${incident.par}` : ""}
      </p>
    </div>
  );
}

export function AttenteRow({
  client,
  heures,
  onOpenClient,
}: {
  client: Client;
  heures: number;
  onOpenClient: (id: string) => void;
}) {
  const jours = Math.floor(heures / 24);
  return (
    <div
      onClick={() => onOpenClient(client.id)}
      className="cursor-pointer overflow-hidden rounded-lg border border-[#f5a623]/40 bg-[#f5a623]/5 px-3 py-2.5 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <ClientNameLink
          nom={client.nom}
          onClick={() => onOpenClient(client.id)}
          className="font-heading text-sm font-semibold text-[#171717] hover:underline"
        />
        <span className="ml-auto shrink-0 rounded-full bg-[#f5a623]/20 px-1.5 py-0.5 text-[11px] font-medium text-[#8B4531]">
          {jours} j sans réponse
        </span>
      </div>
      {client.kommo_etape_detectee && (
        <p className="mt-1 text-xs font-medium text-[#0F5C56]">{client.kommo_etape_detectee}</p>
      )}
      {client.kommo_resume && (
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{client.kommo_resume}</p>
      )}
    </div>
  );
}

export function RdvPaiementModal({
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

export function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#eaeaea] py-2.5 first:border-t-0">
      <span className="shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="text-right text-sm text-[#171717]">{children}</span>
    </div>
  );
}

// Fiche détail d'un billet, ouverte au clic sur une ligne du tableau
// Suivis > Billets d'avion — une liste de propriétés plutôt qu'un
// formulaire, pour rester lisible même avec un billet par ligne dans le
// tableau (voir en dessous).
export function BilletDetailModal({
  r,
  client,
  copiedKey,
  onCopy,
  onOpenClient,
  onUpdateReservation,
  onOpenActivity,
  onClose,
}: {
  r: Reservation;
  client: Client;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  onOpenClient: (id: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onOpenActivity: () => void;
  onClose: () => void;
}) {
  const { nbAd, nbEnf } = participantsFor(r, client);
  const pax =
    r.pax_override ||
    `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)${agesLabel(client.ages_enfants)}` : ""}`;
  const isCaire = isLeCaireEnAvion(r.nom_activite);
  const key = "billet-" + r.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <button
            onClick={() => {
              onOpenClient(client.id);
              onClose();
            }}
            className="font-heading text-base font-semibold text-[#171717] hover:underline"
          >
            {client.nom || "Sans nom"}
          </button>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-2">
          <PropertyRow label="Activité">
            <button
              type="button"
              onClick={onOpenActivity}
              className="text-[#0F5C56] hover:underline"
            >
              {cleanActivityTitle(r.nom_activite) || "Activité"}
              {r.billet_date ? ` le ${fmtDate(r.billet_date)}` : ""} →
            </button>
          </PropertyRow>
          <PropertyRow label="Date">
            {r.billet_date ? fmtDate(r.billet_date) : "Date ?"}
          </PropertyRow>
          <PropertyRow label="Trajet">
            <div className="flex items-center gap-1.5">
              <select
                value={r.billet_ville_depart}
                onChange={(e) => onUpdateReservation(r.id, { billet_ville_depart: e.target.value })}
                className="input text-xs"
              >
                <option value="">Départ…</option>
                {VILLES_VOL.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <span className="text-neutral-400">{isCaire ? "⇄" : "→"}</span>
              <select
                value={r.billet_ville_arrivee}
                onChange={(e) => onUpdateReservation(r.id, { billet_ville_arrivee: e.target.value })}
                className="input text-xs"
              >
                <option value="">Arrivée…</option>
                {VILLES_VOL.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </PropertyRow>
          <PropertyRow label="PAX">{pax}</PropertyRow>
          <PropertyRow label="Étape">
            <BilletEtapeTracker
              etape={r.billet_etape}
              demandeEnvoyeeLe={r.billet_demande_envoyee_le}
              onChange={(patch) => onUpdateReservation(r.id, patch)}
            />
          </PropertyRow>
        </div>

        <div className="mt-3 border-t border-[#eaeaea] pt-3">
          <BilletAvionUpload
            path={r.billet_lien || null}
            onChange={(path) => onUpdateReservation(r.id, billetUploadPatch(r, path))}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onCopy(key, hossamBilletMessage(r, client))}
            className="rounded-full bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            {copiedKey === key ? "Copié ✓" : "Copier la demande"}
          </button>
          <button
            onClick={() => onCopy("nom-" + key, r.billet_nom_complet.trim() || client.nom)}
            className="rounded-full border border-[#171717]/30 px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            {copiedKey === "nom-" + key ? "Copié ✓" : "Copier les noms clients"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActiviteEnAttenteDetailModal({
  r,
  client,
  catalogue,
  onOpenClient,
  onClose,
}: {
  r: Reservation;
  client: Client;
  catalogue: CatalogueItem[];
  onOpenClient: (id: string) => void;
  onClose: () => void;
}) {
  const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
  const missing = missingChampsFor(r, catalogueItem);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-heading text-base font-semibold text-[#171717]">
            {client.nom || "Sans nom"}
          </h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-2">
          <PropertyRow label="Activité">{cleanActivityTitle(r.nom_activite) || "Activité"}</PropertyRow>
          <PropertyRow label="Date">{r.date_debut ? fmtDate(r.date_debut) : "Date ?"}</PropertyRow>
          <PropertyRow label="Statut">Brouillon — pas encore validée</PropertyRow>
          {missing.length > 0 && (
            <PropertyRow label="Champs manquants">
              <span className="text-red-600">{missing.join(", ")}</span>
            </PropertyRow>
          )}
        </div>

        <button
          onClick={() => {
            onOpenClient(client.id);
            onClose();
          }}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Ouvrir le dossier client
        </button>
      </div>
    </div>
  );
}

// Même style de carte que la fiche client (ReservationCard, vue repliée) —
// pour reconnaître une activité au premier coup d'œil, y compris quand il y
// en a 50 dans la journée.
// Reprend exactement la carte repliée de l'Itinéraire (fiche client), pour
// qu'une activité soit reconnaissable au premier coup d'œil ici aussi.
export function PickupActivityCard({
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

export const APPEL_PLATEFORMES = ["Instagram", "WhatsApp", "Mobile", "Google Meet", "Zoom"];

export function AppelRow({
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

// Une ligne de paiement PayPal reçu (via IPN) mais pas encore rattachée à
// un client — le nom du payeur PayPal ne suffit jamais à rapprocher
// automatiquement sans risque d'erreur (deux clients peuvent avoir un nom
// proche), donc l'employée choisit elle-même le bon dossier dans une
// recherche courte plutôt qu'un rapprochement silencieux.
export function PaypalPaiementRow({
  paiement,
  clients,
  onRattacher,
}: {
  paiement: PaypalPaiement;
  clients: Client[];
  onRattacher: (clientId: string, type: "acompte" | "etape" | "solde") => void;
}) {
  const [query, setQuery] = useState("");
  // Un paiement PayPal en cours de dossier n'est pas toujours l'acompte —
  // ça peut être un règlement en cours de séjour ou le solde ; l'employée
  // tranche une fois le client identifié.
  const [clientChoisi, setClientChoisi] = useState<Client | null>(null);
  const matches =
    query.trim().length >= 2
      ? clients
          .filter((c) => deaccent((c.nom || "").toLowerCase()).includes(deaccent(query.trim().toLowerCase())))
          .slice(0, 6)
      : [];

  const rattacher = (type: "acompte" | "etape" | "solde") => {
    if (!clientChoisi) return;
    onRattacher(clientChoisi.id, type);
    setQuery("");
    setClientChoisi(null);
  };

  // Un acompte/solde déjà renseigné ne doit jamais être écrasé — désactivé
  // ici plutôt que de laisser cliquer pour échouer (voir garde-fou côté
  // rattacherPaypalPaiement dans AppShell).
  const acompteDejaPris =
    !!clientChoisi &&
    (clientChoisi.acompte_paye ||
      clientChoisi.acompte_valide ||
      Number(clientChoisi.acompte_montant) > 0 ||
      (!!clientChoisi.paiement_type && clientChoisi.paiement_type !== "acompte"));
  const soldeDejaPris =
    !!clientChoisi && (clientChoisi.solde_paye || Number(clientChoisi.solde_montant) > 0);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-[#171717]">{paiement.payeur_nom || "Nom inconnu"}</span>
          <span className="ml-2 text-neutral-500">{fmtDateTime(paiement.paypal_recu_le)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-amounts font-medium text-[#171717]">{euros(paiement.montant_net)} €</span>
          {paiement.entre_proches ? (
            <span className="rounded-full bg-[#0F5C56]/10 px-2 py-0.5 text-xs font-medium text-[#0F5C56]">
              Entre proches ✅
            </span>
          ) : (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              Frais prélevés — brut {euros(paiement.montant)} €
            </span>
          )}
        </div>
      </div>
      {!clientChoisi ? (
        <div className="mt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rattacher à un client…"
            className="input text-sm"
          />
          {matches.length > 0 && (
            <div className="mt-1.5 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
              {matches.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setClientChoisi(c)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#fafafa]"
                >
                  {c.nom || "Sans nom"}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-neutral-500">
            Pour <strong>{clientChoisi.nom || "Sans nom"}</strong>, ce paiement correspond à :
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => rattacher("acompte")}
              disabled={acompteDejaPris}
              title={acompteDejaPris ? "Un acompte est déjà renseigné — ne peut pas être écrasé" : undefined}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              L&apos;acompte{acompteDejaPris ? " — déjà renseigné" : ""}
            </button>
            <button
              onClick={() => rattacher("etape")}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-[#fafafa]"
            >
              Un paiement en cours de séjour
            </button>
            <button
              onClick={() => rattacher("solde")}
              disabled={soldeDejaPris}
              title={soldeDejaPris ? "Le solde est déjà renseigné — ne peut pas être écrasé" : undefined}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Le solde{soldeDejaPris ? " — déjà renseigné" : ""}
            </button>
            <button
              onClick={() => setClientChoisi(null)}
              className="px-1 text-xs text-neutral-400 hover:underline"
            >
              ‹ Autre client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Petit panneau discret, pas un vrai onglet — juste de quoi retrouver un
// paiement des derniers jours sans avoir à chercher dans Supabase (rattaché
// ou non, contrairement à la liste principale qui ne montre que les
// paiements encore en attente).
export function PaypalHistoriqueDetailModal({
  paiement,
  client,
  onOpenClient,
  onClose,
}: {
  paiement: PaypalPaiement;
  client: Client | null;
  onOpenClient: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">💰 Paiement PayPal</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <div className="mt-2">
          <PropertyRow label="Reçu le">{fmtDateTime(paiement.paypal_recu_le)}</PropertyRow>
          <PropertyRow label="Payeur">{paiement.payeur_nom || "?"}</PropertyRow>
          {paiement.payeur_email && <PropertyRow label="Email">{paiement.payeur_email}</PropertyRow>}
          <PropertyRow label="Montant brut">{euros(paiement.montant)} €</PropertyRow>
          {paiement.frais > 0 && <PropertyRow label="Frais PayPal">{euros(paiement.frais)} €</PropertyRow>}
          <PropertyRow label="Montant net">{euros(paiement.montant_net)} €</PropertyRow>
          <PropertyRow label="Entre proches">{paiement.entre_proches ? "Oui ✅" : "Non"}</PropertyRow>
          <PropertyRow label="Statut">
            {client ? (
              <button
                onClick={() => {
                  onOpenClient(client.id);
                  onClose();
                }}
                className="font-medium text-[#0F5C56] hover:underline"
              >
                Rattaché à {client.nom}
              </button>
            ) : (
              <span className="text-[#8B4531]">En attente de rattachement</span>
            )}
          </PropertyRow>
        </div>
      </div>
    </div>
  );
}

// Petit panneau discret, pas un vrai onglet — juste de quoi retrouver un
// paiement des derniers jours sans avoir à chercher dans Supabase (rattaché
// ou non, contrairement à la liste principale qui ne montre que les
// paiements encore en attente). Chaque ligne ouvre le détail complet en
// pop-up au clic.
export function PaypalHistorique({
  paypalPaiements,
  clients,
  onOpenClient,
}: {
  paypalPaiements: PaypalPaiement[];
  clients: Client[];
  onOpenClient: (id: string) => void;
}) {
  const [selected, setSelected] = useState<PaypalPaiement | null>(null);
  const cinqJours = Date.now() - 5 * 86400000;
  const recents = paypalPaiements
    .filter((p) => Date.parse(p.paypal_recu_le) >= cinqJours)
    .sort((a, b) => b.paypal_recu_le.localeCompare(a.paypal_recu_le));

  return (
    <div className="w-56 flex-shrink-0 rounded-md border border-neutral-200 bg-[#fafafa] p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <span>🕐</span>
        <span>Historique (5 j)</span>
      </div>
      {recents.length === 0 ? (
        <p className="text-[11px] text-neutral-400">Rien sur les 5 derniers jours.</p>
      ) : (
        <div className="space-y-1.5">
          {recents.map((p) => {
            const client = p.rattache_client_id
              ? clients.find((c) => c.id === p.rattache_client_id)
              : null;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="block w-full rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-white"
              >
                <div className="flex items-center justify-between text-neutral-400">
                  <span>{fmtDateTime(p.paypal_recu_le)}</span>
                  <span className="font-amounts">{euros(p.montant_net)}€</span>
                </div>
                <div className="truncate text-neutral-600">
                  {p.payeur_nom || "?"}
                  {client ? (
                    <span className="text-[#0F5C56]"> → {client.nom}</span>
                  ) : (
                    <span className="text-[#8B4531]"> — en attente</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {selected && (
        <PaypalHistoriqueDetailModal
          paiement={selected}
          client={
            selected.rattache_client_id
              ? clients.find((c) => c.id === selected.rattache_client_id) || null
              : null
          }
          onOpenClient={onOpenClient}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
