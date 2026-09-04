"use client";

import { useState } from "react";
import PreuveRemboursementUpload from "@/components/PreuveRemboursementUpload";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Marque un ou plusieurs remboursements "Effectué" d'un coup (une seule
// activité, ou le total d'un client) — la preuve photo est obligatoire, et
// la date + l'heure exactes du clic sont enregistrées automatiquement.
export default function MarquerRembourseModal({
  clientNom,
  montantTotal,
  nbRemboursements,
  infosManquantes,
  onConfirm,
  onClose,
}: {
  clientNom: string;
  montantTotal: number;
  nbRemboursements: number;
  // Ex. "adresse PayPal manquante" / "RIB manquant" — calculé par l'appelant
  // à partir du mode de chaque remboursement concerné. Sans ce contrôle, on
  // pouvait marquer "Effectué" un remboursement PayPal sans email ni un
  // virement sans RIB, sans jamais savoir où l'argent avait été envoyé.
  infosManquantes?: string;
  onConfirm: (photoPath: string) => Promise<void>;
  onClose: () => void;
}) {
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const confirmer = async () => {
    if (!photoPath) return;
    setSubmitting(true);
    await onConfirm(photoPath);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Remboursement effectué — {clientNom}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          {nbRemboursements > 1
            ? `${nbRemboursements} remboursements — ${euros(montantTotal)} € au total`
            : `${euros(montantTotal)} €`}
        </p>

        {infosManquantes && (
          <p className="mt-3 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700">
            ⚠️ {infosManquantes} — à compléter avant de confirmer.
          </p>
        )}

        <div className="mt-3">
          <PreuveRemboursementUpload path={photoPath} onChange={setPhotoPath} />
          {!photoPath && (
            <p className="mt-1 text-xs text-neutral-400">Obligatoire pour confirmer.</p>
          )}
        </div>

        <button
          onClick={confirmer}
          disabled={submitting || !photoPath || !!infosManquantes}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : "Confirmer le remboursement effectué"}
        </button>
      </div>
    </div>
  );
}
