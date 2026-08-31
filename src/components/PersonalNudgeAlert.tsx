"use client";

import { useState } from "react";
import { Client, Verification } from "@/lib/types";
import { addDays, todayStr } from "@/lib/dates";
import { PROSPECT_STATUTS } from "@/lib/constants";

// Remplace l'idée de "responsable de la semaine" (relances / au revoir /
// avis clients / vérif dossiers, voir Notion) : plutôt qu'une seule
// personne nommée — ce qui donne aux autres une excuse de ne pas s'en
// occuper ("c'est pas moi cette semaine") — chaque employée reçoit un
// rappel individuel dès qu'elle est elle-même restée inactive sur une de
// ces quatre tâches alors qu'il y en a en attente. Personne n'est "the
// responsible one", tout le monde peut agir. Un seul pop-up à la fois (la
// plus urgente d'abord) — "Plus tard" fait passer à la suivante.
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

function estAuRevoirEnAttente(c: Client) {
  return !!c.date_fin && !c.au_revoir_envoye && addDays(c.date_fin, 1) <= todayStr();
}

function estAvisEnAttente(c: Client) {
  return (
    !!c.date_fin &&
    !c.avis_envoye &&
    c.avis_statut === "À demander" &&
    addDays(c.date_fin, 7) <= todayStr()
  );
}

function estDossierNonVerifie(c: Client, clientsVerifies: Set<string>) {
  if (c.statut !== "Client confirmé" || !c.date_debut) return false;
  if (c.date_debut > addDays(todayStr(), 14)) return false;
  if (c.date_fin && c.date_fin < todayStr()) return false;
  return !clientsVerifies.has(c.id);
}

// Combien de jours d'inactivité personnelle avant de proposer le rappel —
// distinct des seuils par dossier ci-dessus : ici on regarde l'employée
// elle-même, pas un dossier précis.
const SEUIL_INACTIVITE_JOURS = 2;
// Le "Plus tard" ne referme le pop-up que pour quelques heures — sinon il
// ne reviendrait plus jamais tant que l'attribution ne change pas.
const DISMISS_GAP_MS = 4 * 60 * 60 * 1000;

function lireDismissedAt(key: string) {
  if (typeof window === "undefined") return null;
  const stored = Number(window.localStorage.getItem(key) || 0);
  return stored || null;
}

function encoreDismiss(dismissedAt: number | null) {
  return !!dismissedAt && Date.now() - dismissedAt < DISMISS_GAP_MS;
}

type Nudge = {
  cle: string;
  joursDepuis: number;
  count: number;
  message: string;
  onAgir: () => void;
};

export default function PersonalNudgeAlert({
  currentUserId,
  clients,
  verifications,
  onOpenProspectsARelancer,
  onOpenAuRevoir,
  onOpenAvisClients,
  onOpenClients,
}: {
  currentUserId: string;
  clients: Client[];
  verifications: Verification[];
  onOpenProspectsARelancer: () => void;
  onOpenAuRevoir: () => void;
  onOpenAvisClients: () => void;
  onOpenClients: () => void;
}) {
  const [dismissedVersion, setDismissedVersion] = useState(0);

  if (!currentUserId) return null;

  const dernierePar = (
    par: (c: Client) => string | null,
    dateDe: (c: Client) => string | null
  ): string | null =>
    clients
      .filter((c) => par(c) === currentUserId && dateDe(c))
      .reduce((max: string | null, c) => {
        const d = dateDe(c) as string;
        return !max || d > max ? d : max;
      }, null);

  const clientsVerifies = new Set(verifications.map((v) => v.client_id));
  const derniereVerifPar = verifications
    .filter((v) => v.verifie_par_id === currentUserId && v.date)
    .reduce((max: string | null, v) => (!max || (v.date as string) > max ? (v.date as string) : max), null);

  const candidats: { cle: string; derniere: string | null; count: number; message: (j: number, n: number) => string; onAgir: () => void }[] = [
    {
      cle: "relances",
      derniere: dernierePar((c) => c.dernier_contact_par_id, (c) => c.dernier_contact_date),
      count: clients.filter(estProspectStagnant).length,
      message: (j, n) =>
        `Depuis ${j} jour${j > 1 ? "s" : ""} tu n'as fait aucune relance. Il y a pourtant ${n} prospect${n > 1 ? "s" : ""} qui attend${n > 1 ? "ent" : ""} une relance — souhaites-tu t'en occuper ?`,
      onAgir: onOpenProspectsARelancer,
    },
    {
      cle: "au_revoir",
      derniere: dernierePar((c) => c.au_revoir_envoye_par_id, (c) => c.au_revoir_envoye_le),
      count: clients.filter(estAuRevoirEnAttente).length,
      message: (j, n) =>
        `Depuis ${j} jour${j > 1 ? "s" : ""} tu n'as envoyé aucun message "au revoir". Il y a pourtant ${n} client${n > 1 ? "s" : ""} qui l'attend${n > 1 ? "ent" : ""} — souhaites-tu t'en occuper ?`,
      onAgir: onOpenAuRevoir,
    },
    {
      cle: "avis",
      derniere: dernierePar((c) => c.avis_envoye_par_id, (c) => c.avis_envoye_le),
      count: clients.filter(estAvisEnAttente).length,
      message: (j, n) =>
        `Depuis ${j} jour${j > 1 ? "s" : ""} tu n'as demandé aucun avis Google. Il y a pourtant ${n} client${n > 1 ? "s" : ""} à qui le demander — souhaites-tu t'en occuper ?`,
      onAgir: onOpenAvisClients,
    },
    {
      cle: "verifs",
      derniere: derniereVerifPar,
      count: clients.filter((c) => estDossierNonVerifie(c, clientsVerifies)).length,
      message: (j, n) =>
        `Depuis ${j} jour${j > 1 ? "s" : ""} tu n'as vérifié aucun dossier. Il y a pourtant ${n} dossier${n > 1 ? "s" : ""} de client${n > 1 ? "s" : ""} confirmé${n > 1 ? "s" : ""} pas encore vérifié${n > 1 ? "s" : ""} — souhaites-tu t'en occuper ?`,
      onAgir: onOpenClients,
    },
  ];

  const nudges: Nudge[] = candidats
    .filter((c) => c.derniere !== null && c.count > 0)
    .map((c) => ({
      cle: c.cle,
      joursDepuis: daysSince(c.derniere as string),
      count: c.count,
      message: c.message(daysSince(c.derniere as string), c.count),
      onAgir: c.onAgir,
    }))
    .filter((n) => n.joursDepuis >= SEUIL_INACTIVITE_JOURS)
    .filter((n) => !encoreDismiss(lireDismissedAt(`nudge_dismiss_${currentUserId}_${n.cle}`)))
    .sort((a, b) => b.joursDepuis - a.joursDepuis);

  if (nudges.length === 0) return null;
  const nudge = nudges[0];

  const dismiss = () => {
    window.localStorage.setItem(`nudge_dismiss_${currentUserId}_${nudge.cle}`, String(Date.now()));
    setDismissedVersion((v) => v + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" key={dismissedVersion}>
      <div className="w-full max-w-md rounded-lg border-2 border-[#C9973E] bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#8B4531]">Petit rappel</h2>
        <p className="mt-2 text-sm text-[#171717]">{nudge.message}</p>
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
              nudge.onAgir();
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
