"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BusEscalation, Profile } from "@/lib/types";

function isEscalationRecipient(p: Profile | undefined) {
  if (!p) return false;
  return p.role === "direction" || (p.prenom || "").trim().toLowerCase() === "sylvie";
}

// Vue Direction/Sylvie : une escalade "client ne veut pas le mini-bus" à
// valider ou refuser. Fenêtre bloquante volontairement (pas de bouton
// fermer) — la demande doit être traitée, pas juste vue.
function ActionModal({
  escalation,
  resolverName,
  onResolve,
}: {
  escalation: BusEscalation;
  resolverName: string;
  onResolve: (statut: "validee" | "refusee", message: string) => Promise<void>;
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
        <h2 className="font-heading text-base font-semibold text-red-600">
          Escalade formule bus
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          <strong>{escalation.employe_nom}</strong> a indiqué que le client{" "}
          <strong>{escalation.client_nom || "Sans nom"}</strong> ne souhaite pas la formule
          mini-bus pour <strong>{escalation.nom_activite}</strong>.
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
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const [pending, setPending] = useState<BusEscalation[]>([]);
  const [myResults, setMyResults] = useState<BusEscalation[]>([]);

  const myProfile = profiles.find((p) => p.id === currentUserId);
  const canResolve = isEscalationRecipient(myProfile);
  const resolverName = myProfile?.prenom || "Quelqu'un de l'équipe";

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

  if (canResolve && pending.length > 0) {
    return (
      <ActionModal
        escalation={pending[0]}
        resolverName={resolverName}
        onResolve={(statut, message) => resolve(pending[0], statut, message)}
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
