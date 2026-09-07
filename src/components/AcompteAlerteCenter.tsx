"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AcompteAlerte, Profile } from "@/lib/types";

function isEscalationRecipient(p: Profile | undefined) {
  if (!p) return false;
  return p.role === "direction" || (p.prenom || "").trim().toLowerCase() === "sylvie";
}

function euros(n: number) {
  return n.toLocaleString("fr-FR");
}

// Vue Direction/Sylvie : simple prise de connaissance, rien à trancher —
// l'employée a déjà validé l'acompte malgré l'alerte, le vol suit son
// cours. Contrairement à BusEscalationCenter/JourEscalationCenter, un seul
// bouton "OK, compris" (comme RemarqueEmployeeCenter).
function AlerteModal({ alerte, onClose }: { alerte: AcompteAlerte; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-[#C9973E] bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#8B4531]">
          Acompte sous le minimum — {alerte.nom_activite}
        </h2>
        <p className="mt-2 text-sm text-[#171717]">
          <strong>{alerte.employe_nom}</strong> a validé un acompte de{" "}
          <strong>{euros(alerte.montant_saisi)} €</strong> pour{" "}
          <strong>{alerte.client_nom || "Sans nom"}</strong>, sous le minimum requis de{" "}
          <strong>{euros(alerte.montant_minimum)} €</strong> — malgré l&apos;alerte affichée.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          OK, compris
        </button>
      </div>
    </div>
  );
}

export default function AcompteAlerteCenter({
  profiles,
  currentUserId,
  onPendingChange,
}: {
  profiles: Profile[];
  currentUserId: string;
  onPendingChange?: (items: AcompteAlerte[]) => void;
}) {
  const [pending, setPending] = useState<AcompteAlerte[]>([]);

  const myProfile = profiles.find((p) => p.id === currentUserId);
  const canSee = isEscalationRecipient(myProfile);
  const resolverName = myProfile?.prenom || "Quelqu'un de l'équipe";

  useEffect(() => {
    onPendingChange?.(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!currentUserId || !canSee) return;
    const supabase = createClient();

    const check = async () => {
      const { data } = await supabase
        .from("acompte_alertes")
        .select("*")
        .eq("vu", false)
        .order("created_at", { ascending: true });
      setPending((data as AcompteAlerte[]) || []);
    };

    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [currentUserId, canSee]);

  const acknowledge = async (alerte: AcompteAlerte) => {
    const supabase = createClient();
    setPending((prev) => prev.filter((a) => a.id !== alerte.id));
    await supabase
      .from("acompte_alertes")
      .update({ vu: true, vu_par_nom: resolverName, vu_at: new Date().toISOString() })
      .eq("id", alerte.id);
  };

  if (!canSee || pending.length === 0) return null;
  return <AlerteModal alerte={pending[0]} onClose={() => acknowledge(pending[0])} />;
}
