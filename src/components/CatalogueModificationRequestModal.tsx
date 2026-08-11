"use client";

import { useState } from "react";
import { CatalogueItem } from "@/lib/types";
import { TYPE_MODIFICATION_OPTIONS } from "@/lib/constants";

export default function CatalogueModificationRequestModal({
  items,
  onSubmit,
  onClose,
}: {
  items: CatalogueItem[];
  onSubmit: (payload: {
    catalogueItemIds: string[];
    typeModification: (typeof TYPE_MODIFICATION_OPTIONS)[number];
    autreDetail: string;
    explication: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeModification, setTypeModification] =
    useState<(typeof TYPE_MODIFICATION_OPTIONS)[number]>("Tarif");
  const [autreDetail, setAutreDetail] = useState("");
  const [explication, setExplication] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filtered = search.trim()
    ? items.filter((a) => a.nom.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  const canSubmit =
    selectedIds.length > 0 &&
    explication.trim() &&
    (typeModification !== "Autre" || autreDetail.trim());

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await onSubmit({
      catalogueItemIds: selectedIds,
      typeModification,
      autreDetail: autreDetail.trim(),
      explication: explication.trim(),
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Demander une modification
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#171717]">
            Activité(s) concernée(s)
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une activité…"
            className="input mb-2 w-full"
          />
          <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-200">
            {filtered.length === 0 && (
              <div className="p-3 text-sm text-neutral-400">Aucune activité trouvée.</div>
            )}
            {filtered.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 hover:bg-[#fafafa]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(a.id)}
                  onChange={() => toggle(a.id)}
                />
                {a.nom}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#171717]">Type de modification</label>
          <div className="flex flex-wrap gap-2">
            {TYPE_MODIFICATION_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeModification(t)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  typeModification === t
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {typeModification === "Autre" && (
            <input
              value={autreDetail}
              onChange={(e) => setAutreDetail(e.target.value)}
              placeholder="Précisez…"
              className="input mt-2 w-full"
            />
          )}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-[#171717]">Explication</label>
          <textarea
            value={explication}
            onChange={(e) => setExplication(e.target.value)}
            rows={3}
            placeholder="Détaillez ce qui doit changer et pourquoi…"
            className="input w-full"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}
