"use client";

import { Client } from "@/lib/types";
import { DuplicateMatch } from "@/lib/duplicates";

function fmtDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function ClientQuickCard({
  client,
  reasons,
  isNew,
  onOpen,
  onDelete,
}: {
  client: Client;
  reasons?: string[];
  isNew?: boolean;
  onOpen?: () => void;
  onDelete: () => void;
}) {
  const debut = fmtDate(client.date_debut);
  const fin = fmtDate(client.date_fin);
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-heading font-semibold text-[#171717]">{client.nom || "Sans nom"}</span>
        {isNew && (
          <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-[11px] font-medium text-[#8B4531]">
            En cours de création
          </span>
        )}
      </div>
      {reasons && reasons.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {reasons.map((r) => (
            <span key={r} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
              {r}
            </span>
          ))}
        </div>
      )}
      <div className="mt-1.5 space-y-0.5 text-xs text-neutral-500">
        <div>{client.statut}</div>
        {client.telephone && <div>📞 {client.telephone}</div>}
        {client.pseudo_contact && (
          <div>
            {client.canal} — @{client.pseudo_contact}
          </div>
        )}
        {client.hotel && <div>🏨 {client.hotel}</div>}
        {(debut || fin) && (
          <div>
            {debut || "?"} → {fin || "?"}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-[#fafafa]"
          >
            Voir la fiche
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Supprimer ce dossier
        </button>
      </div>
    </div>
  );
}

export default function DuplicateClientModal({
  current,
  matches,
  onOpenClient,
  onDeleteClient,
  onKeepBoth,
}: {
  current: Client;
  matches: DuplicateMatch[];
  onOpenClient: (id: string) => void;
  onDeleteClient: (id: string) => void;
  onKeepBoth: () => void;
}) {
  if (matches.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">
          ⚠️ Attention, ce client existe peut-être déjà
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          {matches.length === 1
            ? "Un dossier qui ressemble a été trouvé."
            : `${matches.length} dossiers qui ressemblent ont été trouvés.`}{" "}
          Vérifie avant de continuer.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ClientQuickCard client={current} isNew onDelete={() => onDeleteClient(current.id)} />
          {matches.map((m) => (
            <ClientQuickCard
              key={m.client.id}
              client={m.client}
              reasons={m.reasons}
              onOpen={() => onOpenClient(m.client.id)}
              onDelete={() => onDeleteClient(m.client.id)}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onKeepBoth}
            className="rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Conserver les deux et continuer
          </button>
        </div>
      </div>
    </div>
  );
}
