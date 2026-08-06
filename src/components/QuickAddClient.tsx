"use client";

import { useState } from "react";
import { CANAUX } from "@/lib/constants";

export default function QuickAddClient({
  onCreate,
  defaultStatut = "Prospect",
}: {
  onCreate: (fields: {
    nom: string;
    telephone: string;
    canal: string;
    statut: "Prospect" | "Client confirmé";
  }) => Promise<void>;
  defaultStatut?: "Prospect" | "Client confirmé";
}) {
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [canal, setCanal] = useState<(typeof CANAUX)[number]>("WhatsApp");
  const [statut, setStatut] = useState<"Prospect" | "Client confirmé">(defaultStatut);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setNom("");
    setTelephone("");
    setCanal("WhatsApp");
    setStatut(defaultStatut);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true);
    await onCreate({ nom: nom.trim(), telephone: telephone.trim(), canal, statut });
    setSaving(false);
    close();
  }

  return (
    <>
      <button
        onClick={() => {
          setStatut(defaultStatut);
          setOpen(true);
        }}
        className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        + Nouveau
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-[#5C2A1D]">
                {statut === "Prospect" ? "Nouveau prospect" : "Nouveau client"}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <label className="mb-1 block text-sm font-medium text-neutral-700">Statut</label>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setStatut("Prospect")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                  statut === "Prospect"
                    ? "border-[#5C2A1D] bg-[#5C2A1D] text-white"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                Prospect
              </button>
              <button
                type="button"
                onClick={() => setStatut("Client confirmé")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                  statut === "Client confirmé"
                    ? "border-[#5C2A1D] bg-[#5C2A1D] text-white"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                Client confirmé
              </button>
            </div>

            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Nom du client
            </label>
            <input
              autoFocus
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="input mb-3"
            />

            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Téléphone / WhatsApp
            </label>
            <input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="input mb-3"
            />

            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Contact via
            </label>
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as (typeof CANAUX)[number])}
              className="input mb-4"
            >
              {CANAUX.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={saving || !nom.trim()}
              className="w-full rounded-md bg-[#5C2A1D] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Création…" : statut === "Prospect" ? "Créer le prospect" : "Créer le client"}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">
              Le reste du dossier se complète ensuite, à ton rythme.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
