"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";

const WEEKDAY_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function weekdaysInRange(debut: string, fin: string): Set<string> {
  const set = new Set<string>();
  if (!debut || !fin) return set;
  const d = new Date(debut + "T00:00:00");
  const end = new Date(fin + "T00:00:00");
  if (d > end) return set;
  while (d <= end) {
    set.add(WEEKDAY_FR[d.getDay()]);
    d.setDate(d.getDate() + 1);
  }
  return set;
}

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

type Candidate = {
  item: CatalogueItem;
  prix: number;
  score: number;
  budgetRatio: number;
};

export default function GeneratorView({
  catalogue,
  clients,
}: {
  catalogue: CatalogueItem[];
  clients: Client[];
}) {
  const supabase = createClient();
  const toast = useToast();

  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [adultes, setAdultes] = useState(2);
  const [enfants, setEnfants] = useState(0);
  const [bebes, setBebes] = useState(0);
  const [budget, setBudget] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetClientId, setTargetClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [ranked, setRanked] = useState<Candidate[] | null>(null);

  const generate = () => {
    if (!dateDebut || !dateFin) {
      toast("Renseigne les dates du séjour.");
      return;
    }
    const availableWeekdays = weekdaysInRange(dateDebut, dateFin);
    const candidates: Candidate[] = catalogue
      .filter((a) => a.valide)
      .map((a) => {
        const prix = a.pu_adulte * adultes + a.pu_enfant * enfants + a.pu_bebe * bebes;
        const jours = a.jours_disponibles || [];
        const joursOk = jours.length === 0 || jours.some((j) => availableWeekdays.has(j));
        const budgetRatio = budget > 0 ? prix / budget : 0;
        // Score : priorise une bonne marge cible tout en pénalisant ce qui
        // mange une trop grosse part du budget du client.
        const score = (a.marge_pct || 0) - Math.max(0, budgetRatio - 0.4) * 100;
        return { item: a, prix, score, budgetRatio, joursOk };
      })
      .filter((c) => c.joursOk)
      .sort((a, b) => b.score - a.score);
    setRanked(candidates);
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = (ranked || []).filter((c) => selected.has(c.item.id));
  const totalSelected = selectedItems.reduce((s, c) => s + c.prix, 0);

  const addToClient = async () => {
    if (!targetClientId) {
      toast("Choisis un client pour y ajouter ces activités.");
      return;
    }
    if (selectedItems.length === 0) {
      toast("Coche au moins une activité.");
      return;
    }
    setSaving(true);
    const usedDates = new Set<string>();
    const allDates = datesInRange(dateDebut, dateFin);
    for (const c of selectedItems) {
      const jours = c.item.jours_disponibles || [];
      const date =
        allDates.find((d) => {
          if (usedDates.has(d)) return false;
          if (jours.length === 0) return true;
          const weekday = WEEKDAY_FR[new Date(d + "T00:00:00").getDay()];
          return jours.includes(weekday);
        }) || null;
      if (date) usedDates.add(date);
      const { error } = await supabase.from("reservations").insert({
        client_id: targetClientId,
        nom_activite: c.item.nom,
        catalogue_item_id: c.item.id,
        pu_adulte: c.item.pu_adulte,
        pu_enfant: c.item.pu_enfant,
        horaire_approx: c.item.horaire_approx,
        inclus: (c.item.inclus_liste || []).join(", ") || c.item.inclus,
        non_inclus: (c.item.non_inclus_liste || []).join(", ") || c.item.non_inclus,
        a_prevoir: (c.item.a_prevoir_liste || []).join(", ") || c.item.a_prevoir,
        point_rdv: c.item.point_rdv,
        photo_path: c.item.photo_path,
        date_debut: date,
      });
      if (error) {
        toast("Échec de l'ajout d'une activité.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast(`${selectedItems.length} activité(s) ajoutée(s) au client.`, "success");
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">
          Générateur de programme
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Propose les activités du catalogue les plus adaptées selon les dates, le budget du
          client et la rentabilité pour l&apos;agence.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-neutral-500">
            Arrivée
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Départ
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="input mt-1"
            />
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
          <label className="text-xs text-neutral-500">
            Bébés
            <input
              type="number"
              min={0}
              value={bebes}
              onChange={(e) => setBebes(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-3">
            Budget total du client (€)
            <input
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
        </div>
        <button
          onClick={generate}
          className="mt-3 rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Générer les propositions
        </button>
      </div>

      {ranked && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">
              {ranked.length} activité(s) compatible(s) avec ces dates
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                budget > 0 && totalSelected > budget
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {euros(totalSelected)}€ sélectionnés{budget > 0 ? ` / ${euros(budget)}€` : ""}
            </span>
          </div>

          {ranked.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Aucune activité validée du catalogue n&apos;est disponible sur ces jours-là.
            </p>
          ) : (
            <div className="space-y-2">
              {ranked.map((c) => (
                <label
                  key={c.item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    selected.has(c.item.id)
                      ? "border-[#171717] bg-[#fafafa]/40"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.item.id)}
                    onChange={() => toggle(c.item.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#171717]">{c.item.nom}</p>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                        {c.item.categorie}
                      </span>
                      {c.item.marge_pct > 0 && (
                        <span className="rounded-full bg-[#0070f3]/10 px-2 py-0.5 text-[10px] font-medium text-[#0070f3]">
                          Marge cible {c.item.marge_pct}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {(c.item.jours_disponibles || []).length > 0
                        ? (c.item.jours_disponibles || []).join(", ")
                        : "Tous les jours"}
                    </p>
                  </div>
                  <span className="font-amounts whitespace-nowrap text-sm text-[#171717]">
                    {euros(c.prix)}€
                  </span>
                </label>
              ))}
            </div>
          )}

          {ranked.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white p-3">
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
                {saving ? "Ajout…" : `Ajouter ${selectedItems.length || ""} activité(s)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
