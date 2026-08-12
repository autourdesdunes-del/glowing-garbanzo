"use client";

import { useEffect, useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { billetEnvoiRappelDueKey } from "@/lib/billetEnvoiRappel";

type Alert = { r: Reservation; client: Client; key: string; phase: "initial" | "relance" };

// Rappelle à toute l'équipe (pas seulement Hossam) qu'un billet d'avion
// reçu n'a pas encore été envoyé au client — un premier pop-up dans l'heure
// qui suit la réception, puis toutes les 3h tant que la réservation reste à
// l'étape "a_envoyer_client". "Oui c'est fait" / "Je l'ai envoyé" marquent
// directement l'étape "Envoyé au client", ce qui arrête les rappels pour
// tout le monde. Marqueurs "déjà vu" en localStorage (par appareil), même
// convention que AppelReminders/BilletRappels.
export default function BilletEnvoiRappels({
  reservations,
  clients,
  onUpdateReservation,
}: {
  reservations: Reservation[];
  clients: Client[];
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
}) {
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      for (const r of reservations) {
        if (!r.billet_requis) continue;
        const client = clients.find((c) => c.id === r.client_id);
        if (!client) continue;
        const storageKey = "billet-envoi-rappel-" + r.id;
        const lastShown = localStorage.getItem(storageKey);
        const due = billetEnvoiRappelDueKey(r, lastShown, now);
        if (due) {
          setAlert({ r, client, key: due, phase: due === "initial" ? "initial" : "relance" });
          return; // un seul pop-up à la fois ; le suivant apparaît au prochain check
        }
      }
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [reservations, clients]);

  if (!alert) return null;

  const { r, client, phase } = alert;
  const dateLabel = r.billet_date
    ? new Date(r.billet_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : "?";

  const dismiss = () => {
    localStorage.setItem("billet-envoi-rappel-" + r.id, alert.key);
    setAlert(null);
  };

  const marquerEnvoye = () => {
    onUpdateReservation(r.id, { billet_etape: "termine" });
    setAlert(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">✈ Billet d&apos;avion reçu</h2>
        <p className="mt-3 text-sm text-[#171717]">
          {phase === "initial"
            ? `Vous avez reçu le billet d'avion pour ${client.nom || "ce client"} pour le ${dateLabel} — pensez à l'envoyer au client.`
            : `Vous n'avez pas envoyé ce billet à ${client.nom || "ce client"} (vol du ${dateLabel}) ?`}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={marquerEnvoye}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {phase === "initial" ? "Oui, c'est fait" : "Je l'ai envoyé"}
          </button>
          <button
            onClick={dismiss}
            className="flex-1 rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            {phase === "initial" ? "Je m'en occupe maintenant" : "Non, pas encore"}
          </button>
        </div>
      </div>
    </div>
  );
}
