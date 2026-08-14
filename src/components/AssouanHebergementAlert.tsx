"use client";

import { useState } from "react";

// Explique à l'employée la logistique de récupération à Assouan (rive
// ville vs île/presqu'île/Village Nubien) pour qu'elle en informe le
// client, avant de marquer que c'est fait — ce qui part en vérification
// chez Sylvie/Direction (voir AssouanVerificationCenter).
export default function AssouanHebergementAlert({
  nomActivite,
  onClose,
  onConfirmerInfo,
}: {
  nomActivite: string;
  onClose: () => void;
  onConfirmerInfo: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-[#0F5C56] bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#0F5C56]">
          Hébergement à Assouan — {nomActivite}
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          Demande au client de vérifier la localisation de son hôtel à Assouan sur la carte :
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#171717]">
          <li>
            Hôtel sur la <strong>rive de la ville</strong> (côté McDonald&apos;s sur la carte) :
            le chauffeur vient le chercher directement à l&apos;hôtel.
          </li>
          <li>
            Hôtel sur une <strong>île, presqu&apos;île, ou côté Village Nubien</strong> : compter
            1h de route en plus (pour le chauffeur comme pour le client). Le client peut demander
            à son hôtel une <strong>navette bateau</strong> (existe pour tous les hôtels de ce
            côté-là, à réserver directement auprès de l&apos;hôtel, généralement gratuite) — le
            chauffeur l&apos;attendra alors de l&apos;autre côté de la rive.
          </li>
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onConfirmerInfo();
            }}
            className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            J&apos;ai informé le client
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
