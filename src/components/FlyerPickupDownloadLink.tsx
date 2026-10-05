"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "flyer-pickups";

// Résout l'URL signée seulement au clic (pas au montage de chaque carte
// pick-up) — évite une requête Storage par carte affichée alors que la
// plupart ne seront jamais ouvertes dans la session.
export default function FlyerPickupDownloadLink({ path, className }: { path: string; className?: string }) {
  const [loading, setLoading] = useState(false);

  const openFlyer = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    setLoading(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button type="button" onClick={openFlyer} disabled={loading} className={className}>
      {loading ? "Ouverture…" : "Télécharger le flyer"}
    </button>
  );
}
