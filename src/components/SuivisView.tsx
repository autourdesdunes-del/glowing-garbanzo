"use client";

import { useState } from "react";
import { Client, Remboursement, Reservation } from "@/lib/types";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const SUBS = [
  { key: "rdv", label: "RDV paiements" },
  { key: "aurevoir", label: "Au revoir" },
  { key: "avis", label: "Avis clients" },
  { key: "remb", label: "Remboursements" },
  { key: "billets", label: "Billets d'avion" },
] as const;

function JumpBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-[#5C2A1D] hover:bg-neutral-200"
    >
      → Fiche client
    </button>
  );
}

export default function SuivisView({
  clients,
  reservations,
  remboursements,
  onUpdateClient,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  remboursements: Remboursement[];
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  onOpenClient: (id: string) => void;
}) {
  const [sub, setSub] = useState<(typeof SUBS)[number]["key"]>("rdv");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const rdvRows = clients
    .filter((c) => !c.solde_activite_id && (c.solde_rdv_heure || c.solde_rdv_lieu))
    .sort((a, b) => (a.solde_date || "").localeCompare(b.solde_date || ""));

  const auRevoirRows = clients
    .filter((c) => c.date_fin)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 1) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const avisRows = clients
    .filter((c) => c.date_fin)
    .map((c) => ({ c, dateCible: addDays(c.date_fin as string, 7) }))
    .filter((x) => x.dateCible <= todayStr)
    .sort((a, b) => a.dateCible.localeCompare(b.dateCible));

  const remboursementRows = [...remboursements].sort((a, b) =>
    (b.date_probleme || "").localeCompare(a.date_probleme || "")
  );

  const billetsRows = clients.filter((c) => c.billet_requis);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        {SUBS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              sub === s.key
                ? "border-[#0F5C56] bg-[#0F5C56] text-white"
                : "border-neutral-300 bg-white text-neutral-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sub === "rdv" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#5C2A1D]">
            Rendez-vous de paiement à venir
          </h3>
          {rdvRows.length === 0 && (
            <div className="text-sm text-neutral-400">Aucun RDV paiement enregistré.</div>
          )}
          <div className="space-y-2">
            {rdvRows.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm"
              >
                <span className="font-amounts text-neutral-500">
                  {fmtDate(c.solde_date)} {c.solde_rdv_heure}
                </span>
                <span>
                  <strong>{c.nom || "Sans nom"}</strong> — {c.hotel || "Hôtel ?"}
                </span>
                <span className="text-neutral-500">{c.solde_rdv_lieu}</span>
                <span className="font-amounts">{euros(c.solde_montant)} €</span>
                <span className="text-neutral-500">{c.solde_assigne_a || "Non assigné"}</span>
                <span className="flex-1" />
                <JumpBtn onClick={() => onOpenClient(c.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "aurevoir" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#5C2A1D]">
            Messages de bon retour à envoyer (J+1)
          </h3>
          {auRevoirRows.length === 0 && (
            <div className="text-sm text-neutral-400">Rien à envoyer pour l&apos;instant.</div>
          )}
          <div className="space-y-2">
            {auRevoirRows.map(({ c, dateCible }) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm ${
                  dateCible === todayStr
                    ? "border-[#C9973E] bg-[#C9973E]/10"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <span className="font-amounts text-neutral-500">
                  {fmtDate(dateCible)}
                  {dateCible === todayStr ? " — aujourd'hui" : ""}
                </span>
                <span>
                  <strong>{c.nom || "Sans nom"}</strong>
                </span>
                <label className="flex items-center gap-1 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={c.au_revoir_envoye}
                    onChange={(e) => onUpdateClient(c.id, { au_revoir_envoye: e.target.checked })}
                  />
                  Envoyé
                </label>
                <span className="flex-1" />
                <JumpBtn onClick={() => onOpenClient(c.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "avis" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#5C2A1D]">
            Demandes d&apos;avis à envoyer (J+7)
          </h3>
          {avisRows.length === 0 && (
            <div className="text-sm text-neutral-400">Rien à envoyer pour l&apos;instant.</div>
          )}
          <div className="space-y-2">
            {avisRows.map(({ c, dateCible }) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm ${
                  dateCible === todayStr
                    ? "border-[#C9973E] bg-[#C9973E]/10"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <span className="font-amounts text-neutral-500">
                  {fmtDate(dateCible)}
                  {dateCible === todayStr ? " — aujourd'hui" : ""}
                </span>
                <span>
                  <strong>{c.nom || "Sans nom"}</strong>
                </span>
                <label className="flex items-center gap-1 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={c.avis_envoye}
                    onChange={(e) => onUpdateClient(c.id, { avis_envoye: e.target.checked })}
                  />
                  Envoyé
                </label>
                <span className="flex-1" />
                <JumpBtn onClick={() => onOpenClient(c.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {sub === "remb" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#5C2A1D]">
            Remboursements
          </h3>
          {remboursementRows.length === 0 && (
            <div className="text-sm text-neutral-400">Aucun remboursement enregistré.</div>
          )}
          <div className="space-y-2">
            {remboursementRows.map((r) => {
              const client = clients.find((c) => c.id === r.client_id);
              if (!client) return null;
              const activite = reservations.find((res) => res.id === r.activite_id);
              const key = "remb-" + r.id;
              const isOpen = expanded[key];
              return (
                <div key={r.id} className="rounded-md border border-neutral-200 bg-white">
                  <div
                    onClick={() => toggleExpand(key)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm"
                  >
                    <span className="font-amounts text-neutral-500">
                      {fmtDate(r.date_probleme)}
                    </span>
                    <span>
                      <strong>{client.nom || "Sans nom"}</strong> —{" "}
                      {r.raison === "Autre" ? r.raison_autre || "Autre" : r.raison}
                    </span>
                    <span className="text-neutral-500">
                      {activite ? activite.nom_activite : "Non liée"}
                    </span>
                    <span className="font-amounts">{euros(r.montant)} €</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.statut === "Effectué"
                          ? "bg-[#0F5C56]/10 text-[#0F5C56]"
                          : "bg-[#C9973E]/20 text-[#8B4531]"
                      }`}
                    >
                      {r.statut}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="space-y-1 border-t border-neutral-100 p-3 text-sm text-neutral-600">
                      <div>Mode : {r.mode || "—"}</div>
                      <div>Fait par : {r.par || "—"}</div>
                      <div>
                        Date du remboursement :{" "}
                        {r.date_remboursement ? fmtDate(r.date_remboursement) : "—"}
                      </div>
                      <JumpBtn onClick={() => onOpenClient(client.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sub === "billets" && (
        <div>
          <h3 className="font-heading mb-2 text-sm font-semibold text-[#5C2A1D]">
            Billets d&apos;avion — pour Hossam
          </h3>
          {billetsRows.length === 0 && (
            <div className="text-sm text-neutral-400">
              Aucun client avec billet à gérer pour l&apos;instant.
            </div>
          )}
          <div className="space-y-2">
            {billetsRows.map((c) => {
              const activite = reservations.find((r) => r.id === c.billet_activite_id);
              const key = "billet-" + c.id;
              const isOpen = expanded[key];
              return (
                <div key={c.id} className="rounded-md border border-neutral-200 bg-white">
                  <div
                    onClick={() => toggleExpand(key)}
                    className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm"
                  >
                    <span className="font-amounts text-neutral-500">
                      {c.billet_date ? fmtDate(c.billet_date) : "Date ?"}
                    </span>
                    <span>
                      <strong>{c.nom || "Sans nom"}</strong> — {c.hotel || "Hôtel ?"}
                    </span>
                    {activite && (
                      <span className="text-neutral-500">Lié à : {activite.nom_activite}</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.billet_acompte_paye
                          ? "bg-[#0F5C56]/10 text-[#0F5C56]"
                          : "bg-[#C9973E]/20 text-[#8B4531]"
                      }`}
                    >
                      Acompte {c.billet_acompte_paye ? "payé" : "en attente"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.billet_envoye
                          ? "bg-[#0F5C56]/10 text-[#0F5C56]"
                          : "bg-[#C9973E]/20 text-[#8B4531]"
                      }`}
                    >
                      {c.billet_envoye ? "Envoyé" : "Pas envoyé"}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {c.billet_statut}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="space-y-1 border-t border-neutral-100 p-3 text-sm text-neutral-600">
                      {c.billet_lien && (
                        <div>
                          <a
                            href={c.billet_lien}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0F5C56] underline"
                          >
                            Voir le billet
                          </a>
                        </div>
                      )}
                      <div>Notes : {c.billet_notes || "—"}</div>
                      <JumpBtn onClick={() => onOpenClient(c.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
