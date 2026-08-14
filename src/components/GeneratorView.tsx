"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client } from "@/lib/types";
import { normalizeJoursDisponibles } from "@/lib/resa";
import { PROSPECT_STATUTS } from "@/lib/constants";
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

const WEEKDAY_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function datesInRange(debut: string, fin: string): string[] {
  const dates: string[] = [];
  if (!debut || !fin) return dates;
  const d = new Date(debut + "T00:00:00");
  const end = new Date(fin + "T00:00:00");
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Âges libres saisis par l'employée ou déduits de Kommo (ex. "6, 9 et 14
// ans") — on n'en tire que les nombres, jamais de logique métier plus fine
// (aucun champ structuré d'âge minimum n'existe sur le catalogue).
function extractAges(text: string): number[] {
  const matches = text.match(/\d{1,2}/g);
  return matches ? matches.map(Number) : [];
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

// Le générateur propose un premier jet de programme à la place de
// l'employée — il ne remplace jamais sa décision finale (tout reste
// modifiable/supprimable avant envoi), mais lui évite de rouvrir le
// catalogue entier à chaque prospect.
function suggererProgramme({
  catalogue,
  dateDebut,
  dateFin,
  nbAdultes,
  nbEnfants,
  agesEnfants,
  interets,
}: {
  catalogue: CatalogueItem[];
  dateDebut: string;
  dateFin: string;
  nbAdultes: number;
  nbEnfants: number;
  agesEnfants: string;
  interets: string;
}): Ligne[] {
  const nbPersonnes = nbAdultes + nbEnfants;
  const ages = extractAges(agesEnfants);
  const hasAdos = ages.some((a) => a >= 12 && a <= 17);
  const hasJeunesEnfants = ages.some((a) => a < 12) || (nbEnfants > 0 && ages.length === 0);
  const hasEnfants = nbEnfants > 0;

  const motsCles = interets
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  const jours = datesInRange(dateDebut, dateFin);
  const joursSemaineDispo = new Set(jours.map((d) => WEEKDAY_FR[new Date(d + "T00:00:00").getDay()]));

  const matchInteret = (item: CatalogueItem) => {
    if (motsCles.length === 0) return false;
    const hay = [item.nom, item.categorie, ...(item.tags || [])].join(" ").toLowerCase();
    return motsCles.some((m) => hay.includes(m) || m.includes(item.nom.toLowerCase()));
  };

  const candidats = catalogue
    .filter((a) => a.valide)
    .filter((a) => a.categorie !== "Transfert")
    .map((item) => {
      const joursItem = normalizeJoursDisponibles(item.jours_disponibles);
      const disponibleSurSejour =
        joursItem.length === 0 || jours.length === 0 || joursItem.some((j) => joursSemaineDispo.has(j));
      const enfantsFriendly = (item.tags || []).includes("Enfants");

      let score = (item.marge_pct || 0) * 0.5;
      if (matchInteret(item)) score += 50;
      if (hasJeunesEnfants && enfantsFriendly) score += 20;
      if (hasJeunesEnfants && !enfantsFriendly && item.pu_enfant === 0 && item.pu_adulte > 0) score -= 15;
      if (hasAdos && (item.categorie === "Excursion" || item.categorie === "Séjour multi-jours")) score += 5;

      const prixParPersonne = item.pu_adulte || 0;

      return { item, score, disponibleSurSejour, joursItem, prixParPersonne };
    })
    .filter((c) => c.disponibleSurSejour)
    .sort((a, b) => b.score - a.score);

  const nbNuits = jours.length > 0 ? jours.length - 1 : 0;
  const cible = jours.length > 0 ? Math.min(6, Math.max(2, Math.round(nbNuits / 2))) : 4;

  const used = new Set<string>();
  const lignes: Ligne[] = [];
  for (const c of candidats) {
    if (lignes.length >= cible) break;
    let date = "";
    if (jours.length > 0) {
      const jourLibre = jours.find((d) => {
        if (used.has(d)) return false;
        if (c.joursItem.length === 0) return true;
        return c.joursItem.includes(WEEKDAY_FR[new Date(d + "T00:00:00").getDay()]);
      });
      if (!jourLibre) continue;
      date = jourLibre;
      used.add(date);
    }
    lignes.push({
      id: nextLigneId(),
      catalogueItemId: c.item.id,
      nom: c.item.nom,
      date,
      prixParPersonne: c.prixParPersonne,
      nbPersonnes: nbPersonnes || 2,
      remise: 0,
      remiseLabel: "",
    });
  }
  return lignes;
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

  const prospects = clients.filter((c) => PROSPECT_STATUTS.includes(c.statut));

  const [prospectId, setProspectId] = useState("");
  const [moisLabelOverride, setMoisLabelOverride] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [adultes, setAdultes] = useState(2);
  const [enfants, setEnfants] = useState(0);
  const [agesEnfants, setAgesEnfants] = useState("");
  const [interets, setInterets] = useState("");
  const [hotel, setHotel] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [picker, setPicker] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const nbPersonnes = adultes + enfants;

  const applyProspect = (id: string) => {
    setProspectId(id);
    const c = clients.find((cl) => cl.id === id);
    if (!c) return;
    setDateDebut(c.kommo_sejour_debut_estime || "");
    setDateFin(c.kommo_sejour_fin_estime || "");
    setAdultes(c.kommo_nb_adultes_estime ?? 2);
    setEnfants(c.kommo_nb_enfants_estime ?? 0);
    setAgesEnfants(c.kommo_ages_enfants_estime || "");
    setInterets(c.kommo_activites_interet || "");
    setHotel(c.kommo_hotel_estime || c.hotel || "");
  };

  const genererAuto = () => {
    const suggestions = suggererProgramme({
      catalogue,
      dateDebut,
      dateFin,
      nbAdultes: adultes,
      nbEnfants: enfants,
      agesEnfants,
      interets,
    });
    if (suggestions.length === 0) {
      toast("Aucune activité du catalogue ne correspond à ces critères — ajoute-les à la main.");
      return;
    }
    setLignes(suggestions);
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
        nbPersonnes: nbPersonnes || 2,
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

  const moisLabel = moisLabelOverride || moisLabelFromDates(lignes.map((l) => l.date)) || moisLabelFromDates([dateDebut, dateFin]);
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

  const addToProspect = async () => {
    if (!prospectId) {
      toast("Choisis un prospect pour y ajouter ces activités.");
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
      const puEffectif =
        l.remise > 0 ? Math.max(l.prixParPersonne - l.remise / Math.max(l.nbPersonnes, 1), 0) : l.prixParPersonne;
      const { error } = await supabase.from("reservations").insert({
        client_id: prospectId,
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
    toast(`${lignes.length} activité(s) ajoutée(s) au dossier du prospect.`, "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Générateur de programme</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choisis un prospect : le profil déduit de sa conversation (Kommo) préremplit les critères, puis
          « Générer automatiquement » propose un premier programme selon ses envies, son budget familial
          (enfants/ados) et les jours où chaque activité est disponible — à ajuster avant envoi.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <label className="text-xs text-neutral-500">
          Prospect
          <select value={prospectId} onChange={(e) => applyProspect(e.target.value)} className="input mt-1">
            <option value="">— Choisir un prospect —</option>
            {prospects.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom || "Sans nom"}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-neutral-500">
            Arrivée
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Départ
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Adultes
            <input
              type="number"
              min={0}
              value={adultes}
              onChange={(e) => setAdultes(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Enfants
            <input
              type="number"
              min={0}
              value={enfants}
              onChange={(e) => setEnfants(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500">
            Âges enfants/ados
            <input
              type="text"
              value={agesEnfants}
              onChange={(e) => setAgesEnfants(e.target.value)}
              placeholder="ex. 6, 9 et 14 ans"
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500">
            Hôtel
            <input type="text" value={hotel} onChange={(e) => setHotel(e.target.value)} className="input mt-1" />
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Envies exprimées dans la conversation (séparées par une virgule)
            <input
              type="text"
              value={interets}
              onChange={(e) => setInterets(e.target.value)}
              placeholder="ex. plongée, îles, culture"
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Mois affiché
            <input
              type="text"
              value={moisLabelOverride}
              onChange={(e) => setMoisLabelOverride(e.target.value)}
              placeholder={moisLabelFromDates([dateDebut, dateFin]) || "Auto"}
              className="input mt-1"
            />
          </label>
        </div>

        <button
          onClick={genererAuto}
          className="mt-3 rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          ✨ Générer automatiquement
        </button>
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
            <p className="text-sm font-medium text-neutral-700">Message à envoyer au prospect</p>
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
            <button
              onClick={addToProspect}
              disabled={saving || !prospectId}
              className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Ajout…" : `Ajouter ${lignes.length} activité(s) au dossier du prospect`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
