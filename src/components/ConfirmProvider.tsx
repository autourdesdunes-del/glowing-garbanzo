"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { message: opts } : opts;
    setOptions(normalized);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const respond = (value: boolean) => {
    setOptions(null);
    resolver.current?.(value);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            {options.title && (
              <h2 className="font-heading mb-2 text-lg font-semibold text-[#5C2A1D]">
                {options.title}
              </h2>
            )}
            <p className="mb-5 text-sm text-neutral-600">{options.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => respond(false)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Annuler
              </button>
              <button
                onClick={() => respond(true)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 ${
                  options.danger ? "bg-red-600" : "bg-[#5C2A1D]"
                }`}
              >
                {options.confirmLabel || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
