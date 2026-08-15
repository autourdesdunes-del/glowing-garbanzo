"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BusEscalation, Profile } from "@/lib/types";
import { isFamilySafariBedouin } from "@/lib/resa";

function isEscalationRecipient(p: Profile | undefined) {
  if (!p) return false;
  return p.role === "direction" || (p.prenom || "").trim().toLowerCase() === "sylvie";
}

// Vue Direction/Sylvie : une escalade "client ne veut pas le mini-bus" à
// valider ou refuser. On peut la remettre à plus tard (✕) sans la
// résoudre — sinon un compte qui est à la fois testeur et validateur (ex.
// Direction) se retrouve bloqué par sa propre escalade de test.
function ActionModal({
  escalation,
  resolverName,
  onResolve,
  onDismiss,
}: {
  escalation: BusEscalation;
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

  // Cette même table sert aussi pour le Grand Safari Bédouin demandé par un
  // groupe 100% adultes (voir AddActivityWizard.tsx) — texte différent
  // selon le cas, sinon le popup parle de mini-bus pour une escalade qui
  // n'a rien à voir.
  const isSafari = isFamilySafariBedouin(escalation.nom_activite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-red-600 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-red-600">
            {isSafari ? "Escalade Grand Safari Bédouin" : "Escalade formule bus"}
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
          {isSafari ? (
            <>
              <strong>{escalation.employe_nom}</strong> indique que le client{" "}
              <strong>{escalation.client_nom || "Sans nom"}</strong> préfère quand même le{" "}
              <strong>{escalation.nom_activite}</strong> malgré un groupe 100% adultes (formule
              pensée pour les familles).
            </>
          ) : (
            <>
              <strong>{escalation.employe_nom}</strong> a indiqué que le client{" "}
              <strong>{escalation.client_nom || "Sans nom"}</strong> ne souhaite pas la formule
              mini-bus pour <strong>{escalation.nom_activite}</strong>.
            </>
          )}
        </p>
        <p className="mt-2 text-sm text-[#666666]">
          Merci de vérifier dans la conversation que cela a bien été demandé par le client.
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

// Vue employée : la réponse à sa demande d'escalade.
function ResultModal({ escalation, onClose }: { escalation: BusEscalation; onClose: () => void }) {
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
          Escalade {validee ? "validée" : "refusée"} — {escalation.nom_activite}
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          {escalation.resolu_par_nom} a {validee ? "validé" : "refusé"} votre demande pour{" "}
          <strong>{escalation.client_nom || "Sans nom"}</strong>.
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

export default function BusEscalationCenter({
  profiles,
  currentUserId,
  onPendingChange,
}: {
  profiles: Profile[];
  currentUserId: string;
  onPendingChange?: (items: BusEscalation[]) => void;
}) {
  const [pending, setPending] = useState<BusEscalation[]>([]);
  const [myResults, setMyResults] = useState<BusEscalation[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const myProfile = profiles.find((p) => p.id === currentUserId);
  const canResolve = isEscalationRecipient(myProfile);
  const resolverName = myProfile?.prenom || "Quelqu'un de l'équipe";

  // Rapporté à AppShell pour la cloche de la rubrique Manager (liste des
  // autorisations en attente) — évite de refaire une requête identique.
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
          .from("bus_escalations")
          .select("*")
          .eq("statut", "en_attente")
          .order("created_at", { ascending: true });
        setPending((data as BusEscalation[]) || []);
      }

      const { data: resolved } = await supabase
        .from("bus_escalations")
        .select("*")
        .eq("employe_id", currentUserId)
        .neq("statut", "en_attente")
        .order("resolu_at", { ascending: true });
      setMyResults((resolved as BusEscalation[]) || []);
    };

    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [currentUserId, canResolve]);

  const resolve = async (escalation: BusEscalation, statut: "validee" | "refusee", message: string) => {
    const supabase = createClient();
    await supabase
      .from("bus_escalations")
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
    return !localStorage.getItem(`bus-escalation-seen-${e.id}`);
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
          localStorage.setItem(`bus-escalation-seen-${unseenResult.id}`, "1");
          setMyResults((prev) => [...prev]);
        }}
      />
    );
  }

  return null;
}
