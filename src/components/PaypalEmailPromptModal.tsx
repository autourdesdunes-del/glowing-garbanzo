"use client";

import { useState } from "react";

// Demande l'adresse PayPal du client au moment de choisir "Rembourser" lors
// d'une annulation — le remboursement par défaut se fait par PayPal
// (demande explicite), donc autant demander l'adresse tout de suite plutôt
// que de laisser le champ vide dans Suivis > Remboursements.
export default function PaypalEmailPromptModal({
  initialValue,
  onConfirm,
  onClose,
}: {
  initialValue: string;
  onConfirm: (email: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(initialValue);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-base font-semibold text-[#171717]">Adresse PayPal du client</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Nécessaire pour effectuer le remboursement — voir Suivis &gt; Remboursements.
        </p>
        <div className="mt-2 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700">
          ⚠️ Une erreur ici envoie l&apos;argent à la mauvaise personne. Collez toujours l&apos;adresse
          depuis la conversation avec le client — ne la retapez jamais de mémoire.
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            // Saisie clavier bloquée (sauf navigation/coller/couper) — pour
            // forcer le collage depuis la conversation du client plutôt
            // qu'une ressaisie de mémoire, source d'erreurs déjà vécue
            // (florence.degoulange@hotmail.fr au lieu de .com).
            const allowed = ["Tab", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"];
            const isPasteOrCutOrSelectAll = (e.metaKey || e.ctrlKey) && ["v", "x", "a", "c"].includes(e.key.toLowerCase());
            if (!allowed.includes(e.key) && !isPasteOrCutOrSelectAll) {
              e.preventDefault();
            }
          }}
          placeholder="Collez l'adresse ici (Ctrl/Cmd+V)"
          autoFocus
          className="input mt-3 text-sm"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            onClick={() => email.trim() && onConfirm(email.trim())}
            disabled={!email.trim()}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
