"use client";

import { useState } from "react";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function fmtDateHeure(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

// Pop-up BLOQUANT (pas un badge ignorable) : le montant à payer pour le
// séjour (reste à régler, pas le prix d'une seule activité) a changé depuis
// qu'il a été communiqué (copié dans le bloc équipe Égypte ou le message
// pick-up client) — vécu sur Baptiste Mahieux et Florence Houel,
// 2026-10-15/16, un montant envoyé puis devenu faux sans que personne ne
// soit prévenu. Oblige à confirmer avoir prévenu la personne concernée
// avant de pouvoir continuer à travailler sur ce dossier.
export default function MontantCommuniqueAlertModal({
  activiteNom,
  parNom,
  le,
  ancienMontant,
  nouveauMontant,
  onConfirm,
}: {
  activiteNom: string;
  parNom: string;
  le: string;
  ancienMontant: number;
  nouveauMontant: number;
  onConfirm: () => void;
}) {
  const [confirme, setConfirme] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-500 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-red-700">
          ⚠️ Montant déjà communiqué — maintenant différent
        </h2>
        <p className="mt-3 text-sm text-[#171717]">
          {parNom ? <strong>{parNom}</strong> : "Quelqu'un"} a communiqué{" "}
          <strong>{euros(ancienMontant)} €</strong> {le ? `le ${fmtDateHeure(le)} ` : ""}
          pour <strong>{activiteNom || "cette activité"}</strong>.
        </p>
        <p className="mt-2 text-sm text-[#171717]">
          Une modification faite depuis fait passer le montant à payer à{" "}
          <strong className="text-red-700">{euros(nouveauMontant)} €</strong>.
        </p>
        <label className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <input
            type="checkbox"
            checked={confirme}
            onChange={(e) => setConfirme(e.target.checked)}
            className="mt-0.5"
          />
          Je confirme avoir prévenu {parNom || "la personne concernée"} du nouveau montant (
          {euros(nouveauMontant)} €)
        </label>
        <button
          type="button"
          disabled={!confirme}
          onClick={onConfirm}
          className="mt-4 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirmer et enregistrer le nouveau montant
        </button>
      </div>
    </div>
  );
}
