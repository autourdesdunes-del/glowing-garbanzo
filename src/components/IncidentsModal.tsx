"use client";

import { useState } from "react";
import { Incident } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { todayStr } from "@/lib/dates";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function IncidentsModal({
  clientId,
  clientNom,
  incidents,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: {
  clientId: string;
  clientNom: string;
  incidents: Incident[];
  onAdd: (incident: Incident) => void;
  onUpdate: (id: string, patch: Partial<Incident>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [showForm, setShowForm] = useState(incidents.length === 0);
  const [titre, setTitre] = useState("");
  const [details, setDetails] = useState("");
  const [dateIncident, setDateIncident] = useState(todayStr());
  const [par, setPar] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sorted = [...incidents].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const ajouter = async () => {
    if (!titre.trim()) {
      toast("Donnez un titre court à l'incident.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        client_id: clientId,
        titre: titre.trim(),
        details: details.trim(),
        date_incident: dateIncident || null,
        par: par.trim(),
      })
      .select()
      .single();
    setSubmitting(false);
    if (!error && data) {
      onAdd(data as Incident);
      setTitre("");
      setDetails("");
      setPar("");
      setShowForm(false);
    } else {
      toast("Impossible d'enregistrer l'incident.");
    }
  };

  const toggleStatut = async (incident: Incident) => {
    const statut = incident.statut === "Ouvert" ? "Résolu" : "Ouvert";
    onUpdate(incident.id, { statut });
    const { error } = await supabase.from("incidents").update({ statut }).eq("id", incident.id);
    if (error) toast("Échec de la mise à jour.");
  };

  const supprimer = async (incident: Incident) => {
    const ok = await confirm({
      message: "Supprimer ce rapport d'incident ? Cette action est irréversible.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    onDelete(incident.id);
    const { error } = await supabase.from("incidents").delete().eq("id", incident.id);
    if (error) toast("Échec de la suppression.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Incidents — {clientNom || "ce client"}
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>

        {sorted.length === 0 && !showForm && (
          <p className="mt-3 text-sm text-neutral-500">Aucun incident enregistré.</p>
        )}

        {sorted.length > 0 && (
          <div className="mt-3 space-y-2">
            {sorted.map((incident) => (
              <div
                key={incident.id}
                className={`rounded-md border px-3 py-2.5 ${
                  incident.statut === "Ouvert" ? "border-red-200 bg-red-50" : "border-neutral-200 bg-[#fafafa]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#171717]">{incident.titre}</p>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      incident.statut === "Ouvert" ? "bg-red-100 text-red-700" : "bg-[#0F5C56]/10 text-[#0F5C56]"
                    }`}
                  >
                    {incident.statut}
                  </span>
                </div>
                {incident.details && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-600">{incident.details}</p>
                )}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {fmtDate(incident.date_incident)}
                    {incident.par ? ` · ${incident.par}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleStatut(incident)} className="text-[#171717] hover:underline">
                      {incident.statut === "Ouvert" ? "Marquer résolu" : "Rouvrir"}
                    </button>
                    <button onClick={() => supprimer(incident)} className="text-red-600 hover:underline">
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="mt-3 space-y-1.5 rounded-md border border-neutral-200 p-3">
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre court (ex. Réclamation morsure de chameau)"
              className="input text-sm"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Détails…"
              rows={3}
              className="input text-sm"
            />
            <div className="flex gap-1.5">
              <input
                type="date"
                value={dateIncident}
                onChange={(e) => setDateIncident(e.target.value)}
                className="input text-sm"
              />
              <input
                value={par}
                onChange={(e) => setPar(e.target.value)}
                placeholder="Signalé par"
                className="input text-sm"
              />
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={ajouter}
                disabled={submitting}
                className="flex-1 rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "…" : "Enregistrer"}
              </button>
              {sorted.length > 0 && (
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-[#fafafa]"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 w-full rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
          >
            + Signaler un incident
          </button>
        )}
      </div>
    </div>
  );
}
