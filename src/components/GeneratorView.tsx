"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDDMonth(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${capitalize(d.toLocaleDateString("fr-FR", { month: "long" }))}`;
}

function moisLabelFromDates(dates: string[]) {
  const mois = Array.from(
    new Set(
      dates
        .filter(Boolean)
        .map((d) => capitalize(new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { month: "long" })))
    )
  );
  return mois.join(" - ");
}

let ligneSeq = 0;
function nextLigneId() {
  ligneSeq += 1;
  return `l${ligneSeq}`;
}

type Ligne = {
  id: string;
  catalogueItemId: string;
  nom: string;
  date: string;
  prixParPersonne: number;
  nbPersonnes: number;
  remise: number;
  remiseLabel: string;
};

// Construit le message texte envoyé au client tel quel (copié-collé
// WhatsApp) — le format a été fourni par Mélanie et ne doit pas être
// réinterprété : "📍date / nom / prix par personne (N) / [remise] /
// ➡️Total". Un seul bloc par activité, dans l'ordre chronologique.
function buildProgrammeText(moisLabel: string, nbPersonnes: number, hotel: string, lignes: Ligne[]) {
  const parts: string[] = [];
  parts.push("Voici ce que nous pouvons vous proposer si vous souhaitez réaliser ces activités :");
  parts.push("");
  parts.push(`Séjour ${moisLabel || "—"} :`);
  parts.push(`${nbPersonnes} personnes`);
  if (hotel) parts.push(hotel);

  const sorted = [...lignes]
    .filter((l) => l.nom.trim())
    .sort((a, b) => (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99"));

  sorted.forEach((l) => {
    const total = Math.max(l.prixParPersonne * l.nbPersonnes - (l.remise || 0), 0);
    parts.push("");
    parts.push(`📍${fmtDDMonth(l.date) || "Date à définir"}`);
    parts.push(l.nom);
    parts.push(`${euros(l.prixParPersonne)} euros par personne (${l.nbPersonnes})`);
    if (l.remise > 0) parts.push(`Remise -${euros(l.remise)} euros (${l.remiseLabel || "geste commercial"})`);
    parts.push(`➡️Total : ${euros(total)} euros`);
  });

  return parts.join("\n");
}

export default function GeneratorView({
  catalogue,
  clients,
}: {
  catalogue: CatalogueItem[];
  clients: Client[];
}) {
  const supabase = createClient();
  const toast = useToast();

  const [targetClientId, setTargetClientId] = useState("");
  const [moisLabelOverride, setMoisLabelOverride] = useState("");
  const [nbPersonnes, setNbPersonnes] = useState(2);
  const [hotel, setHotel] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [picker, setPicker] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const applyClient = (clientId: string) => {
    setTargetClientId(clientId);
    const c = clients.find((cl) => cl.id === clientId);
    if (!c) return;
    setHotel(c.hotel || "");
    setNbPersonnes((c.adultes || 0) + (c.enfants || 0) || 2);
  };

  const addLigne = (catalogueItemId: string) => {
    const item = catalogue.find((a) => a.id === catalogueItemId);
    if (!item) return;
    setLignes((prev) => [
      ...prev,
      {
        id: nextLigneId(),
        catalogueItemId: item.id,
        nom: item.nom,
        date: "",
        prixParPersonne: item.pu_adulte || 0,
        nbPersonnes,
        remise: 0,
        remiseLabel: "",
      },
    ]);
    setPicker("");
  };

  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLigne = (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  };

  const moisLabel = moisLabelOverride || moisLabelFromDates(lignes.map((l) => l.date));
  const texte = useMemo(
    () => buildProgrammeText(moisLabel, nbPersonnes, hotel, lignes),
    [moisLabel, nbPersonnes, hotel, lignes]
  );

  const totalGeneral = lignes.reduce(
    (s, l) => s + Math.max(l.prixParPersonne * l.nbPersonnes - (l.remise || 0), 0),
    0
  );

  const copyTexte = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };

  const addToClient = async () => {
    if (!targetClientId) {
      toast("Choisis un client pour y ajouter ces activités.");
      return;
    }
    if (lignes.length === 0) {
      toast("Ajoute au moins une activité au programme.");
      return;
    }
    setSaving(true);
    for (const l of lignes) {
      const item = catalogue.find((a) => a.id === l.catalogueItemId);
      // La remise éventuelle est répercutée sur le prix unitaire pour que
      // le total de la réservation (toujours calculé, jamais saisi à la
      // main — règle métier) reste cohérent avec le total annoncé au client.
      const puEffectif = l.remise > 0 ? Math.max(l.prixParPersonne - l.remise / Math.max(l.nbPersonnes, 1), 0) : l.prixParPersonne;
      const { error } = await supabase.from("reservations").insert({
        client_id: targetClientId,
        nom_activite: l.nom,
        catalogue_item_id: l.catalogueItemId || null,
        pu_adulte: puEffectif,
        participants_mode: "custom",
        pax_override: `${l.nbPersonnes} personnes`,
        horaire_approx: item?.horaire_approx || "",
        inclus: (item?.inclus_liste || []).join(", ") || item?.inclus || "",
        non_inclus: (item?.non_inclus_liste || []).join(", ") || item?.non_inclus || "",
        a_prevoir: (item?.a_prevoir_liste || []).join(", ") || item?.a_prevoir || "",
        point_rdv: item?.point_rdv || "",
        photo_path: item?.photo_path || "",
        date_debut: l.date || null,
      });
      if (error) {
        toast("Échec de l'ajout d'une activité.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast(`${lignes.length} activité(s) ajoutée(s) au dossier.`, "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Générateur de programme</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Compose le programme d&apos;activités proposé au client — le message à copier-coller se génère
          automatiquement à droite au fur et à mesure.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Client (optionnel — préremplit hôtel et nombre de personnes)
            <select
              value={targetClientId}
              onChange={(e) => applyClient(e.target.value)}
              className="input mt-1"
            >
              <option value="">— Aucun —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom || "Sans nom"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            Mois affiché (ex. Août)
            <input
              type="text"
              value={moisLabelOverride}
              onChange={(e) => setMoisLabelOverride(e.target.value)}
              placeholder={moisLabelFromDates(lignes.map((l) => l.date)) || "Auto"}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Nombre de personnes
            <input
              type="number"
              min={0}
              value={nbPersonnes}
              onChange={(e) => setNbPersonnes(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500">
            Hôtel
            <input
              type="text"
              value={hotel}
              onChange={(e) => setHotel(e.target.value)}
              placeholder="Nom de l'hôtel"
              className="input mt-1"
            />
          </label>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <label className="text-xs text-neutral-500">
          + Ajouter une activité au programme
          <select value={picker} onChange={(e) => addLigne(e.target.value)} className="input mt-1">
            <option value="">— Choisir dans le catalogue —</option>
            {catalogue
              .filter((a) => a.valide)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
          </select>
        </label>

        {lignes.length > 0 && (
          <div className="mt-3 space-y-2">
            {lignes.map((l) => (
              <div key={l.id} className="rounded-md border border-neutral-200 p-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={l.nom}
                    onChange={(e) => updateLigne(l.id, { nom: e.target.value })}
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLigne(l.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-[11px] text-neutral-500">
                    Date
                    <input
                      type="date"
                      value={l.date}
                      onChange={(e) => updateLigne(l.id, { date: e.target.value })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Prix / personne (€)
                    <input
                      type="number"
                      min={0}
                      value={l.prixParPersonne}
                      onChange={(e) => updateLigne(l.id, { prixParPersonne: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Nb personnes (ligne)
                    <input
                      type="number"
                      min={0}
                      value={l.nbPersonnes}
                      onChange={(e) => updateLigne(l.id, { nbPersonnes: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Remise (€)
                    <input
                      type="number"
                      min={0}
                      value={l.remise}
                      onChange={(e) => updateLigne(l.id, { remise: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                </div>
                {l.remise > 0 && (
                  <label className="mt-2 block text-[11px] text-neutral-500">
                    Motif de la remise
                    <input
                      type="text"
                      value={l.remiseLabel}
                      onChange={(e) => updateLigne(l.id, { remiseLabel: e.target.value })}
                      placeholder="geste commercial"
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Message à envoyer au client</p>
            <span className="rounded-full bg-[#0F5C56]/10 px-2.5 py-1 text-xs font-medium text-[#0F5C56]">
              Total : {euros(totalGeneral)}€
            </span>
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 font-sans text-sm text-[#171717]">
            {texte}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyTexte}
              className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {copied ? "Copié ✓" : "Copier le message"}
            </button>
            <select
              value={targetClientId}
              onChange={(e) => setTargetClientId(e.target.value)}
              className="input min-w-[200px] flex-1"
            >
              <option value="">Ajouter au dossier de…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom || "Sans nom"}
                </option>
              ))}
            </select>
            <button
              onClick={addToClient}
              disabled={saving}
              className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Ajout…" : `Ajouter ${lignes.length} activité(s) au dossier`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
