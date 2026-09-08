"use client";

import { useState } from "react";
import { ASSIGNE_A_OPTIONS } from "@/lib/constants";
import { RDV_MODES } from "@/components/clientSteps/PaiementResteFlow";
import { todayStr } from "@/lib/dates";
import { Field } from "@/components/Field";

// Popup déclenché quand on choisit "RDV paiement planifié" depuis le menu
// déroulant rapide d'une activité (ItineraryView/ActivityDetailModal) —
// sans lui, ce choix ne faisait que poser solde_rdv_lieu="À définir" sans
// jamais demander date/heure/assigné, créant un RDV fantôme impossible à
// compléter ensuite (invisible dans Suivis > RDV paiements tant que
// solde_date restait vide).
export default function RdvPaiementCreationModal({
  onValider,
  onClose,
}: {
  onValider: (info: { date: string; heure: string; assigneA: string; mode: string }) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [heure, setHeure] = useState("");
  const [assigneA, setAssigneA] = useState<string>("");
  const [assigneAutre, setAssigneAutre] = useState("");
  const [mode, setMode] = useState<string>(RDV_MODES[0]);
  const [error, setError] = useState(false);

  const valider = () => {
    const assigne = assigneA === "Autre" ? assigneAutre.trim() : assigneA;
    if (!date || !heure || !assigne) {
      setError(true);
      return;
    }
    onValider({ date, heure, assigneA: assigne, mode });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-base font-semibold text-[#171717]">Rendez-vous de paiement</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Renseigne la date, l&apos;heure et la personne assignée pour créer le rendez-vous.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field label="Heure">
            <input
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              className="input w-full"
            />
          </Field>
          <Field label="Assigné à">
            <select value={assigneA} onChange={(e) => setAssigneA(e.target.value)} className="input w-full">
              <option value="">Choisir…</option>
              {ASSIGNE_A_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          {assigneA === "Autre" && (
            <Field label="Précise qui">
              <input
                value={assigneAutre}
                onChange={(e) => setAssigneAutre(e.target.value)}
                className="input w-full"
              />
            </Field>
          )}
          <Field label="Mode de règlement prévu">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="input w-full">
              {RDV_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <p className="text-xs text-red-600">Date, heure et personne assignée sont obligatoires.</p>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-neutral-600 hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={valider}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Créer le RDV
          </button>
        </div>
      </div>
    </div>
  );
}
