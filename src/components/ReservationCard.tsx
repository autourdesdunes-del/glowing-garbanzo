"use client";

import { CatalogueItem, Client, Reservation, ReservationOption } from "@/lib/types";
import { MOMENTS, OPTIONS_PRESETS } from "@/lib/constants";
import { participantsFor, resaTotalMontant } from "@/lib/resa";
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
  expanded,
  onToggleExpanded,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onToggleSoldePaye,
  catalogue,
}: {
  r: Reservation;
  client: Client;
  options: ReservationOption[];
  expanded: boolean;
  onToggleExpanded: (v: boolean) => void;
  onUpdate: (patch: Partial<Reservation>) => void;
  onDelete: () => void;
  onAddOption: () => void;
  onUpdateOption: (optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (optId: string) => void;
  onToggleSoldePaye: () => void;
  catalogue: CatalogueItem[];
}) {
  const pickFromCatalogue = (id: string) => {
    const item = catalogue.find((a) => a.id === id);
    if (!item) return;
    onUpdate({
      nom_activite: item.nom,
      pu_adulte: item.pu_adulte,
      pu_enfant: item.pu_enfant,
      horaire_approx: item.horaire_approx,
      inclus: item.inclus,
      non_inclus: item.non_inclus,
      a_prevoir: item.a_prevoir,
      point_rdv: item.point_rdv,
    });
  };
  const { nbAd, nbEnf } = participantsFor(r, client);
  const total = resaTotalMontant(r, client, options);
  const soldeIci = client.solde_activite_id === r.id;
  const soldeLabel = soldeIci ? (client.solde_paye ? "Payé" : "À régler") : null;
  const hasOptions = options.length > 0;
  const hasInfo = !!r.info_importante;

  if (!expanded) {
    if (r.statut_resa === "Confirmée") {
      return (
        <div
          onClick={() => onToggleExpanded(true)}
          className="cursor-pointer rounded-md border border-[#0F5C56]/30 bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-[#0F5C56]">✓</span>
            <span className="font-medium text-[#5C2A1D]">
              {r.nom_activite || "Activité sans nom"}
            </span>
            <span className="flex-1" />
            <span className="font-amounts text-sm">{euros(total)} €</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {fmtDate(r.date_debut)}
            {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
          </p>
          {(soldeIci || hasOptions || hasInfo) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {soldeIci && (
                <span className="rounded-full bg-[#C9973E] px-2 py-0.5 text-xs text-white">
                  💰 Solde ici — {soldeLabel}
                </span>
              )}
              {hasOptions && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  ⚙ {options.map((o) => o.nom).join(", ")}
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
        className="cursor-pointer rounded-md border border-[#C9973E]/40 bg-white p-3"
      >
        <p className="font-medium text-[#5C2A1D]">
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
            <span className="rounded-full bg-[#C9973E] px-2 py-0.5 text-xs text-white">
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
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#8B4531]/20 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        {r.statut_resa === "Confirmée" ? (
          <span className="rounded-full bg-[#0F5C56] px-3 py-1 text-xs text-white">
            ✓ Confirmée
          </span>
        ) : (
          <span className="rounded-full bg-[#C9973E]/20 px-3 py-1 text-xs text-[#8B4531]">
            ✎ Brouillon — encore en cours de remplissage
          </span>
        )}
        <button
          onClick={() =>
            onUpdate({
              statut_resa: r.statut_resa === "Confirmée" ? "Brouillon" : "Confirmée",
            })
          }
          className="rounded-md bg-[#0F5C56] px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          {r.statut_resa === "Confirmée" ? "Repasser en brouillon" : "✓ Marquer comme confirmée"}
        </button>
      </div>

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
          className="text-xs text-[#5C2A1D] hover:underline"
        >
          Réduire
        </button>
      </div>

      {options.length > 0 && (
        <div className="mb-3 rounded-md bg-[#C9973E]/10 px-3 py-2 text-xs text-[#8B4531]">
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
        <Field label="Date fin (si plusieurs jours)">
          <input
            type="date"
            value={r.date_fin ?? ""}
            onChange={(e) => onUpdate({ date_fin: e.target.value || null })}
            className="input"
          />
        </Field>
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
        <Field label="Coût réel (interne)">
          <input
            type="number"
            value={r.cout_reel}
            onChange={(e) => onUpdate({ cout_reel: Number(e.target.value) })}
            className="input"
          />
        </Field>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Participants</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ participants_mode: "tous" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode === "tous"
                ? "border-[#0F5C56] bg-[#0F5C56] text-white"
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
                ? "border-[#C9973E] bg-[#C9973E] text-white"
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
          <Field label="PAX affiché (optionnel — ex. « 2 participants, 1 accompagnateur »)">
            <input
              placeholder="Laisser vide pour un calcul automatique"
              value={r.pax_override}
              onChange={(e) => onUpdate({ pax_override: e.target.value })}
              className="input"
            />
          </Field>
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
          className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
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
                ? "border-[#0F5C56] bg-[#0F5C56] text-white"
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
                ? "border-[#C9973E] bg-[#C9973E] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Taxe de transfert
          </button>
        </div>
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

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Horaire approximatif (interne — jamais montré au client)">
          <input
            value={r.horaire_approx}
            onChange={(e) => onUpdate({ horaire_approx: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Pick-up réel (confirmé la veille, visible client)">
          <input
            placeholder="Rempli par l'employée"
            value={r.pickup_reel}
            onChange={(e) => onUpdate({ pickup_reel: e.target.value })}
            className="input"
          />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Field label="Point de RDV">
          <input
            value={r.point_rdv}
            onChange={(e) => onUpdate({ point_rdv: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Inclus">
          <input
            value={r.inclus}
            onChange={(e) => onUpdate({ inclus: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Non inclus">
          <input
            value={r.non_inclus}
            onChange={(e) => onUpdate({ non_inclus: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="À prévoir">
          <input
            value={r.a_prevoir}
            onChange={(e) => onUpdate({ a_prevoir: e.target.value })}
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

      <div className="mt-4 flex items-center justify-between border-t border-[#8B4531]/10 pt-3 text-sm">
        <span>
          Total activité : <strong>{euros(total)} €</strong> ({nbAd} ad. + {nbEnf} enf.)
        </span>
        {soldeIci ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#C9973E] px-2 py-0.5 text-xs text-white">
              💰 Solde ici — {euros(client.solde_montant)} € — {soldeLabel}
            </span>
            <button
              onClick={onToggleSoldePaye}
              className="rounded-md bg-[#0F5C56] px-3 py-1 text-xs text-white hover:opacity-90"
            >
              {client.solde_paye ? "Annuler" : "Marquer le solde encaissé"}
            </button>
          </div>
        ) : (
          <span className="text-xs text-neutral-400">
            Le solde du séjour n&apos;est pas rattaché à cette activité (voir étape Paiements).
          </span>
        )}
      </div>
    </div>
  );
}
