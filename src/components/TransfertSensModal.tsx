"use client";

import { SensTransfertOption } from "@/lib/resa";

// Demande le sens du transfert (aéroport ↔ hôtel, ou ville A ↔ ville B) dès
// la sélection dans le catalogue — le titre affiché est mis à jour avec la
// réponse (voir transfertSensOptions dans resa.ts).
export default function TransfertSensModal({
  nomActivite,
  options,
  onChoose,
  onCancel,
}: {
  nomActivite: string;
  options: SensTransfertOption[];
  onChoose: (option: SensTransfertOption) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">{nomActivite}</h2>
        <p className="mt-2 text-sm text-[#666666]">Dans quel sens se fait ce transfert ?</p>
        <div className="mt-4 flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChoose(o)}
              className="w-full rounded-md border border-[#171717] px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
            >
              {o.label}
            </button>
          ))}
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
