"use client";

import { useEffect, useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { billetRappelDueKey } from "@/lib/billetRappel";
import { hossamBilletMessage, participantsFor } from "@/lib/resa";
import { HOSSAM_EMAIL } from "@/lib/constants";

type Alert = { r: Reservation; client: Client; key: string };

// Rappelle, en pop-up par-dessus l'appli, qu'un billet d'avion Le Caire
// n'est pas encore acheté — à Hossam (message en anglais, actionnable) et
// au reste de l'équipe (message en français, "relancez Hossam"), sur le
// même calendrier de paliers. S'arrête tout seul dès que la réservation
// sort de l'étape "attente_hossam" (billet reçu/acheté) — voir
// ReservationCard, qui fait avancer l'étape automatiquement à l'ajout de
// la photo du billet. Marqueurs "déjà vu" en localStorage (par appareil),
// même convention que AppelReminders.
export default function BilletRappels({
  reservations,
  clients,
  userEmail,
}: {
  reservations: Reservation[];
  clients: Client[];
  userEmail: string;
}) {
  const isHossam = userEmail.toLowerCase() === HOSSAM_EMAIL.toLowerCase();
  const storagePrefix = isHossam ? "billet-rappel-hossam-" : "billet-rappel-equipe-";
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      for (const r of reservations) {
        if (!r.billet_requis) continue;
        const client = clients.find((c) => c.id === r.client_id);
        if (!client) continue;
        const storageKey = storagePrefix + r.id;
        const lastShown = localStorage.getItem(storageKey);
        const due = billetRappelDueKey(r, lastShown, now);
        if (due) {
          setAlert({ r, client, key: due });
          return; // un seul pop-up à la fois ; le suivant apparaît au prochain check
        }
      }
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [reservations, clients, storagePrefix]);

  if (!alert) return null;

  const { r, client } = alert;
  const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);
  const nbTotal = nbAd + nbEnf + nbAcc + nbEnf3;
  const dateLabel = r.billet_date
    ? new Date(r.billet_date + "T00:00:00").toLocaleDateString(isHossam ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "long",
      })
    : "?";

  const dismiss = () => {
    localStorage.setItem(storagePrefix + r.id, alert.key);
    setAlert(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">✈ Billet d&apos;avion</h2>
        {isHossam ? (
          <p className="mt-3 text-sm text-[#171717]">
            {(r.billet_nom_complet || client.nom || "Client").split(/[\n,]+/)[0].trim()} paid deposit for
            Cairo plane on {dateLabel} for {nbTotal} people - don&apos;t forget to buy ticket.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-[#171717]">
              Ce billet d&apos;avion n&apos;est pas encore acheté — faites un rappel à Hossam.
            </p>
            <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div>
                <strong>{client.nom || "Sans nom"}</strong>
              </div>
              <div className="font-amounts text-neutral-500">
                Vol le {dateLabel} — {nbTotal} pers.
              </div>
            </div>
          </>
        )}
        <div className="mt-4 flex gap-2">
          {!isHossam && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(hossamBilletMessage(r, client));
              }}
              className="flex-1 rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
            >
              Copier la demande
            </button>
          )}
          <button
            onClick={dismiss}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
