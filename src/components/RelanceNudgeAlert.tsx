"use client";

import { useState } from "react";
import { Client } from "@/lib/types";
import { todayStr } from "@/lib/dates";
import { PROSPECT_STATUTS } from "@/lib/constants";

// Remplace l'idée de "responsable relances de la semaine" (voir Notion) :
// plutôt qu'une seule personne nommée — ce qui donne aux autres une excuse
// de ne pas s'en occuper ("c'est pas moi cette semaine") — chaque employée
// reçoit ce rappel individuel dès qu'elle est elle-même restée inactive sur
// les relances alors que des prospects attendent. Personne n'est "the
// responsible one", tout le monde peut agir.
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function joursAvantArrivee(dateStr: string) {
  return Math.round((Date.parse(dateStr) - Date.parse(todayStr())) / 86400000);
}

function estProspectStagnant(c: Client) {
  if (!PROSPECT_STATUTS.includes(c.statut)) return false;
  if (!c.date_debut || c.date_debut < todayStr()) return false;
  const avant = joursAvantArrivee(c.date_debut);
  const seuilRelance = avant <= 7 ? 2 : avant <= 30 ? 5 : 10;
  return daysSince(c.dernier_contact_date || c.created_at) >= seuilRelance;
}

// Combien de jours d'inactivité personnelle avant de proposer le rappel —
// distinct du seuil par prospect (estProspectStagnant) : ici on regarde
// l'employée elle-même, pas un dossier précis.
const SEUIL_INACTIVITE_JOURS = 2;
// Le "Plus tard" ne referme le pop-up que pour quelques heures — sinon il
// ne reviendrait plus jamais tant que dernier_contact_par_id ne change pas.
const DISMISS_GAP_MS = 4 * 60 * 60 * 1000;

function lireDismissedAt(key: string) {
  if (typeof window === "undefined") return null;
  const stored = Number(window.localStorage.getItem(key) || 0);
  return stored || null;
}

function encoreDismiss(dismissedAt: number | null) {
  return !!dismissedAt && Date.now() - dismissedAt < DISMISS_GAP_MS;
}

export default function RelanceNudgeAlert({
  currentUserId,
  clients,
  onOpenProspectsARelancer,
}: {
  currentUserId: string;
  clients: Client[];
  onOpenProspectsARelancer: () => void;
}) {
  const dismissKey = `relance_nudge_dismiss_${currentUserId}`;
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => lireDismissedAt(dismissKey));

  if (!currentUserId) return null;
  if (encoreDismiss(dismissedAt)) return null;

  // Ses propres relances passées (dernier_contact_par_id la désigne) —
  // sans historique du tout, pas de comparaison possible : on ne l'embête
  // pas dès son premier jour.
  const mesRelances = clients.filter((c) => c.dernier_contact_par_id === currentUserId && c.dernier_contact_date);
  if (mesRelances.length === 0) return null;
  const derniereRelance = mesRelances.reduce(
    (max, c) => (c.dernier_contact_date! > max ? c.dernier_contact_date! : max),
    ""
  );
  const joursDepuis = daysSince(derniereRelance);
  if (joursDepuis < SEUIL_INACTIVITE_JOURS) return null;

  const stagnants = clients.filter(estProspectStagnant);
  if (stagnants.length === 0) return null;

  const dismiss = () => {
    window.localStorage.setItem(dismissKey, String(Date.now()));
    setDismissedAt(Date.now());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-[#C9973E] bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#8B4531]">Relances</h2>
        <p className="mt-2 text-sm text-[#171717]">
          Depuis {joursDepuis} jour{joursDepuis > 1 ? "s" : ""} tu n&apos;as fait aucune relance. Il y a
          pourtant {stagnants.length} prospect{stagnants.length > 1 ? "s" : ""} qui attend
          {stagnants.length > 1 ? "ent" : ""} une relance — souhaites-tu t&apos;en occuper ?
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss();
              onOpenProspectsARelancer();
            }}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Oui, je m&apos;en occupe
          </button>
        </div>
      </div>
    </div>
  );
}
