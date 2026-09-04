"use client";

import { useState } from "react";
import { Client, Remboursement, Reservation } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ANNULATION_TYPE_PAR: Record<string, string> = {
  client: "par le client",
  agence: "par l'agence",
  gouvernement: "par le gouvernement",
};

export function VoirPreuveRemboursementLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.storage.from("remboursement-preuves").createSignedUrl(path, 3600);
        setLoading(false);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      }}
      className="text-xs font-medium text-emerald-700 underline hover:no-underline"
    >
      {loading ? "Ouverture…" : "voir la photo"}
    </button>
  );
}

// Carte résumé d'un remboursement — même rendu partout dans le CRM (fiche
// client comme Suivis > Remboursements), pour ne jamais avoir deux versions
// différentes de la même information.
export default function RemboursementSummaryCard({
  r,
  client,
  activiteLiee,
  onClick,
  actions,
}: {
  r: Remboursement;
  client: Client;
  activiteLiee: Reservation | undefined;
  onClick?: () => void;
  // Icônes optionnelles à droite (✎/🗑) — omis dans les contextes en
  // lecture seule (ex. Suivis > Remboursements).
  actions?: React.ReactNode;
}) {
  const moyenPaiement =
    r.mode === "PayPal"
      ? r.paypal_email || "adresse PayPal manquante"
      : r.mode === "Virement bancaire"
        ? r.rib_photo_path
          ? "RIB fourni"
          : "RIB manquant"
        : r.mode || "moyen non précisé";
  const motif = activiteLiee?.annulation_raison || (r.raison === "Autre" ? r.raison_autre : r.raison) || "—";
  const delaiOk =
    !!activiteLiee?.annulation_delai_raison &&
    activiteLiee.annulation_delai_raison.includes("remboursable") &&
    !activiteLiee.annulation_delai_raison.includes("non remboursable");
  // Aucun seuil d'urgence n'existait avant sur les remboursements "en
  // attente" (contrairement aux messages clients, seuil 48h) — un dossier
  // pouvait dormir des semaines sans qu'aucun signal visuel ne l'indique.
  const joursEnAttente =
    r.statut !== "Effectué"
      ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)
      : 0;

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-start justify-between gap-3 p-3 text-left ${
        onClick ? "hover:bg-[#fafafa]" : ""
      }`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-[#171717]">
          {client.nom || "Sans nom"} — {moyenPaiement}
        </p>
        {activiteLiee && (
          <p className="text-xs text-neutral-600">
            Activité annulée ({ANNULATION_TYPE_PAR[activiteLiee.annulation_type] || "par le client"}) :{" "}
            {activiteLiee.nom_activite || "Activité sans nom"}
          </p>
        )}
        <p className="text-xs text-neutral-500">
          Date prévue de l&apos;activité : {activiteLiee?.date_debut ? fmtDate(activiteLiee.date_debut) : "—"}
          {" — "}
          {activiteLiee?.annulation_date ? (
            <>
              Date et heure d&apos;annulation : {fmtDate(activiteLiee.annulation_date)}
              {activiteLiee.annulation_heure ? ` à ${activiteLiee.annulation_heure}` : ""}
            </>
          ) : (
            // Pas d'activité liée (ou sans date d'annulation connue) — on ne
            // peut afficher que la date de SAISIE du remboursement dans le
            // CRM, pas la vraie date d'annulation. Le libellé le dit
            // explicitement pour ne pas induire en erreur (vécu sur
            // Rosemarie LONG : la date de saisie affichée comme si c'était
            // la date d'annulation réelle, "4 sept." au lieu du vrai
            // "28/08 à 9h").
            <>Remboursement saisi le : {fmtDateTime(r.created_at)}</>
          )}
        </p>
        <p className="text-xs text-neutral-500">Motif : {motif}</p>
        {r.details && <p className="text-xs text-neutral-500">Détails : {r.details}</p>}
        {activiteLiee?.annulation_type === "client" && activiteLiee.annulation_delai_raison && (
          <p className={`text-xs font-medium ${delaiOk ? "text-emerald-600" : "text-orange-600"}`}>
            {delaiOk
              ? `✅ ${activiteLiee.annulation_delai_raison} (selon la règle du catalogue)`
              : `⚠️ ${activiteLiee.annulation_delai_raison} — exceptionnel/partiel, vérifié avec Hossam`}
          </p>
        )}
        {r.statut === "Effectué" && (
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            <span>
              Remboursé le{" "}
              {r.date_remboursement_ts ? fmtDateTime(r.date_remboursement_ts) : fmtDate(r.date_remboursement)}
            </span>
            {r.preuve_photo_path && <VoirPreuveRemboursementLink path={r.preuve_photo_path} />}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="font-heading text-lg font-bold text-red-600">{euros(r.montant)} €</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            r.statut === "Effectué" ? "bg-green-100 text-green-700" : "bg-[#f5a623]/20 text-[#8B4531]"
          }`}
        >
          {r.statut}
        </span>
        {joursEnAttente >= 7 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
            ⚠️ {joursEnAttente}j
          </span>
        )}
        {actions && <div className="flex gap-1">{actions}</div>}
      </div>
    </Wrapper>
  );
}
