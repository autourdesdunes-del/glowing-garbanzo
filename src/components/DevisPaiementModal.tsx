"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { MODES_PAIEMENT } from "@/lib/constants";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Avant de générer un devis, on fait confirmer/ajuster la proposition de
// paiement (acompte + solde) plutôt que de laisser l'employée deviner — le
// solde se calcule automatiquement à partir du total et de l'acompte
// saisi, pour ne plus avoir d'erreur de calcul (voir retour de Mélanie du
// 31/08). Enregistré directement sur la fiche (prospect ou client
// confirmé — même fiche dans ce logiciel) pour que la facture générée
// plus tard reprenne ces mêmes infos sans ressaisie.
export default function DevisPaiementModal({
  client,
  totalSejour,
  onUpdateClient,
  onConfirm,
  onClose,
}: {
  client: Client;
  totalSejour: number;
  onUpdateClient: (patch: Partial<Client>) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [acompteMontant, setAcompteMontant] = useState(
    client.paiement_type === "acompte" && client.acompte_montant ? String(client.acompte_montant) : ""
  );
  const [acompteMode, setAcompteMode] = useState(client.acompte_mode || MODES_PAIEMENT[0]);
  const [soldeMode, setSoldeMode] = useState(client.solde_mode || MODES_PAIEMENT[0]);

  const acompteSaisi = Number(acompteMontant) || 0;
  const depasse = acompteSaisi > totalSejour;
  const acompte = Math.max(0, Math.min(acompteSaisi, totalSejour));
  const solde = Math.max(totalSejour - acompte, 0);

  const handleConfirm = () => {
    onUpdateClient({
      paiement_type: "acompte",
      acompte_montant: acompte,
      acompte_mode: acompteMode,
      solde_mode: soldeMode,
    });
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">Conditions de paiement</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          À confirmer avant de générer le devis — le solde se calcule automatiquement.
        </p>

        <div className="mt-4 flex items-center justify-between rounded-md bg-[#fafafa] px-3 py-2 text-sm">
          <span className="text-neutral-500">Total du séjour</span>
          <span className="font-amounts font-semibold text-[#171717]">{euros(totalSejour)} €</span>
        </div>

        <div className="mt-4 space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Montant de l&apos;acompte</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={totalSejour}
              value={acompteMontant}
              onChange={(e) => setAcompteMontant(e.target.value)}
              placeholder="0"
              className="input flex-1"
            />
            <select value={acompteMode} onChange={(e) => setAcompteMode(e.target.value)} className="input">
              {MODES_PAIEMENT.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {depasse && <p className="text-xs text-red-600">L&apos;acompte ne peut pas dépasser le total du séjour.</p>}
        </div>

        <div className="mt-3 space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Mode de règlement du solde</label>
          <select value={soldeMode} onChange={(e) => setSoldeMode(e.target.value)} className="input w-full">
            {MODES_PAIEMENT.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-md border border-[#0F5C56]/20 bg-[#0F5C56]/5 px-3 py-2 text-sm">
          <span className="text-[#0F5C56]">Solde (calculé)</span>
          <span className="font-amounts font-semibold text-[#0F5C56]">{euros(solde)} €</span>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={depasse}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Enregistrer et générer
          </button>
        </div>
      </div>
    </div>
  );
}
