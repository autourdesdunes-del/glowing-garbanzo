"use client";

import { Client, Reservation, ReservationOption } from "@/lib/types";
import { participantsFor, resaTotalMontant } from "@/lib/resa";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function toStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function enumerateDays(start: string, end: string) {
  const days: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    days.push(toStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function ItineraryView({
  client,
  reservations,
  resaOptions,
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
}) {
  if (!client.date_debut || !client.date_fin) {
    return (
      <div className="text-sm text-neutral-400">
        Renseigne les dates du séjour (étape Séjour) pour voir l&apos;itinéraire jour par jour.
      </div>
    );
  }

  const days = enumerateDays(client.date_debut, client.date_fin);

  return (
    <div className="space-y-4">
      {days.map((day, i) => {
        const dayResas = reservations.filter((r) => {
          if (!r.date_debut) return false;
          const end = r.date_fin || r.date_debut;
          return day >= r.date_debut && day <= end;
        });

        return (
          <div key={day} className="rounded-md border border-[#8B4531]/15 bg-white p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="rounded-full bg-[#F2E6D2] px-2 py-0.5 text-xs font-medium text-[#5C2A1D]">
                Jour {i + 1}
              </span>
              <span className="font-heading text-sm font-semibold capitalize text-[#5C2A1D]">
                {fmtDate(day)}
              </span>
            </div>

            {dayResas.length === 0 ? (
              <p className="text-sm text-neutral-400">Journée libre.</p>
            ) : (
              <div className="space-y-2">
                {dayResas.map((r) => {
                  const { nbAd, nbEnf } = participantsFor(r, client);
                  const total = resaTotalMontant(r, client, resaOptions[r.id] || []);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-md bg-[#F2E6D2]/50 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium text-[#5C2A1D]">
                          {r.nom_activite || "Activité sans nom"}
                        </span>
                        <span className="ml-2 text-xs text-neutral-500">
                          {r.moment}
                          {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
                        </span>
                        <div className="text-xs text-neutral-500">
                          {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
                        </div>
                      </div>
                      <span className="font-amounts text-xs text-neutral-600">
                        {euros(total)} €
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
