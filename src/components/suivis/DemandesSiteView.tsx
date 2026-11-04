"use client";

import { useState } from "react";
import { DemandeReservation } from "@/lib/types";
import { euros, fmtDate } from "@/lib/suivisFormat";

// fmtDate attend une simple date "YYYY-MM-DD" (il lui ajoute "T00:00:00") —
// created_at est un timestamp complet, il lui faut son propre formatage.
function fmtHoraire(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Boîte de réception des demandes envoyées depuis la vitrine publique
// (table demandes_reservation, voir migration 0163) — l'équipe consulte et
// transforme une demande en vrai dossier à la main en cliquant "Créer le
// dossier client" ; rien ici ne crée jamais de réservation automatiquement,
// seulement un client vide pré-rempli avec les coordonnées et un
// récapitulatif de la demande en commentaire, exactement comme pour une
// demande reçue par WhatsApp.
export default function DemandesSiteView({
  demandes,
  onCreerDossier,
  onMarquerStatut,
}: {
  demandes: DemandeReservation[];
  onCreerDossier: (demande: DemandeReservation) => void;
  onMarquerStatut: (id: string, statut: DemandeReservation["statut"]) => void;
}) {
  const [filtre, setFiltre] = useState<"nouvelle" | "toutes">("nouvelle");
  const visibles = demandes
    .filter((d) => (filtre === "nouvelle" ? d.statut === "nouvelle" : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const nbNouvelles = demandes.filter((d) => d.statut === "nouvelle").length;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[#171717]">Demandes du site</h2>
        {nbNouvelles > 0 && (
          <span className="rounded-full bg-[#D6544A] px-2 py-0.5 text-xs font-semibold text-white">
            {nbNouvelles} nouvelle{nbNouvelles > 1 ? "s" : ""}
          </span>
        )}
        <div className="ml-auto flex gap-1 rounded-full bg-neutral-100 p-1 text-xs">
          <button
            onClick={() => setFiltre("nouvelle")}
            className={`rounded-full px-3 py-1 font-medium ${
              filtre === "nouvelle" ? "bg-white shadow-sm" : "text-neutral-500"
            }`}
          >
            Nouvelles
          </button>
          <button
            onClick={() => setFiltre("toutes")}
            className={`rounded-full px-3 py-1 font-medium ${
              filtre === "toutes" ? "bg-white shadow-sm" : "text-neutral-500"
            }`}
          >
            Toutes
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucune demande pour l&apos;instant.</p>
      ) : (
        <div className="space-y-3">
          {visibles.map((d) => (
            <DemandeCard
              key={d.id}
              demande={d}
              onCreerDossier={onCreerDossier}
              onMarquerStatut={onMarquerStatut}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DemandeCard({
  demande,
  onCreerDossier,
  onMarquerStatut,
}: {
  demande: DemandeReservation;
  onCreerDossier: (demande: DemandeReservation) => void;
  onMarquerStatut: (id: string, statut: DemandeReservation["statut"]) => void;
}) {
  const total = (demande.panier || []).reduce((s, l) => s + (l.prixTotal || 0), 0);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[#171717]">{demande.nom || "Sans nom"}</div>
          <div className="text-xs text-neutral-500">
            {demande.email}
            {demande.email && demande.telephone && " · "}
            {demande.telephone}
          </div>
        </div>
        <div className="text-right text-xs text-neutral-400">
          {fmtHoraire(demande.created_at)}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {(demande.panier || []).map((l) => (
          <div key={l.lineId} className="text-sm">
            <div className="flex items-center justify-between">
              <span>
                {l.nom}
                {l.date && ` — ${fmtDate(l.date)}`}
                {" — "}
                {l.adultes} adulte{l.adultes > 1 ? "s" : ""}
                {l.enfants > 0 && `, ${l.enfants} enfant${l.enfants > 1 ? "s" : ""}`}
                {l.bebes > 0 && `, ${l.bebes} bébé${l.bebes > 1 ? "s" : ""}`}
              </span>
              <span className="font-mono text-neutral-600">{euros(l.prixTotal)} €</span>
            </div>
            {l.champsRequis && Object.keys(l.champsRequis).length > 0 && (
              <div className="mt-0.5 text-xs text-neutral-500">
                {Object.entries(l.champsRequis)
                  .map(([champ, reponse]) => `${champ} : ${reponse}`)
                  .join(" · ")}
              </div>
            )}
            {!!l.supplementSolo && (
              <div className="mt-0.5 text-xs text-amber-700">
                Supplément voyageur seul inclus : +{euros(l.supplementSolo)} €
              </div>
            )}
            {!!l.taxeTransfert && (
              <div className="mt-0.5 text-xs text-amber-700">
                Taxe de transfert ({l.zoneHotel}) incluse : +{euros(l.taxeTransfert)} €
              </div>
            )}
            {!!l.demandesSpeciales && (
              <div className="mt-1.5 rounded-lg border border-[#D6544A]/40 bg-[#D6544A]/5 px-2.5 py-1.5 text-xs text-[#8a2f27]">
                <span className="font-semibold">⚠️ Demande spéciale : </span>
                {l.demandesSpeciales}
              </div>
            )}
            {!!l.dechargeAccepteeLe && (
              <div className="mt-0.5 text-xs text-neutral-500">
                Décharge acceptée le {fmtHoraire(l.dechargeAccepteeLe)}
              </div>
            )}
            {l.consentementPhotos && (
              <div className="mt-0.5 text-xs text-neutral-500">
                ✓ A consenti à l&apos;usage promotionnel de photos
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-between border-t border-neutral-100 pt-1.5 text-sm font-semibold">
          <span>Total estimé</span>
          <span className="font-mono">{euros(total)} €</span>
        </div>
      </div>

      {demande.message && (
        <p className="mt-3 rounded-lg bg-neutral-50 p-2.5 text-sm text-neutral-700">
          {demande.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {demande.statut === "nouvelle" ? (
          <>
            <button
              onClick={() => onCreerDossier(demande)}
              className="rounded-lg bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Créer le dossier client
            </button>
            <button
              onClick={() => onMarquerStatut(demande.id, "ignoree")}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
            >
              Ignorer
            </button>
          </>
        ) : (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              demande.statut === "traitee"
                ? "bg-[#3E8F5C]/10 text-[#2C6B44]"
                : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {demande.statut === "traitee" ? "Dossier créé" : "Ignorée"}
          </span>
        )}
      </div>
    </div>
  );
}
