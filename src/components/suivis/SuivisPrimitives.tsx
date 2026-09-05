"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { fmtDate } from "@/lib/suivisFormat";

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

export function AvisStatutSelector({
  value,
  onChange,
}: {
  value: Client["avis_statut"];
  onChange: (v: Client["avis_statut"]) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Client["avis_statut"])}
      className={`ml-auto shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium outline-none ${AVIS_STATUT_STYLES[value]}`}
    >
      <option value="À demander">À demander</option>
      <option value="À ne pas demander">À ne pas demander</option>
      <option value="Déjà publié">Déjà publié</option>
    </select>
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
