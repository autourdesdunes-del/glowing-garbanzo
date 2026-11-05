"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Hôtels saisis côté vitrine (tunnel de réservation) et absents de
// hotels_reference — détectés par proximité géographique avec les hôtels
// déjà géolocalisés (voir lib/geo.ts côté vitrine, migration 0182 pour la
// table). Autonome : se recharge lui-même plutôt que de passer par
// AppShell, comme "Demandes du site" juste au-dessus dans ce sous-menu.
type HotelNonReference = {
  id: string;
  nom: string;
  latitude: number | null;
  longitude: number | null;
  zone_detectee: string;
  distance_km: number | null;
  valide: boolean;
  created_at: string;
};

const ZONES = ["Hurghada", "Sahl Hasheesh", "Makadi Bay", "El Gouna", "Safaga", "Soma Bay", "Louxor"];

export default function HotelsAValiderView() {
  const supabase = createClient();
  const [lignes, setLignes] = useState<HotelNonReference[] | null>(null);
  const [zoneChoisie, setZoneChoisie] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    supabase
      .from("hotels_non_references")
      .select("*")
      .eq("valide", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!annule) setLignes((data as HotelNonReference[]) || []);
      });
    return () => {
      annule = true;
    };
  }, [supabase]);

  async function ajouterAHotelsReference(ligne: HotelNonReference) {
    const ville = zoneChoisie[ligne.id] || ligne.zone_detectee;
    if (!ville || !ligne.nom.trim()) return;
    setEnCours(ligne.id);
    const { error } = await supabase.from("hotels_reference").insert({
      nom: ligne.nom.trim(),
      ville,
      sur_hurghada: ville === "Hurghada",
      latitude: ligne.latitude,
      longitude: ligne.longitude,
    });
    if (!error) {
      await supabase.from("hotels_non_references").update({ valide: true }).eq("id", ligne.id);
      setLignes((prev) => (prev || []).filter((l) => l.id !== ligne.id));
    }
    setEnCours(null);
  }

  async function ignorer(ligne: HotelNonReference) {
    setEnCours(ligne.id);
    await supabase.from("hotels_non_references").update({ valide: true }).eq("id", ligne.id);
    setLignes((prev) => (prev || []).filter((l) => l.id !== ligne.id));
    setEnCours(null);
  }

  if (lignes === null) {
    return <div className="p-4 sm:p-6 text-sm text-neutral-400">Chargement…</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#171717]">Hôtels à valider</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Hôtels saisis sur le site et absents de la base — la zone proposée est déduite
          automatiquement par proximité. Vérifiez puis ajoutez à la liste de référence : les
          prochains clients de cet hôtel n&apos;auront plus besoin de Google Places.
        </p>
      </div>

      {lignes.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun hôtel en attente de validation.</p>
      ) : (
        <div className="space-y-3">
          {lignes.map((l) => (
            <div key={l.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-semibold text-[#171717]">{l.nom || "Sans nom"}</div>
                <div className="text-xs text-neutral-400">
                  {new Date(l.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </div>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {l.zone_detectee ? (
                  <>
                    Zone détectée : <span className="font-medium">{l.zone_detectee}</span>
                    {l.distance_km !== null && ` (${l.distance_km.toFixed(1)} km de l'hôtel connu le plus proche)`}
                  </>
                ) : (
                  <span className="text-amber-700">
                    Détection échouée {l.distance_km !== null ? `(${l.distance_km.toFixed(1)} km — hors seuil)` : ""}
                    — choisissez la zone à la main.
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={zoneChoisie[l.id] ?? l.zone_detectee}
                  onChange={(e) => setZoneChoisie((z) => ({ ...z, [l.id]: e.target.value }))}
                  className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
                >
                  <option value="">Choisir une zone</option>
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
                <button
                  onClick={() => ajouterAHotelsReference(l)}
                  disabled={enCours === l.id || !(zoneChoisie[l.id] || l.zone_detectee)}
                  className="rounded-lg bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Ajouter à la liste de référence
                </button>
                <button
                  onClick={() => ignorer(l)}
                  disabled={enCours === l.id}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
                >
                  Ignorer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
