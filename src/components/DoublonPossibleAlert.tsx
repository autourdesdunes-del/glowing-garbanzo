"use client";

import { useEffect, useState } from "react";
import { Client } from "@/lib/types";

// Prévient toute l'équipe qu'un client créé automatiquement par Kommo
// ressemble à un client déjà existant — Kommo ne rapproche que par
// kommo_lead_id/téléphone/email, jamais par nom (trop risqué sans
// validation humaine), donc ce cas passe par un humain plutôt qu'un
// rapprochement silencieux. "doublon_traite" (en base, migration 0068) est
// la même source de vérité que l'indicateur du tableau de bord — pas de
// dismiss localStorage ici, sinon le popup disparaîtrait pour une personne
// sans que ce soit vraiment vérifié pour l'équipe.
export default function DoublonPossibleAlert({
  clients,
  onOpenClient,
  onResoudre,
}: {
  clients: Client[];
  onOpenClient: (id: string) => void;
  onResoudre: (id: string) => void;
}) {
  const [alertId, setAlertId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const c = clients.find((c) => c.doublon_possible_id && !c.doublon_traite);
      setAlertId(c?.id ?? null);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [clients]);

  if (!alertId) return null;
  const nouveau = clients.find((c) => c.id === alertId);
  if (!nouveau) return null;
  const existant = clients.find((c) => c.id === nouveau.doublon_possible_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">⚠ Doublon possible</h2>
        <p className="mt-3 text-sm text-[#171717]">
          Un nouveau client <strong>{nouveau.nom || "Sans nom"}</strong> (créé automatiquement depuis
          Kommo) ressemble à <strong>{existant?.nom || "un client déjà existant"}</strong>, déjà dans le
          CRM.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              onOpenClient(nouveau.id);
              setAlertId(null); // libère l'écran le temps de consulter — revient au prochain contrôle (60s) tant que ce n'est pas marqué vérifié
            }}
            className="rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            Voir la nouvelle fiche
          </button>
          {existant && (
            <button
              onClick={() => {
                onOpenClient(existant.id);
                setAlertId(null);
              }}
              className="rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
            >
              Voir la fiche existante
            </button>
          )}
          <button
            onClick={() => onResoudre(nouveau.id)}
            className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            OK, vérifié
          </button>
        </div>
      </div>
    </div>
  );
}
