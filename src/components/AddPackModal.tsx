"use client";

import { useState } from "react";
import { CatalogueItem, Pack, Reservation } from "@/lib/types";
import { packSlotPrix } from "@/lib/resa";
import { todayStr } from "@/lib/dates";
import { Field } from "@/components/Field";
import { useToast } from "@/components/ToastProvider";

// Ajoute d'un coup toutes les activités d'un Pack (ex. PACK EXPLORATION :
// Caire ou Louxor + Maison des dauphins + Safari) à un client — une carte
// par activité, chacune avec sa propre date et sa propre part du prix pack
// (calculée au prorata, voir packSlotPrix), pour qu'une annulation
// individuelle plus tard se comporte comme une réservation normale.
export default function AddPackModal({
  catalogue,
  packs,
  onAddReservation,
  onUpdateReservation,
  onClose,
}: {
  catalogue: CatalogueItem[];
  packs: Pack[];
  onAddReservation: (opts?: { skipAvoirPrompt?: boolean }) => Promise<string | null>;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [packId, setPackId] = useState<string | null>(null);
  const [choix, setChoix] = useState<Record<number, string>>({});
  const [dates, setDates] = useState<Record<number, string>>({});
  const [adultes, setAdultes] = useState(2);
  const [enfants, setEnfants] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const pack = packs.find((p) => p.id === packId) || null;
  const itemById = (id: string) => catalogue.find((c) => c.id === id) || null;

  const choisir = (p: Pack) => {
    setPackId(p.id);
    const initChoix: Record<number, string> = {};
    const initDates: Record<number, string> = {};
    for (const slot of p.slots) {
      if (slot.catalogue_item_ids.length === 1) initChoix[slot.ordre] = slot.catalogue_item_ids[0];
      initDates[slot.ordre] = todayStr();
    }
    setChoix(initChoix);
    setDates(initDates);
  };

  const pretAConfirmer =
    !!pack &&
    pack.slots.every((slot) => choix[slot.ordre] && dates[slot.ordre]) &&
    (adultes > 0 || enfants > 0);

  const confirmer = async () => {
    if (!pack || !pretAConfirmer) return;
    setSubmitting(true);
    const itemsChoisis = pack.slots
      .map((slot) => itemById(choix[slot.ordre]))
      .filter((i): i is CatalogueItem => !!i);
    const prix = packSlotPrix(pack, itemsChoisis);
    for (const slot of pack.slots) {
      const item = itemById(choix[slot.ordre]);
      if (!item) continue;
      const p = prix.find((x) => x.itemId === item.id);
      const id = await onAddReservation();
      if (!id) {
        toast("Échec de la création d'une des activités du pack.");
        continue;
      }
      onUpdateReservation(id, {
        nom_activite: item.nom,
        catalogue_item_id: item.id,
        pack_id: pack.id,
        pack_nom: pack.nom,
        date_debut: dates[slot.ordre],
        moment: "Journée",
        tarif_mode: "personne",
        pu_adulte: p?.pu_adulte ?? 0,
        pu_enfant: p?.pu_enfant ?? 0,
        participants_mode: "custom",
        participants_adultes: adultes,
        participants_enfants: enfants,
        inclus: (item.inclus_liste || []).join(", ") || item.inclus,
        non_inclus: item.non_inclus,
        a_prevoir: item.a_prevoir,
        point_rdv: item.point_rdv,
        photo_path: item.photo_path,
      });
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[#eaeaea] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-[#171717]">
            {pack ? pack.nom : "Ajouter un pack"}
          </h2>
          <button type="button" onClick={onClose} className="text-[#666666] hover:text-[#171717]">
            ✕
          </button>
        </div>

        {!pack && (
          <div className="space-y-2">
            {packs
              .filter((p) => p.valide)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => choisir(p)}
                  className="flex w-full items-start justify-between rounded-md border border-[#eaeaea] px-3 py-2 text-left hover:border-[#C9973E]"
                >
                  <span>
                    <span className="block text-sm font-medium text-[#171717]">{p.nom}</span>
                    <span className="block text-xs text-[#666666]">{p.slots.length} activités</span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-mono text-[#171717]">
                    {p.prix_adulte}€/pers
                  </span>
                </button>
              ))}
            {packs.filter((p) => p.valide).length === 0 && (
              <p className="text-sm text-[#666666]">Aucun pack validé au catalogue.</p>
            )}
          </div>
        )}

        {pack && (
          <div className="space-y-4">
            {pack.description && <p className="text-sm text-[#666666]">{pack.description}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Adultes">
                <input
                  type="number"
                  min={0}
                  value={adultes}
                  onChange={(e) => setAdultes(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
                />
              </Field>
              <Field label="Enfants">
                <input
                  type="number"
                  min={0}
                  value={enfants}
                  onChange={(e) => setEnfants(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
                />
              </Field>
            </div>

            {pack.slots.map((slot) => (
              <div key={slot.ordre} className="rounded-md border border-[#eaeaea] p-3">
                {slot.catalogue_item_ids.length > 1 ? (
                  <div className="space-y-1.5">
                    <span className="block text-sm font-medium text-[#171717]">Choix {slot.ordre}</span>
                    {slot.catalogue_item_ids.map((cid) => {
                      const item = itemById(cid);
                      if (!item) return null;
                      return (
                        <label key={cid} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`slot-${slot.ordre}`}
                            checked={choix[slot.ordre] === cid}
                            onChange={() => setChoix((prev) => ({ ...prev, [slot.ordre]: cid }))}
                          />
                          {item.nom}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <span className="block text-sm font-medium text-[#171717]">
                    {itemById(slot.catalogue_item_ids[0])?.nom || "Activité introuvable"}
                  </span>
                )}
                <div className="mt-2">
                  <Field label="Date">
                    <input
                      type="date"
                      value={dates[slot.ordre] || ""}
                      onChange={(e) => setDates((prev) => ({ ...prev, [slot.ordre]: e.target.value }))}
                      className="w-full rounded-md border border-[#eaeaea] px-2 py-1.5 text-sm"
                    />
                  </Field>
                </div>
              </div>
            ))}

            <div className="flex justify-between gap-2">
              <button
                onClick={() => setPackId(null)}
                className="rounded-md border border-[#eaeaea] px-3 py-1.5 text-sm font-medium text-[#666666] hover:text-[#171717]"
              >
                ‹ Changer de pack
              </button>
              <button
                onClick={confirmer}
                disabled={!pretAConfirmer || submitting}
                className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Ajout en cours…" : `Ajouter les ${pack.slots.length} activités`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
