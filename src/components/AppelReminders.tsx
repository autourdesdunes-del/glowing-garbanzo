"use client";

import { useEffect, useState } from "react";
import { Client, PlanningShift, Profile } from "@/lib/types";
import { localDateStr } from "@/lib/dates";
import { profilesOnShiftAt } from "@/lib/planning";

type Alert = { kind: "shift" | "reminder"; calls: Client[] };

function minutesSinceMidnight(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Prévient une employée, en fenêtre par-dessus l'appli, des appels qui
// tombent pendant son shift : une fois au début du shift (liste du jour),
// puis à nouveau 10 min avant chaque appel — pour qu'elle ne délègue pas
// l'appel à quelqu'un d'autre sans le savoir. Marqueurs "déjà vu" en
// localStorage (par appareil), pour ne pas re-notifier en boucle.
export default function AppelReminders({
  clients,
  profiles,
  planningShifts,
  currentUserId,
}: {
  clients: Client[];
  profiles: Profile[];
  planningShifts: PlanningShift[];
  currentUserId: string;
}) {
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    const check = () => {
      const now = new Date();
      const todayStr = localDateStr(now);
      const nowMin = now.getHours() * 60 + now.getMinutes();

      const todayShift = planningShifts.find(
        (s) => s.user_id === currentUserId && s.date === todayStr && s.statut === "travail"
      );

      const myCallsToday = clients.filter(
        (c) =>
          c.prochain_appel_date === todayStr &&
          c.prochain_appel_heure &&
          profilesOnShiftAt(profiles, planningShifts, todayStr, c.prochain_appel_heure).some(
            (p) => p.id === currentUserId
          )
      );

      if (todayShift?.shift_debut && myCallsToday.length > 0) {
        const debutMin = minutesSinceMidnight(todayShift.shift_debut);
        const shiftKey = `appel-shift-notif-${currentUserId}-${todayStr}`;
        if (
          debutMin !== null &&
          nowMin >= debutMin &&
          nowMin < debutMin + 15 &&
          !localStorage.getItem(shiftKey)
        ) {
          localStorage.setItem(shiftKey, "1");
          setAlert({ kind: "shift", calls: myCallsToday });
          return;
        }
      }

      for (const c of myCallsToday) {
        const heureMin = minutesSinceMidnight(c.prochain_appel_heure);
        if (heureMin === null) continue;
        const reminderKey = `appel-10min-notif-${c.id}-${todayStr}`;
        if (nowMin >= heureMin - 10 && nowMin < heureMin && !localStorage.getItem(reminderKey)) {
          localStorage.setItem(reminderKey, "1");
          setAlert({ kind: "reminder", calls: [c] });
          return;
        }
      }
    };

    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [clients, profiles, planningShifts, currentUserId]);

  if (!alert) return null;

  const plural = alert.calls.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">
          {alert.kind === "shift"
            ? plural
              ? "Appels prévus pendant votre shift"
              : "Appel prévu pendant votre shift"
            : "Appel dans 10 minutes"}
        </h2>
        <div className="mt-3 space-y-2">
          {alert.calls.map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm"
            >
              <div className="font-amounts text-neutral-500">
                {c.prochain_appel_heure}
                {c.prochain_appel_fuseau === "egypte" ? " (heure égyptienne)" : " (heure française)"}
              </div>
              <div>
                <strong>{c.nom || "Sans nom"}</strong>
                {c.prochain_appel_plateforme ? ` — ${c.prochain_appel_plateforme}` : ""}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#666666]">
          Merci de ne pas déléguer {plural ? "ces appels" : "cet appel"} à une personne tierce.
        </p>
        <button
          onClick={() => setAlert(null)}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          OK
        </button>
      </div>
    </div>
  );
}
