"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AssouanVerification, Profile } from "@/lib/types";

function isEscalationRecipient(p: Profile | undefined) {
  if (!p) return false;
  return p.role === "direction" || (p.prenom || "").trim().toLowerCase() === "sylvie";
}

// Vue Direction/Sylvie : contrairement aux escalades bus/jour, cette
// vérification bloque la confirmation de l'activité tant qu'elle n'est pas
// tranchée — l'employée a coché "j'ai informé le client" pour l'hébergement
// à Assouan (rive vs île/presqu'île/Village Nubien), Sylvie vérifie que
// c'est bien fait avant de valider.
function ActionModal({
  verification,
  resolverName,
  onResolve,
  onDismiss,
}: {
  verification: AssouanVerification;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-600 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-red-600">
            Vérification hébergement Assouan
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
          <strong>{verification.employe_nom}</strong> indique avoir informé{" "}
          <strong>{verification.client_nom || "Sans nom"}</strong> de vérifier la localisation de
          son hôtel à Assouan pour <strong>{verification.nom_activite}</strong> (rive ville ou
          île/presqu&apos;île/côté Village Nubien → navette bateau à réserver auprès de
          l&apos;hôtel).
        </p>
        <p className="mt-2 text-sm text-[#666666]">
          Merci de vérifier que c&apos;est bien fait avant de valider — l&apos;activité ne peut
          pas être confirmée tant que ce n&apos;est pas tranché.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message pour ${verification.employe_nom} (optionnel)`}
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

// Vue employée : la réponse de Sylvie/Direction à sa vérification.
function ResultModal({
  verification,
  onClose,
}: {
  verification: AssouanVerification;
  onClose: () => void;
}) {
  const validee = verification.statut === "validee";
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
          Vérification hébergement Assouan {validee ? "validée" : "refusée"} —{" "}
          {verification.nom_activite}
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          {verification.resolu_par_nom} a {validee ? "validé" : "refusé"} pour{" "}
          <strong>{verification.client_nom || "Sans nom"}</strong>.
          {!validee && " L'activité ne peut pas être confirmée tant que ce n'est pas refait."}
        </p>
        {verification.resolu_message && (
          <p className="mt-2 rounded-md bg-neutral-50 p-3 text-sm text-[#171717]">
            « {verification.resolu_message} »
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

export default function AssouanVerificationCenter({
  profiles,
  currentUserId,
  onPendingChange,
}: {
  profiles: Profile[];
  currentUserId: string;
  onPendingChange?: (items: AssouanVerification[]) => void;
}) {
  const [pending, setPending] = useState<AssouanVerification[]>([]);
  const [myResults, setMyResults] = useState<AssouanVerification[]>([]);
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
          .from("assouan_verifications")
          .select("*")
          .eq("statut", "en_attente")
          .order("created_at", { ascending: true });
        setPending((data as AssouanVerification[]) || []);
      }

      const { data: resolved } = await supabase
        .from("assouan_verifications")
        .select("*")
        .eq("employe_id", currentUserId)
        .neq("statut", "en_attente")
        .order("resolu_at", { ascending: true });
      setMyResults((resolved as AssouanVerification[]) || []);
    };

    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [currentUserId, canResolve]);

  const resolve = async (
    verification: AssouanVerification,
    statut: "validee" | "refusee",
    message: string
  ) => {
    const supabase = createClient();
    await supabase
      .from("assouan_verifications")
      .update({
        statut,
        resolu_par: currentUserId,
        resolu_par_nom: resolverName,
        resolu_message: message,
        resolu_at: new Date().toISOString(),
      })
      .eq("id", verification.id)
      .eq("statut", "en_attente");
    setPending((prev) => prev.filter((e) => e.id !== verification.id));
  };

  const unseenResult = myResults.find((e) => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(`assouan-verification-seen-${e.id}`);
  });

  const visiblePending = pending.filter((e) => !dismissedIds.has(e.id));

  if (canResolve && visiblePending.length > 0) {
    const current = visiblePending[0];
    return (
      <ActionModal
        verification={current}
        resolverName={resolverName}
        onResolve={(statut, message) => resolve(current, statut, message)}
        onDismiss={() => setDismissedIds((prev) => new Set(prev).add(current.id))}
      />
    );
  }

  if (unseenResult) {
    return (
      <ResultModal
        verification={unseenResult}
        onClose={() => {
          localStorage.setItem(`assouan-verification-seen-${unseenResult.id}`, "1");
          setMyResults((prev) => [...prev]);
        }}
      />
    );
  }

  return null;
}
