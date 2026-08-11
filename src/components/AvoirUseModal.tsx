"use client";

import { useState } from "react";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export default function AvoirUseModal({
  open,
  montantDisponible,
  onClose,
  onUse,
}: {
  open: boolean;
  montantDisponible: number;
  onClose: () => void;
  onUse: (montant: number) => void;
}) {
  const [partiel, setPartiel] = useState(false);
  const [montant, setMontant] = useState("");

  if (!open) return null;

  const close = () => {
    setPartiel(false);
    setMontant("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-base font-semibold text-[#171717]">Avoir disponible</h3>
        <p className="mt-2 text-sm text-neutral-600">
          Ce client dispose d&apos;un avoir de <strong>{euros(montantDisponible)} €</strong> à utiliser
          pendant le séjour. Souhaitez-vous l&apos;utiliser pour cette activité ?
        </p>

        {!partiel ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => {
                onUse(montantDisponible);
                close();
              }}
              className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Oui, en intégralité ({euros(montantDisponible)} €)
            </button>
            <button
              onClick={() => setPartiel(true)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-[#171717] hover:bg-[#fafafa]"
            >
              Oui, une partie
            </button>
            <button onClick={close} className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:underline">
              Non, ne pas utiliser l&apos;avoir
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <input
              type="number"
              autoFocus
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder={`Montant à utiliser (max ${euros(montantDisponible)} €)`}
              className="input"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const v = Math.min(Math.max(Number(montant) || 0, 0), montantDisponible);
                  if (v > 0) onUse(v);
                  close();
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Confirmer
              </button>
              <button
                onClick={() => setPartiel(false)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-[#171717] hover:bg-[#fafafa]"
              >
                Retour
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
