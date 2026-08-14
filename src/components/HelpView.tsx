"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HotelReference, TransfertTaxe } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

const VILLES = [
  "Hurghada",
  "El Gouna",
  "Makadi Bay",
  "Soma Bay",
  "Sahl Hasheesh",
  "Marsa Alam",
  "Le Caire",
  "Louxor",
  "Assouan",
  "Autre",
];

export default function HelpView() {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [hotels, setHotels] = useState<HotelReference[]>([]);
  const [hotelSearch, setHotelSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [taxes, setTaxes] = useState<TransfertTaxe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newHotelNom, setNewHotelNom] = useState("");
  const [newHotelVille, setNewHotelVille] = useState("Hurghada");
  const [newHotelVilleAutre, setNewHotelVilleAutre] = useState("");
  const [taxesOuvertes, setTaxesOuvertes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: t }] = await Promise.all([
        supabase.from("hotels_reference").select("*").order("nom", { ascending: true }),
        supabase.from("transfert_taxes").select("*").order("ville", { ascending: true }),
      ]);
      setHotels((h as HotelReference[]) || []);
      setTaxes((t as TransfertTaxe[]) || []);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addHotel = async () => {
    if (!newHotelNom.trim()) return;
    const ville = newHotelVille === "Autre" ? newHotelVilleAutre.trim() : newHotelVille;
    if (!ville) return;
    const { data, error } = await supabase
      .from("hotels_reference")
      .insert({
        nom: newHotelNom.trim(),
        ville,
        sur_hurghada: ville === "Hurghada",
      })
      .select()
      .single();
    if (!error && data) {
      setHotels((prev) => [...prev, data as HotelReference].sort((a, b) => a.nom.localeCompare(b.nom)));
      setNewHotelNom("");
      setNewHotelVille("Hurghada");
      setNewHotelVilleAutre("");
    } else {
      toast("Impossible d'ajouter cet hôtel (déjà présent ?).");
    }
  };

  const deleteHotel = async (id: string) => {
    const ok = await confirm({ message: "Retirer cet hôtel de la référence ?", confirmLabel: "Retirer", danger: true });
    if (!ok) return;
    setHotels((prev) => prev.filter((h) => h.id !== id));
    const { error } = await supabase.from("hotels_reference").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const [tab, setTab] = useState<"hotels" | "taxes">("hotels");

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("hotels")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            tab === "hotels"
              ? "border-[#171717] bg-[#171717] text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          Localisation des hôtels
        </button>
        <button
          onClick={() => setTab("taxes")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            tab === "taxes"
              ? "border-[#171717] bg-[#171717] text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          Taxes de transfert
        </button>
      </div>

      {tab === "hotels" && (
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">
          Hôtels — sur Hurghada ou non
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Sert à détecter automatiquement, dans la fiche client, si une taxe de transfert
          s&apos;applique (hors Hurghada : El Gouna, Makadi, Soma Bay…).
        </p>

        <input
          value={hotelSearch}
          onChange={(e) => setHotelSearch(e.target.value)}
          placeholder="Rechercher un hôtel ou une ville…"
          className="input mt-4"
        />

        <div className="mt-4 rounded-md border border-dashed border-neutral-300 p-3">
          <p className="mb-2 text-sm font-medium text-neutral-700">Ajouter un hôtel</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={newHotelNom}
              onChange={(e) => setNewHotelNom(e.target.value)}
              placeholder="Nom de l'hôtel"
              className="input min-w-[200px] flex-1"
            />
            <select
              value={newHotelVille}
              onChange={(e) => setNewHotelVille(e.target.value)}
              className="input w-40"
            >
              {VILLES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            {newHotelVille === "Autre" && (
              <input
                value={newHotelVilleAutre}
                onChange={(e) => setNewHotelVilleAutre(e.target.value)}
                placeholder="Nom de la ville"
                className="input w-40"
              />
            )}
            <button
              onClick={addHotel}
              className="whitespace-nowrap rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              + Ajouter
            </button>
          </div>
        </div>

        {[
          { key: true, label: "Sans taxe (Hurghada)" },
          { key: false, label: "Hôtels avec taxe de transfert" },
        ].map(({ key, label }) => {
          const list = hotels
            .filter((h) => h.sur_hurghada === key)
            .filter((h) => {
              const q = hotelSearch.trim().toLowerCase();
              return !q || h.nom.toLowerCase().includes(q) || h.ville.toLowerCase().includes(q);
            })
            .sort((a, b) => a.nom.localeCompare(b.nom));
          if (list.length === 0) return null;
          const expanded = expandedGroups[label] || false;
          const shown = expanded ? list : list.slice(0, 5);
          return (
            <div key={label} className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-[#666666]">{label}</h3>
              <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
                {shown.map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-neutral-700">
                      {h.nom} <span className="text-neutral-400">— {h.ville}</span>
                    </span>
                    <button
                      onClick={() => deleteHotel(h.id)}
                      className="flex-shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
              {list.length > 5 && (
                <button
                  onClick={() => setExpandedGroups((prev) => ({ ...prev, [label]: !expanded }))}
                  className="mt-1.5 text-xs text-[#171717] hover:underline"
                >
                  {expanded ? "Voir moins" : `Voir les ${list.length - 5} autres`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

      {tab === "taxes" && (
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">
          🏦 Taxes de transfert
        </h2>
        <p className="mt-2 rounded-md bg-[#C9973E]/10 p-3 text-sm text-[#8B4531]">
          Si une personne est seule, faire une demande pour connaître le montant de la taxe.
        </p>
        <p className="mt-3 text-xs text-neutral-400">
          Référence uniquement — non modifiable ici. Pour un changement, voir directement avec Mélanie.
        </p>

        {Array.from(new Set(taxes.map((t) => t.ville))).map((ville) => {
          const tranches = taxes
            .filter((t) => t.ville === ville && t.montant !== null)
            .sort((a, b) => a.ordre - b.ordre);
          if (tranches.length === 0) return null;
          const ouvert = taxesOuvertes[ville] ?? false;
          const noteZone = tranches.map((t) => t.note).find((n) => n.trim());
          return (
            <div key={ville} className="mt-3 rounded-md border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => setTaxesOuvertes((prev) => ({ ...prev, [ville]: !ouvert }))}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-[#171717]"
              >
                <span>📍{ville.toUpperCase()}</span>
                <span className="text-neutral-400">{ouvert ? "▲" : "▼"}</span>
              </button>
              {ouvert && (
                <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                  {noteZone && <p className="text-xs italic text-neutral-400">{noteZone}</p>}
                  <ul className="space-y-3 text-sm text-neutral-700">
                    {tranches.map((t) => (
                      <li key={t.id}>
                        {t.label.split("\n").map((ligne, i) => (
                          <p key={i}>{ligne}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
