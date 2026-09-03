"use client";

// Rappel affiché dès qu'on ajoute une activité de plongée — penser à
// proposer un guide francophone au client avant de continuer.
export default function PlongeeGuideAlert({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">Plongée — guide francophone</h2>
        <p className="mt-2 text-sm text-[#171717]">
          Pense à demander au client s&apos;il souhaite un guide francophone.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            J&apos;ai bien noté
          </button>
        </div>
      </div>
    </div>
  );
}
