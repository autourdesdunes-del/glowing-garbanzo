"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JourEscalation, Profile } from "@/lib/types";

function isEscalationRecipient(p: Profile | undefined) {
  if (!p) return false;
  return p.role === "direction" || (p.prenom || "").trim().toLowerCase() === "sylvie";
}

// Vue Direction/Sylvie : une demande d'autorisation "date hors jours
// disponibles" à valider ou refuser.
function ActionModal({
  escalation,
  resolverName,
  onResolve,
  onDismiss,
}: {
  escalation: JourEscalation;
  resolverName: string;
  onResolve: (statut: "validee" | "refusee", message: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (statut: "validee" | "refusee") => {
    setSubmitting(true);
    await onResolve(statut, message.trim());
  };

  const dateLabel = escalation.date_choisie
    ? new Date(escalation.date_choisie + "T00:00:00").toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-600 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-red-600">
            Demande de date hors jours disponibles
          </h2>
          <button
            type="button"
            onClick={onDismiss}
            className="text-neutral-400 hover:text-[#171717]"
            aria-label="Plus tard"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-[#171717]">
          <strong>{escalation.employe_nom}</strong> demande à confirmer{" "}
          <strong>{escalation.nom_activite}</strong> le <strong>{dateLabel}</strong> (
          {escalation.jour_choisi}) pour le client{" "}
          <strong>{escalation.client_nom || "Sans nom"}</strong>, alors que cette activité n&apos;a
          normalement lieu que le {escalation.jours_disponibles.join(", ") || "—"}.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message pour ${escalation.employe_nom} (optionnel)`}
          rows={2}
          className="input mt-3 w-full"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit("refusee")}
            className="flex-1 rounded-md border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Refuser
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit("validee")}
            className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Valider
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-400">Traité par {resolverName}</p>
      </div>
    </div>
  );
}

// Vue employée : la réponse à sa demande.
function ResultModal({ escalation, onClose }: { escalation: JourEscalation; onClose: () => void }) {
  const validee = escalation.statut === "validee";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full max-w-md rounded-lg border-2 bg-white p-5 shadow-xl ${
          validee ? "border-emerald-600" : "border-red-600"
        }`}
      >
        <h2
          className={`font-heading text-base font-semibold ${
            validee ? "text-emerald-600" : "text-red-600"
          }`}
        >
          Demande {validee ? "validée" : "refusée"} — {escalation.nom_activite}
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          {escalation.resolu_par_nom} a {validee ? "validé" : "refusé"} la date pour{" "}
          <strong>{escalation.client_nom || "Sans nom"}</strong>.
          {!validee && " Merci de corriger la date de cette activité."}
        </p>
        {escalation.resolu_message && (
          <p className="mt-2 rounded-md bg-neutral-50 p-3 text-sm text-[#171717]">
            « {escalation.resolu_message} »
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default function JourEscalationCenter({
  profiles,
  currentUserId,
  onPendingChange,
}: {
  profiles: Profile[];
  currentUserId: string;
  onPendingChange?: (items: JourEscalation[]) => void;
}) {
  const [pending, setPending] = useState<JourEscalation[]>([]);
  const [myResults, setMyResults] = useState<JourEscalation[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const myProfile = profiles.find((p) => p.id === currentUserId);
  const canResolve = isEscalationRecipient(myProfile);
  const resolverName = myProfile?.prenom || "Quelqu'un de l'équipe";

  useEffect(() => {
    onPendingChange?.(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();

    const check = async () => {
      if (canResolve) {
        const { data } = await supabase
          .from("jour_escalations")
          .select("*")
          .eq("statut", "en_attente")
          .order("created_at", { ascending: true });
        setPending((data as JourEscalation[]) || []);
      }

      const { data: resolved } = await supabase
        .from("jour_escalations")
        .select("*")
        .eq("employe_id", currentUserId)
        .neq("statut", "en_attente")
        .order("resolu_at", { ascending: true });
      setMyResults((resolved as JourEscalation[]) || []);
    };

    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [currentUserId, canResolve]);

  const resolve = async (escalation: JourEscalation, statut: "validee" | "refusee", message: string) => {
    const supabase = createClient();
    await supabase
      .from("jour_escalations")
      .update({
        statut,
        resolu_par: currentUserId,
        resolu_par_nom: resolverName,
        resolu_message: message,
        resolu_at: new Date().toISOString(),
      })
      .eq("id", escalation.id)
      .eq("statut", "en_attente");
    setPending((prev) => prev.filter((e) => e.id !== escalation.id));
  };

  const unseenResult = myResults.find((e) => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(`jour-escalation-seen-${e.id}`);
  });

  const visiblePending = pending.filter((e) => !dismissedIds.has(e.id));

  if (canResolve && visiblePending.length > 0) {
    const current = visiblePending[0];
    return (
      <ActionModal
        escalation={current}
        resolverName={resolverName}
        onResolve={(statut, message) => resolve(current, statut, message)}
        onDismiss={() => setDismissedIds((prev) => new Set(prev).add(current.id))}
      />
    );
  }

  if (unseenResult) {
    return (
      <ResultModal
        escalation={unseenResult}
        onClose={() => {
          localStorage.setItem(`jour-escalation-seen-${unseenResult.id}`, "1");
          setMyResults((prev) => [...prev]);
        }}
      />
    );
  }

  return null;
}
