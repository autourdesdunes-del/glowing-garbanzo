"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RemarqueEmployee } from "@/lib/types";

// Remarque écrite par Sylvie/Direction (voir ManagerView) et affichée ici,
// en privé, à l'employée concernée dès sa prochaine connexion — pensé pour
// rester discret : pas de nom d'auteur affiché, pas de popup visible pour
// qui que ce soit d'autre.
function RemarqueModal({ remarque, onClose }: { remarque: RemarqueEmployee; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border-2 border-[#C9973E] bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#8B4531]">Remarque</h2>
        {remarque.client_nom && (
          <p className="mt-1 text-xs text-neutral-400">À propos du dossier {remarque.client_nom}</p>
        )}
        <p className="mt-2 whitespace-pre-wrap text-sm text-[#171717]">{remarque.message}</p>
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

export default function RemarqueEmployeeCenter({ currentUserId }: { currentUserId: string }) {
  const [pending, setPending] = useState<RemarqueEmployee[]>([]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();

    const check = async () => {
      const { data } = await supabase
        .from("remarques_employe")
        .select("*")
        .eq("employe_id", currentUserId)
        .eq("lu", false)
        .order("created_at", { ascending: true });
      setPending((data as RemarqueEmployee[]) || []);
    };

    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [currentUserId]);

  const acknowledge = async (remarque: RemarqueEmployee) => {
    const supabase = createClient();
    setPending((prev) => prev.filter((r) => r.id !== remarque.id));
    await supabase
      .from("remarques_employe")
      .update({ lu: true, lu_at: new Date().toISOString() })
      .eq("id", remarque.id);
  };

  if (pending.length === 0) return null;
  return <RemarqueModal remarque={pending[0]} onClose={() => acknowledge(pending[0])} />;
}
