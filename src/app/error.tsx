"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-8 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] font-bold text-[#fafafa]">
          AD
        </div>
        <h1 className="mb-1 text-lg font-semibold text-[#171717]">Une erreur est survenue</h1>
        <p className="mb-6 text-sm text-neutral-500">Contacte Mélanie si ça se reproduit.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Recharger la page
        </button>
      </div>
    </div>
  );
}
