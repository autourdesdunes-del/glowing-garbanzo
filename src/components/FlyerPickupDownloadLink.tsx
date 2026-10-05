"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "flyer-pickups";

// Résout l'URL signée seulement au clic (pas au montage de chaque carte
// pick-up) — évite une requête Storage par carte affichée alors que la
// plupart ne seront jamais ouvertes dans la session.
export default function FlyerPickupDownloadLink({
  path,
  fileName,
  className,
}: {
  path: string;
  fileName?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const downloadFlyer = async () => {
    setLoading(true);
    const supabase = createClient();
    const ext = path.split(".").pop();
    // download: true demande à Supabase d'envoyer Content-Disposition:
    // attachment — le navigateur télécharge direct le fichier (ordi comme
    // mobile) au lieu de juste l'afficher dans un nouvel onglet, pour que
    // l'équipe puisse l'envoyer au client sans manip supplémentaire.
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600, { download: `${fileName || "flyer-pickup"}.${ext}` });
    setLoading(false);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.click();
    }
  };

  return (
    <button type="button" onClick={downloadFlyer} disabled={loading} className={className}>
      {loading ? "Téléchargement…" : "Télécharger le flyer"}
    </button>
  );
}
