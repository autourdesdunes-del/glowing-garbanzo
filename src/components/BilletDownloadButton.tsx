"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "billets-avion";

// Bouton minimal pour ouvrir/télécharger un billet déjà reçu (billet_lien —
// un chemin dans le bucket privé "billets-avion", jamais une URL publique)
// depuis un endroit qui n'a besoin que de le récupérer, pas de le
// remplacer/retirer — voir BilletAvionUpload pour la version complète
// (upload + retrait), utilisée dans le détail Suivis > Billets d'avion.
export default function BilletDownloadButton({
  path,
  label = "Télécharger le billet",
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    setLoading(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className={
        className ||
        "rounded-md border border-[#0F5C56]/40 px-2 py-1 text-xs font-medium text-[#0F5C56] hover:bg-[#0F5C56]/5 disabled:opacity-50"
      }
    >
      {loading ? "…" : `📄 ${label}`}
    </button>
  );
}
