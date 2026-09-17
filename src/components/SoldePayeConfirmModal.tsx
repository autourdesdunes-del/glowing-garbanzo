"use client";

import { useState } from "react";
import { Client, PaiementEtape, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { paiementBadge, reservationsActives, STATUT_PAIEMENT_OPTIONS } from "@/lib/resa";
import { euros } from "@/lib/contactStepFormat";

// Étape de confirmation partagée, à afficher avant tout changement qui
// marque le solde (ou une reprise) "payé" — un seul solde par client, donc
// ce genre d'action change potentiellement le badge de plusieurs activités
// du dossier d'un coup. Sans cette étape, un simple clic changeait tout en
// silence et pouvait effacer une reprise encore due sur une autre activité
// (vécu sur Carine LELOIR, demande de Mélanie le 14/09 : "le crm ne doit
// jamais changer un badge de paiement sans demander l'accord via un pop up").
//
// Depuis le 16/09 (badge indépendant par activité, voir resa.ts) : chaque
// ligne a sa propre case à cocher, cochée par défaut — l'employée peut en
// décocher avant de valider pour l'exclure de ce changement groupé (elle
// garde alors son statut actuel), plutôt que de devoir tout appliquer en
// bloc ou tout annuler.
export default function SoldePayeConfirmModal({
  client,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes,
  newLabel,
  title,
  warnReprise = true,
  onConfirm,
  onCancel,
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes: PaiementEtape[];
  newLabel: string;
  title?: string;
  // false pour un simple RDV planifié (rien n'est encore réglé) — le texte
  // "sera considéré comme réglé" serait faux tant que le rendez-vous n'a pas
  // eu lieu. Vrai par défaut pour ne rien changer aux appels existants
  // (marquer payé, où la reprise est effectivement absorbée).
  warnReprise?: boolean;
  // Liste des activités effectivement retenues (cases restées cochées) —
  // jamais forcément toutes.
  onConfirm: (activiteIds: string[]) => void;
  onCancel: () => void;
}) {
  const activites = reservationsActives(reservations);
  // Le badge "après" doit reprendre la vraie couleur du statut visé (ex.
  // bleu pour "RDV paiement planifié") plutôt qu'un vert générique "payé" —
  // faux pour un RDV qui n'est justement pas encore réglé (demande de
  // Mélanie, 2026-09-17).
  const newClassName =
    STATUT_PAIEMENT_OPTIONS.find((o) => o.label === newLabel)?.className || "bg-green-100 text-green-700";
  const [exclues, setExclues] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExclues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const retenues = activites.filter((r) => !exclues.has(r.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
        <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
          {title || `Confirmer "${newLabel}"`}
        </h2>
        <p className="mb-3 text-sm text-neutral-600">
          Voici ce qui va changer pour chaque activité — décoche celles à laisser telles quelles :
        </p>
        <div className="mb-3 flex flex-col gap-1.5 rounded-md border border-neutral-200 p-2">
          {activites.map((r) => {
            const avant = paiementBadge(client, r, reservations, resaOptions, resaTarifs, paiementsEtapes) || {
              label: "En attente",
              className: "bg-yellow-100 text-yellow-700",
            };
            const incluse = !exclues.has(r.id);
            return (
              <label
                key={r.id}
                className={`flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-sm ${
                  incluse ? "" : "opacity-50"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input type="checkbox" checked={incluse} onChange={() => toggle(r.id)} className="shrink-0" />
                  <span className="truncate text-[#171717]">{r.nom_activite}</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${avant.className}`}>{avant.label}</span>
                  {incluse && (
                    <>
                      <span className="text-neutral-400">→</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${newClassName}`}>{newLabel}</span>
                    </>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        {warnReprise && Number(client.reprise_montant) > 0 && (
          <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            ⚠️ Un règlement de {euros(client.reprise_montant)} € ({client.reprise_mode || "mode non précisé"}) est
            encore en attente sur ce dossier — en validant, il sera considéré comme réglé et disparaîtra du résumé
            des paiements.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(retenues.map((r) => r.id))}
            disabled={retenues.length === 0}
            className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
