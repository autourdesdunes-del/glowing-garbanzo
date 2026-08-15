"use client";

import { useEffect, useState } from "react";
import { Client, Profile } from "@/lib/types";

const REVERT_APRES_MS = 30 * 60 * 1000;

// Quand un lead Kommo passe "Réservé", le webhook/cron marque la fiche
// confirmation_a_traiter=true (cf. /api/kommo/webhook et
// /api/cron/kommo-reconcile) — cette pop-up bloque l'équipe tant que
// personne n'a ouvert la fiche pour vérifier/compléter les infos réelles
// (hôtel, dates, activités...), qui ne sont jamais fiables à 100% depuis
// l'extraction Kommo seule. Comme DoublonPossibleAlert, pas de dismiss
// local silencieux : la source de vérité est confirmation_a_traiter en
// base, sinon le popup disparaîtrait pour une personne sans que la fiche
// soit vraiment traitée pour l'équipe.
//
// Seule exception : "Renvoyer à quelqu'un d'autre" mémorise localement
// (par poste, via localStorage) qu'on a transmis la tâche — l'app n'a pas
// d'identité par employé (login partagé), donc c'est la seule façon de
// libérer CET écran sans prétendre que la fiche est traitée. La clé inclut
// kommo_synced_at (nouvelle confirmation ultérieure) et l'assignation en
// cours (confirmation_assignee_a) : si la personne désignée n'a rien fait
// dans les 30 minutes, on efface l'assignation (confirmation_assignee_a_le
// est trop ancien) — la clé de dismiss change alors, donc le popup
// réapparaît automatiquement pour toute l'équipe, y compris le poste qui
// avait fait le renvoi.
function dismissKey(clientId: string, syncedAt: string | null, assignee: string | null) {
  return `confirmation_dismiss_${clientId}_${syncedAt ?? ""}_${assignee ?? "none"}`;
}

export default function NouveauClientConfirmeAlert({
  clients,
  profiles,
  onOpenClient,
  onAssigner,
  onRevert,
}: {
  clients: Client[];
  profiles: Profile[];
  onOpenClient: (id: string) => void;
  onAssigner: (id: string, assignee: string) => void;
  onRevert: (id: string) => void;
}) {
  const [alertId, setAlertId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  const equipeOptions = profiles
    .filter((p) => p.role === "equipe" && (p.prenom || "").trim().toLowerCase() !== "bode")
    .map((p) => p.prenom)
    .filter((prenom): prenom is string => !!prenom.trim());

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const c of clients) {
        if (!c.confirmation_a_traiter || !c.confirmation_assignee_a) continue;
        const assigneLe = c.confirmation_assignee_a_le ? new Date(c.confirmation_assignee_a_le).getTime() : 0;
        if (now - assigneLe > REVERT_APRES_MS) {
          onRevert(c.id);
        }
      }
      const c = clients.find((c) => {
        if (!c.confirmation_a_traiter) return false;
        if (typeof window === "undefined") return true;
        return !window.localStorage.getItem(
          dismissKey(c.id, c.kommo_synced_at, c.confirmation_assignee_a)
        );
      });
      setAlertId(c?.id ?? null);
      setReassigning(false);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  if (!alertId) return null;
  const client = clients.find((c) => c.id === alertId);
  if (!client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">🆕 Nouveau client confirmé</h2>
        <p className="mt-3 text-sm text-[#171717]">
          <strong>{client.nom || "Sans nom"}</strong> vient de passer &laquo;&nbsp;Client confirmé&nbsp;&raquo; depuis Kommo.
          {client.confirmation_assignee_a
            ? ` Déjà renvoyé à ${client.confirmation_assignee_a} — à traiter.`
            : " Ouvrez la fiche pour vérifier et compléter les infos réelles (hôtel, dates, activités)."}
        </p>
        {!reassigning ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => {
                onOpenClient(client.id);
                setAlertId(null); // libère l'écran le temps de consulter — revient au prochain contrôle (60s) tant que ce n'est pas marqué traité
              }}
              className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Ouvrir la fiche maintenant
            </button>
            <button
              onClick={() => setReassigning(true)}
              className="rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
            >
              Renvoyer à quelqu&apos;un d&apos;autre
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {equipeOptions.length === 0 && (
              <p className="text-xs text-neutral-400">Aucune autre personne dans le planning équipe.</p>
            )}
            {equipeOptions.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onAssigner(client.id, option);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(dismissKey(client.id, client.kommo_synced_at, option), "1");
                  }
                  setAlertId(null);
                }}
                className="rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
              >
                Renvoyer à {option}
              </button>
            ))}
            <button
              onClick={() => setReassigning(false)}
              className="mt-1 text-xs text-[#171717]/60 hover:underline"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
