"use client";

import { useState } from "react";

const MINI_BUS_TEXT =
  "Nous recommandons davantage la formule en mini-bus : c'est beaucoup plus confortable, avec seulement 8 à 9 personnes maximum, contre une cinquantaine de personnes pour la formule en bus. En mini-bus, l'excursion est aussi majoritairement francophone, alors qu'en bus toutes les nationalités sont mélangées.";

export default function BusRedirectAlert({
  nomActivite,
  onProceedAnyway,
  onCancel,
}: {
  nomActivite: string;
  onProceedAnyway: () => void;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(MINI_BUS_TEXT);
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
        <p className="mt-2 text-sm text-[#171717]">
          Merci d&apos;essayer de rediriger les clients vers l&apos;excursion en mini-bus.
        </p>
        <button
          onClick={copyText}
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
            Les clients ne souhaitent pas la formule en mini-bus
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
