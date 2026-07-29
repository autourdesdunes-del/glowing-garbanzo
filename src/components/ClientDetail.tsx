"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import {
  ActivitesStep,
  BilletAvionStep,
  ContactStep,
  PaiementsStep,
  SejourStep,
  SuiviStep,
} from "@/components/client-steps";

const STEPS = ["Contact", "Séjour", "Billet d'avion", "Activités", "Paiements", "Suivi"];

export default function ClientDetail({
  client,
  onChange,
  onDelete,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  onDelete: () => void;
}) {
  const [step, setStep] = useState(0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <input
          value={client.nom}
          onChange={(e) => onChange({ nom: e.target.value })}
          placeholder="Nom du client"
          className="font-heading w-full max-w-md rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold text-[#5C2A1D] hover:border-neutral-200 focus:border-[#0F5C56] focus:outline-none"
        />
        <button
          onClick={onDelete}
          className="whitespace-nowrap rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          Supprimer ce client
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              i === step
                ? "bg-[#0F5C56] text-white"
                : "bg-white text-[#5C2A1D] hover:bg-[#F2E6D2]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && <ContactStep client={client} onChange={onChange} />}
      {step === 1 && <SejourStep client={client} onChange={onChange} />}
      {step === 2 && <BilletAvionStep client={client} onChange={onChange} />}
      {step === 3 && <ActivitesStep />}
      {step === 4 && <PaiementsStep client={client} onChange={onChange} />}
      {step === 5 && <SuiviStep client={client} onChange={onChange} />}

      <div className="mt-8 flex items-center justify-between border-t border-[#8B4531]/10 pt-4">
        <button
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-md border border-[#8B4531]/30 px-3 py-1.5 text-sm text-[#5C2A1D] disabled:opacity-30"
        >
          ← Précédent
        </button>
        <span className="text-xs text-neutral-500">
          Étape {step + 1} / {STEPS.length}
        </span>
        <button
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          className="rounded-md border border-[#8B4531]/30 px-3 py-1.5 text-sm text-[#5C2A1D] disabled:opacity-30"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
