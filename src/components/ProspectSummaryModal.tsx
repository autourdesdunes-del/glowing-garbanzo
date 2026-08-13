"use client";

import { Client } from "@/lib/types";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateTime(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-[#171717]">{children}</span>
    </div>
  );
}

// Feuille de synthèse d'un prospect, déduite automatiquement de la
// conversation Kommo (WhatsApp/Instagram) — n'affiche que ce qui a
// effectivement été extrait, jamais de section vide/placeholder.
export default function ProspectSummaryModal({
  client,
  onClose,
  onOpenFullFile,
  onConfirmClient,
}: {
  client: Client;
  onClose: () => void;
  onOpenFullFile: () => void;
  onConfirmClient: () => void;
}) {
  const sejourDebut = fmtDate(client.kommo_sejour_debut_estime);
  const sejourFin = fmtDate(client.kommo_sejour_fin_estime);
  const hasSejour = sejourDebut || sejourFin;
  const hasPax = client.kommo_nb_adultes_estime != null || client.kommo_nb_enfants_estime != null;
  const activites = (client.kommo_activites_interet || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const derniereMaj = fmtDateTime(client.kommo_extraction_updated_at);
  const demandeInfosLe = fmtDate(client.kommo_demande_infos_envoyee_le);
  const premierEchange = fmtDateTime(client.kommo_premier_echange_le);
  const dernierEchangeDate = [client.kommo_last_client_message_at, client.kommo_last_team_reply_at]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  const dernierEchange = dernierEchangeDate ? fmtDateTime(dernierEchangeDate) : null;

  const hasAnything =
    !!client.kommo_resume ||
    hasSejour ||
    !!client.kommo_hotel_estime ||
    hasPax ||
    !!client.kommo_ages_enfants_estime ||
    activites.length > 0 ||
    !!client.kommo_programme_envoye_resume ||
    !!demandeInfosLe ||
    !!premierEchange;

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

        {client.kommo_resume && (
          <p className="mt-3 rounded-md bg-[#fafafa] p-3 text-sm text-[#171717]">{client.kommo_resume}</p>
        )}

        {(hasSejour || client.kommo_hotel_estime || hasPax || client.kommo_ages_enfants_estime) && (
          <div className="mt-3">
            {hasSejour && (
              <DetailRow label="Séjour">
                {sejourDebut || "?"}
                {sejourFin ? ` → ${sejourFin}` : ""}
              </DetailRow>
            )}
            {client.kommo_hotel_estime && <DetailRow label="Hôtel">{client.kommo_hotel_estime}</DetailRow>}
            {hasPax && (
              <DetailRow label="PAX">
                {client.kommo_nb_adultes_estime != null ? `${client.kommo_nb_adultes_estime} adultes` : ""}
                {client.kommo_nb_enfants_estime
                  ? `${client.kommo_nb_adultes_estime != null ? ", " : ""}${client.kommo_nb_enfants_estime} enfant(s)`
                  : ""}
              </DetailRow>
            )}
            {client.kommo_ages_enfants_estime && (
              <DetailRow label="Âges enfants/ados">{client.kommo_ages_enfants_estime}</DetailRow>
            )}
          </div>
        )}

        {activites.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-neutral-500">Activités qui l&apos;intéressent</p>
            <div className="flex flex-wrap gap-1.5">
              {activites.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {client.kommo_programme_envoye_resume && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-neutral-500">Programme envoyé</p>
            <p className="rounded-md bg-[#0F5C56]/5 p-3 text-sm text-[#171717]">
              {client.kommo_programme_envoye_resume}
            </p>
          </div>
        )}

        {demandeInfosLe && <DetailRow label="Demande d'infos envoyée le">{demandeInfosLe}</DetailRow>}

        {(premierEchange || dernierEchange) && (
          <div className="mt-3">
            {premierEchange && <DetailRow label="Premier échange">{premierEchange}</DetailRow>}
            {dernierEchange && <DetailRow label="Dernier échange">{dernierEchange}</DetailRow>}
          </div>
        )}

        {!hasAnything && (
          <p className="mt-3 text-sm text-neutral-400">
            Pas encore assez d&apos;informations dans la conversation Kommo pour remplir cette fiche.
          </p>
        )}

        {derniereMaj && (
          <p className="mt-3 text-[11px] text-neutral-400">
            Déduit automatiquement de la conversation Kommo — dernière mise à jour {derniereMaj}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirmClient}
            className="w-full rounded-md bg-[#0F5C56] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            ✓ Passer en client confirmé
          </button>
          <button
            type="button"
            onClick={onOpenFullFile}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            Voir la fiche complète
          </button>
        </div>
      </div>
    </div>
  );
}
