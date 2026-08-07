"use client";

import { useState } from "react";
import {
  CatalogueItem,
  CatalogueTarif,
  Client,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { BILLET_STATUTS, MOMENTS, OPTIONS_PRESETS } from "@/lib/constants";
import { paiementStatutKey, participantsFor, resaTotalMontant, STATUT_PAIEMENT_OPTIONS } from "@/lib/resa";
import { Field } from "@/components/client-steps";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function ReservationCard({
  r,
  client,
  options,
  tarifs,
  expanded,
  onToggleExpanded,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onAddTarif,
  onUpdateTarif,
  onDeleteTarif,
  onUpdateClient,
  catalogue,
  catalogueTarifs,
  canSeeMargins,
  hotelHorsHurghada,
  coutReel,
  onUpdateCoutReel,
}: {
  r: Reservation;
  client: Client;
  options: ReservationOption[];
  tarifs: ReservationTarif[];
  expanded: boolean;
  onToggleExpanded: (v: boolean) => void;
  onUpdate: (patch: Partial<Reservation>) => void;
  onDelete: () => void;
  onAddOption: () => void;
  onUpdateOption: (optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (optId: string) => void;
  onAddTarif: (seed?: { label: string; pu: number }) => void;
  onUpdateTarif: (tarifId: string, patch: Partial<ReservationTarif>) => void;
  onDeleteTarif: (tarifId: string) => void;
  onUpdateClient: (patch: Partial<Client>) => void;
  catalogue: CatalogueItem[];
  catalogueTarifs: CatalogueTarif[];
  canSeeMargins: boolean;
  hotelHorsHurghada?: boolean;
  coutReel: number;
  onUpdateCoutReel: (value: number) => void;
}) {
  const [showPaxOverride, setShowPaxOverride] = useState(!!r.pax_override);
  const pickFromCatalogue = (id: string) => {
    const item = catalogue.find((a) => a.id === id);
    if (!item) return;
    onUpdate({
      nom_activite: item.nom,
      catalogue_item_id: item.id,
      pu_adulte: item.pu_adulte,
      pu_enfant: item.pu_enfant,
      horaire_approx: item.horaire_approx,
      inclus: (item.inclus_liste || []).join(", ") || item.inclus,
      non_inclus: item.non_inclus,
      a_prevoir: item.a_prevoir,
      point_rdv: item.point_rdv,
      photo_path: item.photo_path,
    });
  };
  const { nbAd, nbEnf } = participantsFor(r, client);
  const total = resaTotalMontant(r, client, options, tarifs);
  const soldeIci = client.solde_activite_id === r.id;
  const soldeLabel = soldeIci ? (client.solde_paye ? "Payé" : "À régler") : null;
  const statutKey = paiementStatutKey(client, r);
  const badge = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === statutKey)!;
  const hasOptions = options.length > 0;
  const hasInfo = !!r.info_importante;

  if (!expanded) {
    if (r.statut_resa === "Confirmée") {
      return (
        <div
          onClick={() => onToggleExpanded(true)}
          className="cursor-pointer rounded-md border border-[#171717]/30 bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[#171717]">✓</span>
            <span className="font-medium text-[#171717]">
              {r.nom_activite || "Activité sans nom"}
            </span>
            <span className="flex-1" />
            <span className="font-amounts text-sm">{euros(total)} €</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {fmtDate(r.date_debut)}
            {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
          </p>
          {(soldeIci || hasOptions || hasInfo || r.billet_requis) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {soldeIci && (
                <span className="rounded-full bg-[#f5a623] px-2 py-0.5 text-xs text-white">
                  💰 Solde ici — {soldeLabel}
                </span>
              )}
              {hasOptions && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  ⚙ {options.map((o) => o.nom).join(", ")}
                </span>
              )}
              {r.billet_requis && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  ✈ Billet — {r.billet_statut}
                </span>
              )}
            </div>
          )}
          {hasInfo && (
            <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
              ⚠ {r.info_importante}
            </div>
          )}
        </div>
      );
    }
    return (
      <div
        onClick={() => onToggleExpanded(true)}
        className="cursor-pointer rounded-md border border-[#f5a623]/40 bg-white p-3"
      >
        <p className="font-medium text-[#171717]">
          {r.nom_activite || "Activité sans nom"}
          {soldeIci && !client.solde_paye && (
            <span className="ml-2 text-xs text-red-600">⚠️ solde à régler ici</span>
          )}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {fmtDate(r.date_debut)}
          {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""} ·{" "}
          {r.moment}
          {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
        </p>
        {hasInfo && (
          <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
            ⚠ {r.info_importante}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          {soldeIci ? (
            <span className="rounded-full bg-[#f5a623] px-2 py-0.5 text-xs text-white">
              💰 Solde ici — {soldeLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="font-amounts text-sm">{euros(total)} €</span>
        </div>
        {hasOptions && (
          <span className="mt-1 block text-xs text-neutral-500">
            ⚙ {options.length} option(s) ajoutée(s)
          </span>
        )}
        {r.billet_requis && (
          <span className="mt-1 block text-xs text-neutral-500">
            ✈ Billet — {r.billet_statut}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#666666]/20 bg-white p-4">
      {catalogue.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) pickFromCatalogue(e.target.value);
            e.target.value = "";
          }}
          className="input mb-2"
        >
          <option value="">— Choisir dans le catalogue —</option>
          {catalogue.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          placeholder="Nom de l'activité"
          value={r.nom_activite}
          onChange={(e) => onUpdate({ nom_activite: e.target.value })}
          className="input flex-1"
        />
        <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
          Retirer
        </button>
        <button
          onClick={() => onToggleExpanded(false)}
          className="text-xs font-medium text-[#171717] hover:underline"
        >
          Valider
        </button>
      </div>

      {options.length > 0 && (
        <div className="mb-3 rounded-md bg-[#f5a623]/10 px-3 py-2 text-xs text-[#666666]">
          ⚠ Option(s) ajoutée(s) : {options.map((o) => o.nom).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date début">
          <input
            type="date"
            value={r.date_debut ?? ""}
            onChange={(e) => onUpdate({ date_debut: e.target.value || null })}
            className="input"
          />
        </Field>
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={!!r.date_fin}
              onChange={(e) =>
                onUpdate({ date_fin: e.target.checked ? r.date_debut || "" : null })
              }
            />
            Plusieurs jours
          </label>
          {r.date_fin && (
            <input
              type="date"
              value={r.date_fin}
              onChange={(e) => onUpdate({ date_fin: e.target.value || null })}
              className="input"
            />
          )}
        </div>
        <Field label="Moment">
          <select
            value={r.moment}
            onChange={(e) => onUpdate({ moment: e.target.value })}
            className="input"
          >
            {MOMENTS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="PU adulte (€)">
          <input
            type="number"
            value={r.pu_adulte}
            onChange={(e) => onUpdate({ pu_adulte: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="PU enfant (€)">
          <input
            type="number"
            value={r.pu_enfant}
            onChange={(e) => onUpdate({ pu_enfant: Number(e.target.value) })}
            className="input"
          />
        </Field>
        {canSeeMargins && (
          <Field label="Coût réel (interne)">
            <input
              type="number"
              value={coutReel}
              onChange={(e) => onUpdateCoutReel(Number(e.target.value))}
              className="input"
            />
          </Field>
        )}
      </div>

      <div className="mt-2">
        <p className="mb-1 text-xs font-medium text-neutral-500">
          PU supplémentaire (accompagnateur, passager, bébé…)
        </p>
        {tarifs.map((t) => (
          <div key={t.id} className="mb-2 flex flex-wrap items-center gap-2">
            <input
              placeholder="Ex. Accompagnateur"
              value={t.label}
              onChange={(e) => onUpdateTarif(t.id, { label: e.target.value })}
              className="input min-w-[160px] flex-1"
            />
            <input
              type="number"
              placeholder="PU €"
              value={t.pu}
              onChange={(e) => onUpdateTarif(t.id, { pu: Number(e.target.value) })}
              className="input w-24"
            />
            <span className="text-xs text-neutral-400">×</span>
            <input
              type="number"
              min={0}
              placeholder="Qté"
              value={t.quantite}
              onChange={(e) => onUpdateTarif(t.id, { quantite: Number(e.target.value) })}
              className="input w-16"
            />
            <span className="font-amounts w-20 text-right text-xs text-neutral-500">
              {euros((Number(t.quantite) || 0) * (Number(t.pu) || 0))} €
            </span>
            <button onClick={() => onDeleteTarif(t.id)} className="text-red-600">
              ✕
            </button>
          </div>
        ))}
        {catalogueTarifs
          .filter((ct) => !tarifs.some((t) => t.label === ct.label))
          .map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => onAddTarif({ label: ct.label, pu: ct.pu })}
              className="mb-2 mr-2 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
            >
              + {ct.label} ({euros(ct.pu)} €)
            </button>
          ))}
        <button
          type="button"
          onClick={() => onAddTarif()}
          className="text-xs text-[#171717] hover:underline"
        >
          + Ajouter un PU supplémentaire
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Participants</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ participants_mode: "tous" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode === "tous"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Tous ({client.adultes} ad. + {client.enfants} enf.)
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ participants_mode: "custom" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode === "custom"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Personnalisé
          </button>
        </div>
        {r.participants_mode === "custom" && (
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Field label="Adultes participants">
              <input
                type="number"
                value={r.participants_adultes}
                onChange={(e) => onUpdate({ participants_adultes: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Enfants participants">
              <input
                type="number"
                value={r.participants_enfants}
                onChange={(e) => onUpdate({ participants_enfants: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Noms">
              <input
                value={r.participants_noms}
                onChange={(e) => onUpdate({ participants_noms: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        )}
        <div className="mt-2">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={showPaxOverride}
              onChange={(e) => {
                setShowPaxOverride(e.target.checked);
                if (!e.target.checked) onUpdate({ pax_override: "" });
              }}
            />
            Écrire moi-même le texte affiché au lieu du calcul automatique
          </label>
          <p className="mb-1 text-xs text-neutral-400">
            Par défaut le nombre de participants ci-dessus est calculé automatiquement. Coche
            cette case seulement si tu veux le remplacer par un texte libre (ex. « 2
            participants, 1 accompagnateur »).
          </p>
          {showPaxOverride && (
            <input
              placeholder="Texte à afficher"
              value={r.pax_override}
              onChange={(e) => onUpdate({ pax_override: e.target.value })}
              className="input"
            />
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Options</p>
        {options.map((o) => (
          <div key={o.id} className="mb-2 flex items-center gap-2">
            <select
              value={OPTIONS_PRESETS.includes(o.nom as (typeof OPTIONS_PRESETS)[number]) ? o.nom : "Autre"}
              onChange={(e) =>
                onUpdateOption(o.id, { nom: e.target.value === "Autre" ? "" : e.target.value })
              }
              className="input"
            >
              {OPTIONS_PRESETS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {!OPTIONS_PRESETS.includes(o.nom as (typeof OPTIONS_PRESETS)[number]) && (
              <input
                placeholder="Préciser"
                value={o.nom}
                onChange={(e) => onUpdateOption(o.id, { nom: e.target.value })}
                className="input"
              />
            )}
            <input
              type="number"
              placeholder="Prix €"
              value={o.prix}
              onChange={(e) => onUpdateOption(o.id, { prix: Number(e.target.value) })}
              className="input"
            />
            <button onClick={() => onDeleteOption(o.id)} className="text-red-600">
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={onAddOption}
          className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Ajouter une option
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Transfert</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ transfert_inclus: true })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.transfert_inclus
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Transfert inclus
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ transfert_inclus: false })}
            className={`rounded-full border px-3 py-1 text-xs ${
              !r.transfert_inclus
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Taxe de transfert
          </button>
        </div>
        {hotelHorsHurghada && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-orange-50 px-2 py-1.5 text-xs text-orange-700">
            <span>⚠ N&apos;oubliez pas que cet hôtel n&apos;est pas sur Hurghada, il y a peut-être une taxe de transfert.</span>
            {r.transfert_inclus && (
              <button
                type="button"
                onClick={() => onUpdate({ transfert_inclus: false })}
                className="whitespace-nowrap rounded-md bg-orange-600 px-2 py-1 text-white hover:opacity-90"
              >
                Corriger
              </button>
            )}
          </div>
        )}
        {!r.transfert_inclus && (
          <div className="mt-2 max-w-[200px]">
            <Field label="Montant total (€)">
              <input
                type="number"
                value={r.transfert_montant}
                onChange={(e) => onUpdate({ transfert_montant: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-3">
        <Field label="Pick-up réel (confirmé la veille, visible client)">
          <input
            placeholder="Rempli par l'employée"
            value={r.pickup_reel}
            onChange={(e) => onUpdate({ pickup_reel: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Info importante pour l'équipe (encadré visible)">
          <textarea
            rows={2}
            value={r.info_importante}
            onChange={(e) => onUpdate({ info_importante: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <div className="mt-4 rounded-md border border-[#666666]/15 p-3">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={r.billet_requis}
            onChange={(e) => onUpdate({ billet_requis: e.target.checked })}
          />
          Cette activité inclut un billet d&apos;avion à gérer
        </label>

        {r.billet_requis && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Statut">
              <select
                value={r.billet_statut}
                onChange={(e) => onUpdate({ billet_statut: e.target.value })}
                className="input"
              >
                {BILLET_STATUTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Date du billet">
              <input
                type="date"
                value={r.billet_date ?? ""}
                onChange={(e) => onUpdate({ billet_date: e.target.value || null })}
                className="input"
              />
            </Field>
            <Field label="Acompte billet payé">
              <select
                value={r.billet_acompte_paye ? "Oui" : "Non"}
                onChange={(e) => onUpdate({ billet_acompte_paye: e.target.value === "Oui" })}
                className="input"
              >
                <option>Non</option>
                <option>Oui</option>
              </select>
            </Field>
            <Field label="Billet envoyé au client">
              <select
                value={r.billet_envoye ? "Oui" : "Non"}
                onChange={(e) => onUpdate({ billet_envoye: e.target.value === "Oui" })}
                className="input"
              >
                <option>Non</option>
                <option>Oui</option>
              </select>
            </Field>
            <Field label="Lien billet (Drive)">
              <input
                value={r.billet_lien}
                onChange={(e) => onUpdate({ billet_lien: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Notes pour Hossam">
              <input
                value={r.billet_notes}
                onChange={(e) => onUpdate({ billet_notes: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-[#666666]/10 pt-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>
            Total activité : <strong>{euros(total)} €</strong>
          </span>
          <select
            value={statutKey}
            onChange={(e) => {
              const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === e.target.value);
              if (opt) onUpdateClient(opt.patch(r));
            }}
            className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${badge.className}`}
          >
            {STATUT_PAIEMENT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
