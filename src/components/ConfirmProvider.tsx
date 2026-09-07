"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

type PendingConfirm = { options: ConfirmOptions; resolve: (v: boolean) => void };

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // File d'attente, pas un seul pending à la fois — sinon deux confirm()
  // déclenchés à peu près en même temps (deux boutons cliqués vite, deux
  // effets qui en demandent chacun un) écrasaient le premier resolver avant
  // sa réponse : la Promise du premier appelant ne se résolvait jamais, et
  // l'action censée suivre (suppression, annulation...) n'avait jamais
  // lieu, sans aucune erreur visible.
  const [queue, setQueue] = useState<PendingConfirm[]>([]);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, { options: normalized, resolve }]);
    });
  }, []);

  const current = queue[0] || null;

  const respond = (value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setQueue((prev) => prev.slice(1));
  };

  const options = current?.options || null;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            {options.title && (
              <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
                {options.title}
              </h2>
            )}
            <p className="mb-5 text-sm text-neutral-600">{options.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => respond(true)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 ${
                  options.danger ? "bg-red-600" : "bg-[#171717]"
                }`}
              >
                {options.confirmLabel || "Confirmer"}
              </button>
              <button
                onClick={() => respond(false)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                {options.cancelLabel || "Annuler"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
