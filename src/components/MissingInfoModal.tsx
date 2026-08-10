"use client";

export default function MissingInfoModal({
  message,
  actionLabel,
  onAction,
  onClose,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-md bg-white p-5">
        <p className="mb-4 text-sm font-medium text-[#171717]">
          ⚠ Information manquante : {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={onAction}
            className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

