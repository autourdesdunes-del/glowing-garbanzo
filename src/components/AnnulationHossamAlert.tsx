"use client";

import { useEffect, useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { HOSSAM_EMAIL } from "@/lib/constants";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Prévient Hossam qu'une activité billet d'avion / croisière / hôtel a été
// annulée — il est le seul à pouvoir accorder une exception de
// remboursement sur ces cas. Une seule notification par annulation
// (localStorage, même convention que les autres rappels), pas récurrente
// contrairement aux rappels billets : ici il s'agit juste d'informer, pas
// d'une tâche à répéter tant qu'elle n'est pas faite.
export default function AnnulationHossamAlert({
  reservations,
  clients,
  userEmail,
}: {
  reservations: Reservation[];
  clients: Client[];
  userEmail: string;
}) {
  const [alert, setAlert] = useState<{ r: Reservation; client: Client } | null>(null);

  useEffect(() => {
    if (userEmail.toLowerCase() !== HOSSAM_EMAIL.toLowerCase()) return;

    const check = () => {
      for (const r of reservations) {
        if (!r.annulation_prevenir_hossam || r.statut_resa !== "Annulée") continue;
        const client = clients.find((c) => c.id === r.client_id);
        if (!client) continue;
        const storageKey = "annulation-hossam-vu-" + r.id;
        if (localStorage.getItem(storageKey)) continue;
        setAlert({ r, client });
        return;
      }
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [reservations, clients, userEmail]);

  if (!alert) return null;

  const { r, client } = alert;

  const dismiss = () => {
    localStorage.setItem("annulation-hossam-vu-" + r.id, "1");
    setAlert(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">⚠ Activité annulée</h2>
        <p className="mt-3 text-sm text-[#171717]">
          <strong>{client.nom || "Un client"}</strong> a annulé « {r.nom_activite || "une activité"} »
          {r.date_debut ? ` (${fmtDate(r.date_debut)})` : ""} — normalement non remboursable, sauf si vous
          validez une exception.
        </p>
        {r.annulation_raison && (
          <p className="mt-1 text-xs text-neutral-500">Raison : {r.annulation_raison}</p>
        )}
        <button
          onClick={dismiss}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          OK, vu
        </button>
      </div>
    </div>
  );
}
