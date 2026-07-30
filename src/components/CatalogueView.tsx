"use client";

import { useState } from "react";
import { CatalogueItem } from "@/lib/types";
import { CATALOGUE_CATEGORIES } from "@/lib/constants";
import { Field } from "@/components/client-steps";
import PhotoUpload from "@/components/PhotoUpload";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export default function CatalogueView({
  items,
  onAdd,
  onUpdate,
  onDelete,
  canSeeMargins,
}: {
  items: CatalogueItem[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CatalogueItem>) => void;
  onDelete: (id: string) => void;
  canSeeMargins: boolean;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("Toutes");
  const filtered =
    categoryFilter === "Toutes" ? items : items.filter((a) => a.categorie === categoryFilter);

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">
            Catalogue d&apos;activités
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Rempli une fois, réutilisé pour chaque réservation — pré-remplit prix, horaires,
            inclus/non inclus.
          </p>
        </div>
        <button
          onClick={onAdd}
          className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Nouvelle activité
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["Toutes", ...CATALOGUE_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              categoryFilter === cat
                ? "border-[#5C2A1D] bg-[#5C2A1D] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-neutral-400">
          Aucune activité dans cette catégorie pour l&apos;instant.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((a) =>
          a.valide ? (
            <div
              key={a.id}
              onClick={() => onUpdate(a.id, { valide: false })}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-[#5C2A1D]/30 bg-white p-3"
            >
              <span className="text-[#5C2A1D]">✓</span>
              <span className="font-medium text-[#5C2A1D]">{a.nom || "Sans nom"}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                {a.categorie}
              </span>
              <span className="text-xs text-neutral-500">
                {a.disponibilites || "Disponibilités ?"}
              </span>
              <span className="flex-1" />
              <span className="font-amounts text-xs text-neutral-600">
                Ad. {euros(a.pu_adulte)}€ · Enf. {euros(a.pu_enfant)}€ · Bébé {euros(a.pu_bebe)}€
              </span>
            </div>
          ) : (
            <div key={a.id} className="rounded-md border border-[#C9973E]/40 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-[#C9973E]/20 px-3 py-1 text-xs text-[#8B4531]">
                  ✎ Brouillon
                </span>
                <button
                  onClick={() => onUpdate(a.id, { valide: true })}
                  className="rounded-md bg-[#5C2A1D] px-3 py-1.5 text-sm text-white hover:opacity-90"
                >
                  ✓ Valider cette activité
                </button>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  placeholder="Nom de l'activité"
                  value={a.nom}
                  onChange={(e) => onUpdate(a.id, { nom: e.target.value })}
                  className="input flex-1"
                />
                <button
                  onClick={() => onDelete(a.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Catégorie">
                  <select
                    value={a.categorie}
                    onChange={(e) => onUpdate(a.id, { categorie: e.target.value })}
                    className="input"
                  >
                    {CATALOGUE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Disponibilités">
                  <input
                    placeholder="ex. tous les jours, sauf vendredi"
                    value={a.disponibilites}
                    onChange={(e) => onUpdate(a.id, { disponibilites: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="PU adulte (€)">
                  <input
                    type="number"
                    value={a.pu_adulte}
                    onChange={(e) => onUpdate(a.id, { pu_adulte: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
                <Field label="PU enfant (€)">
                  <input
                    type="number"
                    value={a.pu_enfant}
                    onChange={(e) => onUpdate(a.id, { pu_enfant: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
                <Field label="PU bébé (€)">
                  <input
                    type="number"
                    value={a.pu_bebe}
                    onChange={(e) => onUpdate(a.id, { pu_bebe: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
                {canSeeMargins && (
                  <Field label="Marge cible (%)">
                    <input
                      type="number"
                      value={a.marge_pct}
                      onChange={(e) => onUpdate(a.id, { marge_pct: Number(e.target.value) })}
                      className="input"
                    />
                  </Field>
                )}
                <Field label="Horaire approximatif">
                  <input
                    value={a.horaire_approx}
                    onChange={(e) => onUpdate(a.id, { horaire_approx: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Point de RDV">
                  <input
                    value={a.point_rdv}
                    onChange={(e) => onUpdate(a.id, { point_rdv: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Inclus">
                  <input
                    value={a.inclus}
                    onChange={(e) => onUpdate(a.id, { inclus: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Non inclus">
                  <input
                    value={a.non_inclus}
                    onChange={(e) => onUpdate(a.id, { non_inclus: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="À prévoir">
                  <input
                    value={a.a_prevoir}
                    onChange={(e) => onUpdate(a.id, { a_prevoir: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <PhotoUpload
                  path={a.photo_path}
                  onPathChange={(photo_path) => onUpdate(a.id, { photo_path })}
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
