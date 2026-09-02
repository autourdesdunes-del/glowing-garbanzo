"use client";

import { useState } from "react";
import { CatalogueItem, Pack, PackSlot } from "@/lib/types";
import { Field } from "@/components/Field";

// Gestion des Packs (regroupements d'activités catalogue vendues ensemble
// à prix réduit, ex. PACK EXPLORATION) — liste + formulaire d'édition,
// même principe que la fiche catalogue classique mais avec des
// "emplacements" (slots) pointant vers 1 ou plusieurs activités
// alternatives ("OU") au lieu d'un tarif simple.
export default function PacksAdminView({
  packs,
  catalogue,
  onAdd,
  onUpdate,
  onDelete,
}: {
  packs: Pack[];
  catalogue: CatalogueItem[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pack>) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = packs.find((p) => p.id === selectedId) || null;

  const updateSlots = (pack: Pack, slots: PackSlot[]) => onUpdate(pack.id, { slots });

  const addSlot = (pack: Pack) => {
    const ordre = pack.slots.length ? Math.max(...pack.slots.map((s) => s.ordre)) + 1 : 1;
    updateSlots(pack, [...pack.slots, { ordre, catalogue_item_ids: [] }]);
  };

  const removeSlot = (pack: Pack, ordre: number) => {
    updateSlots(pack, pack.slots.filter((s) => s.ordre !== ordre));
  };

  const toggleSlotItem = (pack: Pack, ordre: number, itemId: string) => {
    updateSlots(
      pack,
      pack.slots.map((s) => {
        if (s.ordre !== ordre) return s;
        const present = s.catalogue_item_ids.includes(itemId);
        return {
          ...s,
          catalogue_item_ids: present
            ? s.catalogue_item_ids.filter((id) => id !== itemId)
            : [...s.catalogue_item_ids, itemId],
        };
      })
    );
  };

  if (selected) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <button
          onClick={() => setSelectedId(null)}
          className="text-sm font-medium text-[#666666] hover:text-[#171717]"
        >
          ‹ Retour aux packs
        </button>

        <Field label="Nom">
          <input
            value={selected.nom}
            onChange={(e) => onUpdate(selected.id, { nom: e.target.value })}
            className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={selected.description}
            onChange={(e) => onUpdate(selected.id, { description: e.target.value })}
            className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
            rows={2}
          />
        </Field>
        <Field label="Inclus (texte libre)">
          <textarea
            value={selected.inclus}
            onChange={(e) => onUpdate(selected.id, { inclus: e.target.value })}
            className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix adulte (€/pers)">
            <input
              type="number"
              value={selected.prix_adulte}
              onChange={(e) => onUpdate(selected.id, { prix_adulte: Number(e.target.value) || 0 })}
              className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Prix enfant (€/pers)">
            <input
              type="number"
              value={selected.prix_enfant}
              onChange={(e) => onUpdate(selected.id, { prix_enfant: Number(e.target.value) || 0 })}
              className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
            />
          </Field>
        </div>
        <Field label="Photo (URL)">
          <input
            value={selected.photo_path}
            onChange={(e) => onUpdate(selected.id, { photo_path: e.target.value })}
            className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.valide}
            onChange={(e) => onUpdate(selected.id, { valide: e.target.checked })}
          />
          Validé (proposable aux clients)
        </label>

        <div className="space-y-3 rounded-md border border-[#eaeaea] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#171717]">Emplacements (activités du pack)</span>
            <button
              onClick={() => addSlot(selected)}
              className="text-xs font-medium text-[#C9973E] hover:underline"
            >
              + Ajouter un emplacement
            </button>
          </div>
          {selected.slots.length === 0 && (
            <p className="text-xs text-[#666666]">Aucun emplacement — le pack ne créera aucune activité.</p>
          )}
          {selected.slots.map((slot) => (
            <div key={slot.ordre} className="rounded-md border border-[#eaeaea] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#171717]">
                  Emplacement {slot.ordre}
                  {slot.catalogue_item_ids.length > 1 ? " (choix \"OU\")" : ""}
                </span>
                <button
                  onClick={() => removeSlot(selected, slot.ordre)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {catalogue
                  .filter((c) => c.valide)
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={slot.catalogue_item_ids.includes(c.id)}
                        onChange={() => toggleSlotItem(selected, slot.ordre, c.id)}
                      />
                      {c.nom}
                      <span className="text-[#666666]">({c.pu_adulte}€)</span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setSelectedId(null);
            onDelete(selected.id);
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Supprimer ce pack
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-[#171717]">Packs</h2>
        <button
          onClick={onAdd}
          className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Nouveau pack
        </button>
      </div>
      {packs.length === 0 && <p className="text-sm text-[#666666]">Aucun pack pour le moment.</p>}
      {packs.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelectedId(p.id)}
          className="flex w-full items-center justify-between rounded-md border border-[#eaeaea] px-3 py-2 text-left hover:border-[#C9973E]"
        >
          <span>
            <span className="block text-sm font-medium text-[#171717]">{p.nom || "(sans nom)"}</span>
            <span className="block text-xs text-[#666666]">
              {p.slots.length} emplacement{p.slots.length > 1 ? "s" : ""} — {p.valide ? "Validé" : "Non validé"}
            </span>
          </span>
          <span className="whitespace-nowrap text-sm font-mono text-[#171717]">{p.prix_adulte}€/pers</span>
        </button>
      ))}
    </div>
  );
}
