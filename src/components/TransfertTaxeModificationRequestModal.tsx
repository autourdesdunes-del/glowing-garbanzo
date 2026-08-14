"use client";

import { useState } from "react";
import { TransfertTaxe } from "@/lib/types";

// Même logique que CatalogueModificationRequestModal, simplifiée : la page
// Taxes de transfert est en lecture seule pour l'équipe (voir HelpView),
// donc toute correction passe par une demande à la Direction plutôt qu'une
// modification directe d'un chiffre lié à l'argent.
export default function TransfertTaxeModificationRequestModal({
  taxes,
  onSubmit,
  onClose,
}: {
  taxes: TransfertTaxe[];
  onSubmit: (payload: { transfertTaxeId: string | null; ville: string; trancheLabel: string; explication: string }) => Promise<void>;
  onClose: () => void;
}) {
  const villes = Array.from(new Set(taxes.map((t) => t.ville)));
  const [ville, setVille] = useState(villes[0] || "");
  const [trancheId, setTrancheId] = useState("");
  const [explication, setExplication] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tranchesVille = taxes.filter((t) => t.ville === ville);
  const trancheChoisie = tranchesVille.find((t) => t.id === trancheId);

  const canSubmit = ville.trim() && explication.trim();

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await onSubmit({
      transfertTaxeId: trancheChoisie?.id || null,
      ville,
      trancheLabel: trancheChoisie?.label || "",
      explication: explication.trim(),
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Demander une modification de tarif
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#171717]">Ville</label>
          <select
            value={ville}
            onChange={(e) => {
              setVille(e.target.value);
              setTrancheId("");
            }}
            className="input w-full"
          >
            {villes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#171717]">
            Tranche concernée (optionnel)
          </label>
          <select value={trancheId} onChange={(e) => setTrancheId(e.target.value)} className="input w-full">
            <option value="">— Toute la ville / non précisé —</option>
            {tranchesVille.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label.split("\n")[0]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#171717]">Explication</label>
          <textarea
            value={explication}
            onChange={(e) => setExplication(e.target.value)}
            rows={3}
            placeholder="Détaillez ce qui doit changer et pourquoi…"
            className="input w-full"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}
