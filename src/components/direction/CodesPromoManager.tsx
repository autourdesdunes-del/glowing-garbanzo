"use client";

import { useEffect, useMemo, useState } from "react";
import { CodePromo } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

// Codes de réduction que la Direction ajoute ici — consultables en lecture
// seule par l'équipe dans HELP > Codes promo, pour vérifier qu'un code
// donné par un client est valide.
export default function CodesPromoManager() {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [codes, setCodes] = useState<CodePromo[]>([]);
  const [nouveauCode, setNouveauCode] = useState("");
  const [nouvelleDescription, setNouvelleDescription] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("codes_promo").select("*").order("created_at", { ascending: false });
      setCodes((data as CodePromo[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ajouterCode = async () => {
    const code = nouveauCode.trim();
    if (!code) return;
    const { data, error } = await supabase
      .from("codes_promo")
      .insert({ code, description: nouvelleDescription.trim() })
      .select()
      .single();
    if (error) {
      toast("Échec de l'ajout du code.");
      return;
    }
    setCodes((prev) => [data as CodePromo, ...prev]);
    setNouveauCode("");
    setNouvelleDescription("");
  };

  const toggleActif = async (c: CodePromo) => {
    setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, actif: !x.actif } : x)));
    const { error } = await supabase.from("codes_promo").update({ actif: !c.actif }).eq("id", c.id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const supprimerCode = async (id: string) => {
    setCodes((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("codes_promo").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">Codes promo</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Visibles par l&apos;équipe en lecture seule dans HELP &gt; Codes promo.
        </p>
      </div>

      <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={nouveauCode}
            onChange={(e) => setNouveauCode(e.target.value)}
            placeholder="Code (ex. MIL10)"
            className="input sm:w-48"
          />
          <input
            value={nouvelleDescription}
            onChange={(e) => setNouvelleDescription(e.target.value)}
            placeholder="Description (ex. -10% fidélité)"
            className="input flex-1"
          />
        </div>
        <button
          type="button"
          disabled={!nouveauCode.trim()}
          onClick={ajouterCode}
          className="mt-2 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Ajouter le code
        </button>
      </div>

      {codes.length === 0 ? (
        <p className="text-sm text-neutral-400">Aucun code pour l&apos;instant.</p>
      ) : (
        <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
          {codes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#171717]">{c.code}</p>
                {c.description && <p className="text-xs text-[#666666]">{c.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActif(c)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    c.actif ? "bg-[#0F5C56]/10 text-[#0F5C56]" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {c.actif ? "Actif" : "Inactif"}
                </button>
                <button
                  type="button"
                  onClick={() => supprimerCode(c.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
