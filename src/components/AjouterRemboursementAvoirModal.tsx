"use client";

import { useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { MODES_PAIEMENT } from "@/lib/constants";

// Ajoute une demande de remboursement ou d'avoir liée à une activité déjà
// annulée — pour le cas où rien n'a été créé au moment de l'annulation
// (ex. "Aucun paiement reçu" à l'époque, mais un geste commercial décidé
// après coup), sans repasser par le formulaire complet de Suivi.
export default function AjouterRemboursementAvoirModal({
  client,
  r,
  montantSuggere,
  onUpdateClient,
  onClose,
}: {
  client: Client;
  r: Reservation;
  montantSuggere: number;
  onUpdateClient?: (patch: Partial<Client>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [type, setType] = useState<"remboursement" | "avoir">("remboursement");
  const [montant, setMontant] = useState(montantSuggere);
  const [mode, setMode] = useState<string>("PayPal");
  const [paypalEmail, setPaypalEmail] = useState(client.paypal_email || client.email || "");
  const [submitting, setSubmitting] = useState(false);

  const confirmer = async () => {
    if (!montant || montant <= 0) {
      toast("Indique un montant.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const details = `Activité annulée : ${r.nom_activite || "sans nom"}${
      r.annulation_raison ? ` — ${r.annulation_raison}` : ""
    }`;

    if (type === "remboursement") {
      const { error } = await supabase.from("remboursements").insert({
        client_id: client.id,
        montant,
        raison: "Annulation",
        details,
        mode,
        paypal_email: mode === "PayPal" ? paypalEmail.trim() : "",
        activite_id: r.id,
        date_probleme: r.annulation_date || null,
      });
      if (error) {
        toast("Échec de la création du remboursement.");
        setSubmitting(false);
        return;
      }
      if (mode === "PayPal" && paypalEmail.trim() && paypalEmail.trim() !== client.paypal_email) {
        onUpdateClient?.({ paypal_email: paypalEmail.trim() });
      }
    } else {
      const { error } = await supabase.from("avoirs").insert({
        client_id: client.id,
        montant,
        montant_restant: montant,
        raison: "Annulation",
        activite_id: r.id,
        date_probleme: r.annulation_date || null,
      });
      if (error) {
        toast("Échec de la création de l'avoir.");
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    toast(type === "remboursement" ? "Remboursement ajouté — modifiable dans Suivi." : "Avoir ajouté — modifiable dans Suivi.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Remboursement / avoir — {r.nom_activite || "activité annulée"}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setType("remboursement")}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
              type === "remboursement"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
            }`}
          >
            Remboursement
          </button>
          <button
            type="button"
            onClick={() => setType("avoir")}
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
              type === "avoir"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
            }`}
          >
            Avoir
          </button>
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">Montant (€)</span>
          <input
            type="number"
            value={montant}
            onChange={(e) => setMontant(Number(e.target.value))}
            className="input"
          />
        </label>

        {type === "remboursement" && (
          <>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="input text-sm">
                {MODES_PAIEMENT.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {mode === "PayPal" && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Adresse PayPal</span>
                <div className="mb-1.5 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700">
                  ⚠️ Collez toujours l&apos;adresse depuis la conversation avec le client — ne la retapez
                  jamais de mémoire.
                </div>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  onKeyDown={(e) => {
                    const allowed = ["Tab", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End"];
                    const isPasteOrCutOrSelectAll =
                      (e.metaKey || e.ctrlKey) && ["v", "x", "a", "c"].includes(e.key.toLowerCase());
                    if (!allowed.includes(e.key) && !isPasteOrCutOrSelectAll) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Collez l'adresse ici (Ctrl/Cmd+V)"
                  className="input text-sm"
                />
              </label>
            )}
          </>
        )}

        <button
          onClick={confirmer}
          disabled={submitting}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : type === "remboursement" ? "Ajouter le remboursement" : "Ajouter l'avoir"}
        </button>
      </div>
    </div>
  );
}
