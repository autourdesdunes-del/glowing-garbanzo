"use client";

import { useState } from "react";

// Fenêtre rouge affichée quand la date choisie pour une activité tombe un
// jour où le catalogue dit l'activité indisponible (ex. Louxor en mini-bus,
// seulement mardi/jeudi/dimanche). Même schéma que ActivityRedirectAlert :
// soit l'employée corrige elle-même, soit elle demande une autorisation à
// un supérieur (Sylvie/Direction) — l'activité est alors ajoutée avec la
// date choisie, en attente de validation en parallèle.
export default function JourIndisponibleAlert({
  nomActivite,
  jourChoisi,
  joursDisponibles,
  onChangeDate,
  onDemanderAutorisation,
}: {
  nomActivite: string;
  jourChoisi: string;
  joursDisponibles: string[];
  onChangeDate: () => void;
  onDemanderAutorisation: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-600 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-red-600">
          Date indisponible — {nomActivite}
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          Cette activité n&apos;a lieu que le <strong>{joursDisponibles.join(", ")}</strong>. La
          date choisie tombe un <strong>{jourChoisi}</strong>, ce n&apos;est pas possible.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onChangeDate}
            className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Compris, je change la date
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onDemanderAutorisation();
            }}
            className="w-full rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Demander l&apos;autorisation à un supérieur
          </button>
        </div>
      </div>
    </div>
  );
}
