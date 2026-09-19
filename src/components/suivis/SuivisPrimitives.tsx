"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/suivisFormat";
import { StatutBadgeSelect } from "@/components/StatutBadgeSelect";

// Petits composants de présentation communs aux vues Suivis — extraits de
// SuivisView.tsx pour alléger ce fichier, sans changement de comportement.

export function VoirRibLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.storage.from("rib-screenshots").createSignedUrl(path, 3600);
        setLoading(false);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      }}
      className="text-xs font-medium text-[#171717] underline hover:no-underline"
    >
      {loading ? "Ouverture…" : "Voir le RIB"}
    </button>
  );
}

// Remplace le bouton "→ Fiche client" : le prénom/nom lui-même amène à la
// fiche, en un clic au lieu de deux.
export function ClientNameLink({
  nom,
  onClick,
  className,
}: {
  nom: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={className ?? "font-semibold text-[#171717] hover:underline"}
    >
      {nom || "Sans nom"}
    </button>
  );
}

const AVIS_STATUT_STYLES: Record<Client["avis_statut"], string> = {
  "À demander": "border-[#4A7FD6]/40 bg-[#4A7FD6]/10 text-[#3861A8]",
  "À ne pas demander": "border-[#D6544A]/40 bg-[#D6544A]/10 text-[#B23F36]",
  "Déjà publié": "border-[#3E8F5C]/40 bg-[#3E8F5C]/10 text-[#2C6B44]",
};

const AVIS_STATUT_OPTIONS: { key: Client["avis_statut"]; label: string; className: string }[] = [
  { key: "À demander", label: "À demander", className: AVIS_STATUT_STYLES["À demander"] },
  { key: "À ne pas demander", label: "À ne pas demander", className: AVIS_STATUT_STYLES["À ne pas demander"] },
  { key: "Déjà publié", label: "Déjà publié", className: AVIS_STATUT_STYLES["Déjà publié"] },
];

export function AvisStatutSelector({
  value,
  onChange,
}: {
  value: Client["avis_statut"];
  onChange: (v: Client["avis_statut"]) => void;
}) {
  return (
    <StatutBadgeSelect
      value={value}
      options={AVIS_STATUT_OPTIONS}
      onChange={onChange}
      className="ml-auto"
    />
  );
}

export function DateRangeBadge({ debut, fin }: { debut: string | null; fin: string | null }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F2E6D2] px-2 py-0.5 text-[11px] text-[#8B4531]">
      <span>{debut ? fmtDate(debut) : "?"}</span>
      <span className="text-[#C9973E]">→</span>
      <span>{fin ? fmtDate(fin) : "?"}</span>
    </span>
  );
}
