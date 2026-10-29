"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client, ClientHotel, PlanningShift, Reservation, Verification } from "@/lib/types";
import { addDays, todayStr } from "@/lib/dates";
import { infosManquantesToutes } from "@/lib/infosManquantes";
import {
  journeeTermineeMessage,
  ligneAvertissement2eRappel,
  ligneBravoDernierJour,
  ligneDossierIncomplet,
  ligneEncouragementProche,
  ligneProgressionAujourdhui,
  ligneQuotaExplication,
} from "@/lib/luisMessages";

const QUOTA_VERIFS_JOUR = 3;
const INTERVALLE_RAPPEL_MS = 90 * 60 * 1000;
const URGENCE_DUREE_MS = 10 * 60 * 1000;
const VERIF_CHECK_MS = 60 * 1000;

type LuisEtat = {
  id: string;
  user_id: string;
  date: string;
  rappels_envoyes: number;
  dernier_rappel_at: string | null;
  urgence_jusqua: string | null;
};

// "Luis", le coéquipier CRM qui rappelle de faire les 3 vérifications de
// dossier quotidiennes — demande de Mélanie, 2026-10-29. Popup toutes les
// 1h30 pendant le shift de la personne (voir planning.ts) tant que le
// quota du jour n'est pas atteint : 1er rappel normal, 2e avec
// avertissement, 3e qui force la navigation vers Suivis > Vérification de
// dossier (garde de sortie gérée par le parent via onGardeChange, voir
// AppShell.tsx — elle empêche de quitter cette page tant que ce n'est pas
// fait, avec une échappatoire "Urgence en cours" qui débloque 10 minutes
// puis se reverrouille automatiquement, sans validation de Mélanie).
export default function LuisAssistant({
  userId,
  monPrenom,
  clients,
  reservations,
  verifications,
  planningShifts,
  clientHotels,
  onForcerVerifDossier,
  onGardeChange,
}: {
  userId: string;
  monPrenom: string;
  clients: Client[];
  reservations: Reservation[];
  verifications: Verification[];
  planningShifts: PlanningShift[];
  clientHotels: Record<string, ClientHotel[]>;
  onForcerVerifDossier: () => void;
  onGardeChange: (actif: boolean) => void;
}) {
  const supabase = createClient();
  const [etat, setEtat] = useState<LuisEtat | null>(null);
  const [popup, setPopup] = useState<{ stage: 1 | 2 | "bravo"; intro: boolean } | null>(null);
  const today = todayStr();
  // Présentation + explication du rôle, une seule fois dans la vie de
  // chaque employée (stockée en local, même principe que le dismiss de
  // PersonalNudgeAlert) — demande de Mélanie, 2026-10-29.
  const introKey = `luis_intro_vue_${userId}`;

  const chargerEtat = async () => {
    const { data } = await supabase
      .from("luis_etat")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (data) {
      setEtat(data as LuisEtat);
      return data as LuisEtat;
    }
    const { data: cree } = await supabase
      .from("luis_etat")
      .insert({ user_id: userId, date: today, rappels_envoyes: 0 })
      .select()
      .single();
    setEtat(cree as LuisEtat);
    return cree as LuisEtat;
  };

  useEffect(() => {
    if (!userId) return;
    chargerEtat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const quotaFait = verifications.filter((v) => v.nom === monPrenom && v.date === today).length;
  const urgenceActive = !!etat?.urgence_jusqua && new Date(etat.urgence_jusqua).getTime() > Date.now();
  const gardeActive = !!etat && etat.rappels_envoyes >= 3 && quotaFait < QUOTA_VERIFS_JOUR && !urgenceActive;

  useEffect(() => {
    onGardeChange(gardeActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gardeActive]);

  // Félicitations dès que le quota du jour est atteint — une seule fois
  // (stocké en local, par jour) même si elle en fait plus de 3 ensuite —
  // demande de Mélanie, 2026-10-29.
  useEffect(() => {
    if (!userId || quotaFait < QUOTA_VERIFS_JOUR) return;
    const bravoKey = `luis_bravo_vu_${userId}_${today}`;
    if (window.localStorage.getItem(bravoKey)) return;
    window.localStorage.setItem(bravoKey, "1");
    setPopup({ stage: "bravo", intro: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, quotaFait, today]);

  const estEnShift = (() => {
    const heure = new Date().toTimeString().slice(0, 5);
    return planningShifts.some(
      (s) =>
        s.user_id === userId &&
        s.date === today &&
        s.statut === "travail" &&
        ((s.shift_debut && s.shift_fin && s.shift_debut <= heure && heure <= s.shift_fin) ||
          (s.shift2_debut && s.shift2_fin && s.shift2_debut <= heure && heure <= s.shift2_fin))
    );
  })();

  useEffect(() => {
    if (!etat || !userId || quotaFait >= QUOTA_VERIFS_JOUR) return;
    const verifierDeclenchement = () => {
      if (!estEnShift) return;
      const dernier = etat.dernier_rappel_at ? new Date(etat.dernier_rappel_at).getTime() : 0;
      if (Date.now() - dernier < INTERVALLE_RAPPEL_MS) return;
      const prochainStage = etat.rappels_envoyes + 1;
      supabase
        .from("luis_etat")
        .update({ rappels_envoyes: prochainStage, dernier_rappel_at: new Date().toISOString() })
        .eq("id", etat.id)
        .then(() => chargerEtat());
      if (prochainStage >= 3) {
        onForcerVerifDossier();
      } else {
        const introDejaVue = window.localStorage.getItem(introKey);
        if (!introDejaVue) window.localStorage.setItem(introKey, "1");
        setPopup({ stage: prochainStage as 1 | 2, intro: !introDejaVue });
      }
    };
    verifierDeclenchement();
    const interval = setInterval(verifierDeclenchement, VERIF_CHECK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat?.id, etat?.dernier_rappel_at, etat?.rappels_envoyes, estEnShift, quotaFait]);

  const debloquerUrgence = async () => {
    if (!etat) return;
    const jusqua = new Date(Date.now() + URGENCE_DUREE_MS).toISOString();
    await supabase.from("luis_etat").update({ urgence_jusqua: jusqua }).eq("id", etat.id);
    chargerEtat();
  };

  if (gardeActive) {
    return (
      <div className="fixed bottom-4 right-4 z-[60] w-80 rounded-lg border-2 border-[#C9973E] bg-white p-4 shadow-xl">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#C9973E] text-lg">
            🦦
          </div>
          <p className="font-heading text-sm font-semibold text-[#8B4531]">Luis</p>
        </div>
        <p className="mb-3 text-sm text-[#171717]">
          Encore {QUOTA_VERIFS_JOUR - quotaFait} vérification{QUOTA_VERIFS_JOUR - quotaFait > 1 ? "s" : ""} à faire
          avant de repartir — {ligneEncouragementProche(QUOTA_VERIFS_JOUR - quotaFait)}
        </p>
        <button
          type="button"
          onClick={debloquerUrgence}
          className="w-full rounded-md border border-[#171717]/20 px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#fafafa]"
        >
          🚨 Urgence en cours — débloquer 10 min
        </button>
      </div>
    );
  }

  if (!popup) return null;

  if (popup.stage === "bravo") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center gap-3 bg-[#0F5C56] px-5 py-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#C9973E] text-2xl">
              🦦
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Luis</p>
              <p className="text-xs text-[#CDE6E0]">ton coéquipier CRM</p>
            </div>
          </div>
          <div className="p-5">
            <p className="mb-4 text-sm leading-relaxed text-[#171717]">
              {monPrenom} — {journeeTermineeMessage()}
            </p>
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="w-full rounded-lg bg-[#171717] px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Merci Luis 🙌
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hier = addDays(today, -1);
  const dernierJourTravaille = planningShifts
    .filter((s) => s.user_id === userId && s.statut === "travail" && s.date < today)
    .map((s) => s.date)
    .sort()
    .pop();
  const reservationsDernierJour = dernierJourTravaille
    ? reservations.filter(
        (r) => r.cree_par_id === userId && (r.created_at || "").slice(0, 10) === dernierJourTravaille
      ).length
    : 0;
  const reservationsAujourdhui = reservations.filter(
    (r) => r.cree_par_id === userId && (r.created_at || "").slice(0, 10) === today
  ).length;

  const in3Jours = addDays(today, 3);
  const dossierIncomplet = clients
    .filter(
      (c) =>
        c.statut === "Client confirmé" &&
        c.date_debut &&
        c.date_debut >= today &&
        c.date_debut <= in3Jours &&
        infosManquantesToutes(c, reservations, [], clientHotels?.[c.id] || []).length > 0
    )
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""))[0];

  const premierPrenomNom = (nom: string) => (nom || "").trim().split(/\s+/)[0] || "ce client";

  // Si elle était off la veille (congé/repos), on cite le jour exact du
  // dernier travail ("lundi") plutôt qu'un vague "la dernière fois" —
  // demande de Mélanie, 2026-10-29.
  const labelDernierJour =
    dernierJourTravaille === hier
      ? "hier"
      : dernierJourTravaille
        ? new Date(dernierJourTravaille + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long" })
        : "";

  const ligneBravo =
    popup.stage === 1 && labelDernierJour
      ? ligneBravoDernierJour(monPrenom, reservationsDernierJour, labelDernierJour, !popup.intro)
      : null;
  const ligneProgression = popup.stage === 2 ? ligneProgressionAujourdhui(monPrenom, reservationsAujourdhui) : null;

  const fermer = () => setPopup(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-3 bg-[#0F5C56] px-5 py-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#C9973E] text-2xl">
            🦦
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Luis</p>
            <p className="text-xs text-[#CDE6E0]">ton coéquipier CRM</p>
          </div>
        </div>
        <div className="p-5">
          {popup.intro && (
            <p className="mb-3 text-sm leading-relaxed text-[#171717]">
              👋 Salut {monPrenom}, moi c&apos;est Luis, ton coéquipier CRM ! Je suis là pour t&apos;aider à garder le rythme
              sans que tu aies à tout retenir par cœur. Je passerai de temps en temps faire un point avec toi —
              jamais pour te mettre la pression, juste pour qu&apos;on n&apos;oublie rien ensemble 😊
            </p>
          )}
          {(ligneBravo || ligneProgression) && (
            <p className="mb-3 text-sm leading-relaxed text-[#171717]">{ligneBravo || ligneProgression}</p>
          )}
          {dossierIncomplet && (
            <p className="mb-3 text-sm leading-relaxed text-[#171717]">
              {ligneDossierIncomplet(
                premierPrenomNom(dossierIncomplet.nom),
                `arrivée ${dossierIncomplet.date_debut === today ? "aujourd'hui" : "bientôt"}, dossier incomplet.`
              )}
            </p>
          )}
          <p className="mb-3 text-xs leading-relaxed text-neutral-500">{ligneQuotaExplication()}</p>
          {popup.stage === 2 && (
            <div className="mb-4 rounded-r-lg border-l-[3px] border-[#BA7517] bg-[#FAEEDA] px-3.5 py-2.5">
              <p className="text-xs leading-relaxed text-[#633806]">{ligneAvertissement2eRappel()}</p>
            </div>
          )}
          <div className="mb-4 rounded-lg bg-[#F2E6D2] px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-[#5C2A1D]">Vérifications du jour</span>
              <span className="text-sm font-medium text-[#5C2A1D]">
                {quotaFait}/{QUOTA_VERIFS_JOUR}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: QUOTA_VERIFS_JOUR }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < quotaFait ? "bg-[#0F5C56]" : "bg-[#E3D4B8]"}`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                fermer();
                onForcerVerifDossier();
              }}
              className="flex-1 rounded-lg bg-[#171717] px-3 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              C&apos;est parti 🚀
            </button>
            <button
              type="button"
              onClick={fermer}
              className="rounded-lg border border-[#D8D2C4] px-3.5 py-2.5 text-sm text-neutral-600 hover:bg-[#fafafa]"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
