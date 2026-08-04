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
  const [taxesExpanded, setTaxesExpanded] = useState(false);
  const [taxes, setTaxes] = useState<TransfertTaxe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newHotelNom, setNewHotelNom] = useState("");
  const [newHotelVille, setNewHotelVille] = useState("Hurghada");
  const [newHotelVilleAutre, setNewHotelVilleAutre] = useState("");
  const [newTaxeVille, setNewTaxeVille] = useState("");
  const [newTaxeMontant, setNewTaxeMontant] = useState(0);

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

  const addTaxe = async () => {
    if (!newTaxeVille.trim()) return;
    const { data, error } = await supabase
      .from("transfert_taxes")
      .insert({ ville: newTaxeVille.trim(), montant: newTaxeMontant })
      .select()
      .single();
    if (!error && data) {
      setTaxes((prev) => [...prev, data as TransfertTaxe].sort((a, b) => a.ville.localeCompare(b.ville)));
      setNewTaxeVille("");
      setNewTaxeMontant(0);
    } else {
      toast("Impossible d'ajouter cette ville (déjà présente ?).");
    }
  };

  const updateTaxe = async (id: string, patch: Partial<TransfertTaxe>) => {
    setTaxes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("transfert_taxes").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteTaxe = async (id: string) => {
    const ok = await confirm({ message: "Retirer cette ville ?", confirmLabel: "Retirer", danger: true });
    if (!ok) return;
    setTaxes((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("transfert_taxes").delete().eq("id", id);
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
              ? "border-[#5C2A1D] bg-[#5C2A1D] text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          Localisation des hôtels
        </button>
        <button
          onClick={() => setTab("taxes")}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            tab === "taxes"
              ? "border-[#5C2A1D] bg-[#5C2A1D] text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          Taxes de transfert
        </button>
      </div>

      {tab === "hotels" && (
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#5C2A1D]">
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
              className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
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
              <h3 className="mb-2 text-sm font-semibold text-[#8B4531]">{label}</h3>
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
                  className="mt-1.5 text-xs text-[#5C2A1D] hover:underline"
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
        <h2 className="font-heading text-lg font-semibold text-[#5C2A1D]">
          Taxes de transfert par ville
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Montant affiché en alerte quand un client loge hors Hurghada.
        </p>

        <div className="mt-4 space-y-2">
          {(taxesExpanded ? taxes : taxes.slice(0, 5)).map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-white p-3"
            >
              <input
                value={t.ville}
                onChange={(e) => updateTaxe(t.id, { ville: e.target.value })}
                className="input min-w-[160px] flex-1"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={t.montant}
                  onChange={(e) => updateTaxe(t.id, { montant: Number(e.target.value) })}
                  className="input w-28"
                />
                <span className="text-sm text-neutral-500">€</span>
              </div>
              <button
                onClick={() => deleteTaxe(t.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
        {taxes.length > 5 && (
          <button
            onClick={() => setTaxesExpanded((v) => !v)}
            className="mt-1.5 text-xs text-[#5C2A1D] hover:underline"
          >
            {taxesExpanded ? "Voir moins" : `Voir les ${taxes.length - 5} autres`}
          </button>
        )}

        <div className="mt-3 flex items-center gap-3 rounded-md border border-dashed border-neutral-300 p-3">
          <input
            value={newTaxeVille}
            onChange={(e) => setNewTaxeVille(e.target.value)}
            placeholder="Ville (ex. El Gouna)"
            className="input flex-1"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={newTaxeMontant}
              onChange={(e) => setNewTaxeMontant(Number(e.target.value))}
              className="input w-28"
            />
            <span className="text-sm text-neutral-500">€</span>
          </div>
          <button
            onClick={addTaxe}
            className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Ajouter
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
