"use client";

import { useState } from "react";

// Fenêtre rouge générique : pousse à rediriger le client vers une autre
// formule avant de laisser ajouter l'activité déconseillée (ex. Le
// Caire/Louxor en bus → mini-bus ; Grand Safari Bédouin pour un groupe
// d'adultes seuls → quad/buggy/safari mix). Même schéma dans les deux cas :
// copier un texte prêt à envoyer, ou confirmer que le client insiste (ce
// qui crée l'escalade à valider par la Direction/Sylvie).
export default function ActivityRedirectAlert({
  nomActivite,
  warningText,
  copyText,
  proceedLabel,
  onProceedAnyway,
  onCancel,
}: {
  nomActivite: string;
  warningText: string;
  copyText: string;
  proceedLabel: string;
  onProceedAnyway: () => void;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-600 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-red-600">{nomActivite}</h2>
        <p className="mt-2 text-sm text-[#171717]">{warningText}</p>
        <button
          onClick={doCopy}
          className="mt-3 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {copied ? "Copié ✓" : "Copier le texte pour le client"}
        </button>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onProceedAnyway();
            }}
            className="w-full rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {proceedLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
