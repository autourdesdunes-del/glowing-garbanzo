"use client";

import { useState } from "react";
import { CANAUX } from "@/lib/constants";

export default function QuickAddClient({
  onCreate,
}: {
  onCreate: (fields: { nom: string; telephone: string; canal: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [canal, setCanal] = useState<(typeof CANAUX)[number]>("WhatsApp");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setNom("");
    setTelephone("");
    setCanal("WhatsApp");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true);
    await onCreate({ nom: nom.trim(), telephone: telephone.trim(), canal });
    setSaving(false);
    close();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
                Nouveau client
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
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
              {saving ? "Création…" : "Créer le client"}
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
