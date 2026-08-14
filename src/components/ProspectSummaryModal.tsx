"use client";

import { useEffect, useState } from "react";
import { Client } from "@/lib/types";

function fmtDateTime(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

// Feuille de synthèse d'un prospect, déduite automatiquement de la
// conversation Kommo (WhatsApp/Instagram) — c'est directement cette carte
// qu'on modifie si l'extraction automatique s'est trompée ou est
// incomplète, plutôt que de renvoyer vers la fiche client complète (jugée
// trop lourde pour un simple prospect pas encore qualifié).
export default function ProspectSummaryModal({
  client,
  onClose,
  onUpdateClient,
  onConfirmClient,
}: {
  client: Client;
  onClose: () => void;
  onUpdateClient: (patch: Partial<Client>) => void;
  onConfirmClient: () => void;
}) {
  const [draft, setDraft] = useState(client);
  useEffect(() => {
    setDraft(client);
  }, [client]);

  const save = (patch: Partial<Client>) => onUpdateClient(patch);

  const derniereMaj = fmtDateTime(client.kommo_extraction_updated_at);
  const demandeInfosLe = fmtDate(client.kommo_demande_infos_envoyee_le);
  const premierEchange = fmtDateTime(client.kommo_premier_echange_le);
  const dernierEchangeDate = [client.kommo_last_client_message_at, client.kommo_last_team_reply_at]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  const dernierEchange = dernierEchangeDate ? fmtDateTime(dernierEchangeDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold text-[#171717]">
            {client.nom || "Sans nom"}
          </h3>
          <button type="button" onClick={onClose} className="shrink-0 text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <Field label="Résumé">
            <textarea
              value={draft.kommo_resume}
              onChange={(e) => setDraft({ ...draft, kommo_resume: e.target.value })}
              onBlur={() => save({ kommo_resume: draft.kommo_resume })}
              placeholder="Résumé de la conversation…"
              rows={3}
              className="input text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Séjour — début">
              <input
                type="date"
                value={draft.kommo_sejour_debut_estime || ""}
                onChange={(e) => setDraft({ ...draft, kommo_sejour_debut_estime: e.target.value || null })}
                onBlur={() => save({ kommo_sejour_debut_estime: draft.kommo_sejour_debut_estime })}
                className="input text-sm"
              />
            </Field>
            <Field label="Séjour — fin">
              <input
                type="date"
                value={draft.kommo_sejour_fin_estime || ""}
                onChange={(e) => setDraft({ ...draft, kommo_sejour_fin_estime: e.target.value || null })}
                onBlur={() => save({ kommo_sejour_fin_estime: draft.kommo_sejour_fin_estime })}
                className="input text-sm"
              />
            </Field>
          </div>

          <Field label="Hôtel">
            <input
              type="text"
              value={draft.kommo_hotel_estime}
              onChange={(e) => setDraft({ ...draft, kommo_hotel_estime: e.target.value })}
              onBlur={() => save({ kommo_hotel_estime: draft.kommo_hotel_estime })}
              placeholder="Hôtel estimé"
              className="input text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Adultes">
              <input
                type="number"
                min={0}
                value={draft.kommo_nb_adultes_estime ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, kommo_nb_adultes_estime: e.target.value === "" ? null : Number(e.target.value) })
                }
                onBlur={() => save({ kommo_nb_adultes_estime: draft.kommo_nb_adultes_estime })}
                className="input text-sm"
              />
            </Field>
            <Field label="Enfants">
              <input
                type="number"
                min={0}
                value={draft.kommo_nb_enfants_estime ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, kommo_nb_enfants_estime: e.target.value === "" ? null : Number(e.target.value) })
                }
                onBlur={() => save({ kommo_nb_enfants_estime: draft.kommo_nb_enfants_estime })}
                className="input text-sm"
              />
            </Field>
          </div>

          <Field label="Âges enfants/ados">
            <input
              type="text"
              value={draft.kommo_ages_enfants_estime}
              onChange={(e) => setDraft({ ...draft, kommo_ages_enfants_estime: e.target.value })}
              onBlur={() => save({ kommo_ages_enfants_estime: draft.kommo_ages_enfants_estime })}
              placeholder="ex. 6, 9 et 14 ans"
              className="input text-sm"
            />
          </Field>

          <Field label="Activités qui l'intéressent">
            <input
              type="text"
              value={draft.kommo_activites_interet}
              onChange={(e) => setDraft({ ...draft, kommo_activites_interet: e.target.value })}
              onBlur={() => save({ kommo_activites_interet: draft.kommo_activites_interet })}
              placeholder="ex. Louxor, plongée, quad (séparées par une virgule)"
              className="input text-sm"
            />
          </Field>

          <Field label="Programme envoyé">
            <textarea
              value={draft.kommo_programme_envoye_resume}
              onChange={(e) => setDraft({ ...draft, kommo_programme_envoye_resume: e.target.value })}
              onBlur={() => save({ kommo_programme_envoye_resume: draft.kommo_programme_envoye_resume })}
              placeholder="Résumé du programme envoyé…"
              rows={2}
              className="input text-sm"
            />
          </Field>

          <Field label="Note">
            <textarea
              value={draft.commentaires}
              onChange={(e) => setDraft({ ...draft, commentaires: e.target.value })}
              onBlur={() => save({ commentaires: draft.commentaires })}
              placeholder="Note libre pour l'équipe…"
              rows={2}
              className="input text-sm"
            />
          </Field>
        </div>

        {(demandeInfosLe || premierEchange || dernierEchange) && (
          <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
            {demandeInfosLe && <p>Demande d&apos;infos envoyée le {demandeInfosLe}</p>}
            {premierEchange && <p>Premier échange : {premierEchange}</p>}
            {dernierEchange && <p>Dernier échange : {dernierEchange}</p>}
          </div>
        )}

        {derniereMaj && (
          <p className="mt-3 text-[11px] text-neutral-400">
            Champs pré-remplis automatiquement depuis la conversation Kommo (dernière extraction {derniereMaj}) —
            modifiables ci-dessus si besoin.
          </p>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={onConfirmClient}
            className="w-full rounded-md bg-[#0F5C56] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            ✓ Passer en client confirmé
          </button>
        </div>
      </div>
    </div>
  );
}
