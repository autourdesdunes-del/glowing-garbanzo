"use client";

import { useEffect, useState } from "react";
import { Conge, Profile } from "@/lib/types";
import { fmtDate } from "@/lib/planningRHFormat";

type Groupe = { key: string; userId: string; dates: string[]; motif: string };

// Prévient la direction dès qu'une nouvelle demande de congé arrive, sans
// avoir à penser à aller consulter Planning > Congés. Une demande sur
// plusieurs jours (une ligne par jour, voir requestConge dans
// PlanningRHView.tsx) est regroupée en une seule alerte via user_id +
// created_at — identique pour toutes les lignes d'un même envoi puisque
// c'est un seul INSERT multi-lignes (now() est stable pour toute la durée
// d'une requête). Dismiss par groupe (localStorage), même convention que
// AnnulationHossamAlert.
export default function CongeDemandeAlert({
  isDirection,
  conges,
  profiles,
}: {
  isDirection: boolean;
  conges: Conge[];
  profiles: Profile[];
}) {
  const [alert, setAlert] = useState<Groupe | null>(null);

  useEffect(() => {
    const compute = () => {
      if (!isDirection) {
        setAlert(null);
        return;
      }
      const groupes = new Map<string, Groupe>();
      for (const c of conges) {
        if (c.statut !== "En attente") continue;
        const key = `${c.user_id}_${c.created_at}`;
        const g = groupes.get(key);
        if (g) g.dates.push(c.date_debut);
        else groupes.set(key, { key, userId: c.user_id, dates: [c.date_debut], motif: c.motif });
      }
      for (const g of groupes.values()) {
        if (localStorage.getItem("conge-demande-vu-" + g.key)) continue;
        setAlert(g);
        return;
      }
      setAlert(null);
    };
    compute();
  }, [isDirection, conges]);

  if (!alert) return null;

  const profile = profiles.find((p) => p.id === alert.userId);
  const dates = alert.dates.slice().sort();
  const periode =
    dates.length > 1 ? `du ${fmtDate(dates[0])} au ${fmtDate(dates[dates.length - 1])}` : fmtDate(dates[0]);

  const dismiss = () => {
    localStorage.setItem("conge-demande-vu-" + alert.key, "1");
    setAlert(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">🌴 Nouvelle demande de congé</h2>
        <p className="mt-3 text-sm text-[#171717]">
          <strong>{profile?.prenom || profile?.email || "Une personne de l'équipe"}</strong> a demandé un congé{" "}
          {periode}.
        </p>
        {alert.motif && <p className="mt-1 text-xs text-neutral-500">Motif : {alert.motif}</p>}
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
