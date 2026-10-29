"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ConfirmProvider";
import { NOTE_EQUIPE_TAGS_DEFAUT, NOTE_EQUIPE_TAG_COLORS, NOTE_EQUIPE_TAG_PALETTE } from "@/lib/constants";

// Couleur stable pour un tag : celle de NOTE_EQUIPE_TAG_COLORS si c'est un
// tag par défaut, sinon une couleur de la palette de repli choisie à partir
// d'un hash simple du texte — toujours la même pour un même tag, sans
// dépendre de l'ordre de création (donc stable même après rechargement).
function tagColorClass(tag: string) {
  if (NOTE_EQUIPE_TAG_COLORS[tag]) return NOTE_EQUIPE_TAG_COLORS[tag];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return NOTE_EQUIPE_TAG_PALETTE[hash % NOTE_EQUIPE_TAG_PALETTE.length];
}

type TeamNote = {
  id: string;
  created_at: string;
  tag: string;
  texte: string;
  auteur_nom: string;
  auteur_id: string | null;
  traite: boolean;
  traite_le: string | null;
  traite_par_nom: string | null;
};

function fmtDateHeure(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Mur de notes libres pour l'équipe (Tableau de bord > File d'attente
// prioritaire) — chaque note porte un tag (liste par défaut + tags déjà
// utilisés, ou un nouveau tapé à la volée), un auteur et une date affichés
// automatiquement. Cocher "traité" demande une confirmation explicite
// (double sécurité demandée par Mélanie, 2026-10-29) avant de faire
// disparaître la note du mur — elle reste consultable dans l'historique
// plutôt que d'être supprimée.
export default function TeamNotes({ monNom }: { monNom: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<TeamNote[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const [tag, setTag] = useState<string>(NOTE_EQUIPE_TAGS_DEFAUT[0]);
  const [tagPerso, setTagPerso] = useState("");
  const [texte, setTexte] = useState("");
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const charger = () => {
    supabase
      .from("team_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotes((data as TeamNote[]) || []));
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tagsDisponibles = useMemo(() => {
    const utilises = (notes || []).map((n) => n.tag);
    return Array.from(new Set([...NOTE_EQUIPE_TAGS_DEFAUT, ...utilises]));
  }, [notes]);

  const enCours = (notes || []).filter((n) => !n.traite);
  const traitees = (notes || []).filter((n) => n.traite);

  const ajouter = async () => {
    const tagFinal = tag === "__autre__" ? tagPerso.trim() : tag;
    if (!tagFinal || !texte.trim()) return;
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    await supabase.from("team_notes").insert({
      tag: tagFinal,
      texte: texte.trim(),
      auteur_nom: monNom,
      auteur_id: session?.session?.user?.id || null,
    });
    setSaving(false);
    setTexte("");
    setTagPerso("");
    setTag(NOTE_EQUIPE_TAGS_DEFAUT[0]);
    setShowForm(false);
    charger();
  };

  const marquerTraite = async (note: TeamNote) => {
    const ok = await confirm({
      title: "Confirmer que c'est traité ?",
      message: `"${note.texte}" va disparaître du mur de notes (elle restera consultable dans l'historique).`,
      confirmLabel: "Oui, c'est traité",
      cancelLabel: "Annuler",
    });
    if (!ok) return;
    await supabase
      .from("team_notes")
      .update({ traite: true, traite_le: new Date().toISOString(), traite_par_nom: monNom })
      .eq("id", note.id);
    charger();
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-[#171717]">Notes d&apos;équipe</h3>
        <div className="flex items-center gap-2">
          {traitees.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistorique((v) => !v)}
              className="text-xs font-medium text-neutral-500 hover:text-[#171717]"
            >
              {showHistorique ? "Masquer l'historique" : `Historique (${traitees.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171717] text-sm font-medium text-white hover:opacity-90"
            title="Ajouter une note"
          >
            +
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-3 rounded-[6px] border border-[#eaeaea] bg-[#fafafa] p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="rounded-md border border-[#eaeaea] bg-white px-2 py-1.5 text-xs text-[#171717]"
            >
              {tagsDisponibles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__autre__">+ Nouveau tag…</option>
            </select>
            {tag !== "__autre__" && (
              <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${tagColorClass(tag)}`}>
                {tag}
              </span>
            )}
            {tag === "__autre__" && (
              <input
                type="text"
                value={tagPerso}
                onChange={(e) => setTagPerso(e.target.value)}
                placeholder="Nom du nouveau tag"
                className="rounded-md border border-[#eaeaea] bg-white px-2 py-1.5 text-xs text-[#171717]"
              />
            )}
          </div>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Écrire la note…"
            rows={2}
            className="mb-2 w-full rounded-md border border-[#eaeaea] bg-white px-2.5 py-1.5 text-sm text-[#171717]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={ajouter}
              disabled={saving || !texte.trim() || (tag === "__autre__" && !tagPerso.trim())}
              className="rounded-md bg-[#171717] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {notes === null ? null : enCours.length === 0 && !showHistorique ? (
        <p className="py-3 text-center text-sm text-neutral-400">Aucune note pour l&apos;instant.</p>
      ) : (
        <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
          {(showHistorique ? [...enCours, ...traitees] : enCours).map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={n.traite}
                disabled={n.traite}
                onChange={() => marquerTraite(n)}
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[#171717]"
              />
              <div className="min-w-0 flex-1">
                <span
                  className={`mr-2 inline-block whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${tagColorClass(n.tag)}`}
                >
                  {n.tag}
                </span>
                <span className={`text-sm ${n.traite ? "text-neutral-400 line-through" : "text-[#171717]"}`}>
                  {n.texte}
                </span>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  {n.auteur_nom || "Quelqu'un"} — {fmtDateHeure(n.created_at)}
                  {n.traite && n.traite_par_nom ? ` · traité par ${n.traite_par_nom}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
