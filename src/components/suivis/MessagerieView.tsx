"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessagerieConversation, MessagerieMessage } from "@/lib/types";

// Boîte de réception des conversations escaladées depuis l'arbre d'aide
// (BRIEF_MESSAGERIE.md) — quand un client ne trouve pas sa réponse dans
// l'arbre, côté fiche publique ou espace client. Autonome, même pattern
// que DemandesSiteView/HotelsAValiderView juste au-dessus dans ce
// sous-menu : se recharge lui-même plutôt que de passer par AppShell.
export default function MessagerieView() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<MessagerieConversation[] | null>(null);
  const [messages, setMessages] = useState<Record<string, MessagerieMessage[]>>({});
  const [filtre, setFiltre] = useState<"nouvelle" | "toutes">("nouvelle");
  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const [reponseDraft, setReponseDraft] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    supabase
      .from("messagerie_conversations")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setConversations((data as MessagerieConversation[]) || []));
  }, [supabase]);

  async function ouvrir(id: string) {
    setOuverteId(id);
    if (messages[id]) return;
    const { data } = await supabase
      .from("messagerie_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((prev) => ({ ...prev, [id]: (data as MessagerieMessage[]) || [] }));
  }

  async function envoyerReponse(conv: MessagerieConversation) {
    if (!reponseDraft.trim()) return;
    setEnvoiEnCours(true);
    const { data, error } = await supabase
      .from("messagerie_messages")
      .insert({ conversation_id: conv.id, auteur: "equipe", contenu: reponseDraft.trim() })
      .select()
      .single();
    if (!error && data) {
      setMessages((prev) => ({ ...prev, [conv.id]: [...(prev[conv.id] || []), data as MessagerieMessage] }));
      await supabase.from("messagerie_conversations").update({ statut: "traitee" }).eq("id", conv.id);
      setConversations((prev) =>
        (prev || []).map((c) => (c.id === conv.id ? { ...c, statut: "traitee" } : c))
      );
      setReponseDraft("");
      // Email au client si on a une adresse — jamais bloquant si l'envoi
      // échoue (RESEND_API_KEY absente ou pas d'email saisi).
      if (conv.email) {
        fetch("/api/messagerie/repondre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: conv.email, nom: conv.nom, contenu: reponseDraft.trim() }),
        }).catch(() => {});
      }
    }
    setEnvoiEnCours(false);
  }

  async function marquerTraitee(id: string) {
    setConversations((prev) => (prev || []).map((c) => (c.id === id ? { ...c, statut: "traitee" } : c)));
    await supabase.from("messagerie_conversations").update({ statut: "traitee" }).eq("id", id);
  }

  if (conversations === null) {
    return <div className="p-4 sm:p-6 text-sm text-neutral-400">Chargement…</div>;
  }

  const visibles = conversations.filter((c) => (filtre === "nouvelle" ? c.statut === "nouvelle" : true));
  const nbNouvelles = conversations.filter((c) => c.statut === "nouvelle").length;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[#171717]">Messagerie</h2>
        {nbNouvelles > 0 && (
          <span className="rounded-full bg-[#D6544A] px-2 py-0.5 text-xs font-semibold text-white">
            {nbNouvelles} nouvelle{nbNouvelles > 1 ? "s" : ""}
          </span>
        )}
        <div className="ml-auto flex gap-1 rounded-full bg-neutral-100 p-1 text-xs">
          <button
            onClick={() => setFiltre("nouvelle")}
            className={`rounded-full px-3 py-1 font-medium ${filtre === "nouvelle" ? "bg-white shadow-sm" : "text-neutral-500"}`}
          >
            Nouvelles
          </button>
          <button
            onClick={() => setFiltre("toutes")}
            className={`rounded-full px-3 py-1 font-medium ${filtre === "toutes" ? "bg-white shadow-sm" : "text-neutral-500"}`}
          >
            Toutes
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Aucune conversation escaladée depuis l&apos;arbre d&apos;aide pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map((c) => (
            <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#171717]">{c.nom || "Sans nom"}</div>
                  <div className="text-xs text-neutral-500">
                    {c.email}
                    {c.email && c.telephone && " · "}
                    {c.telephone}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.statut === "traitee" ? "bg-[#3E8F5C]/10 text-[#2C6B44]" : "bg-[#D6544A]/10 text-[#D6544A]"
                  }`}
                >
                  {c.statut === "traitee" ? "Traitée" : "Nouvelle"}
                </span>
              </div>

              {c.chemin_parcouru && (
                <p className="mt-2 text-xs text-neutral-500">
                  A consulté : <span className="italic">{c.chemin_parcouru}</span>
                </p>
              )}

              {ouverteId === c.id ? (
                <div className="mt-3 space-y-2">
                  {(messages[c.id] || []).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        m.auteur === "equipe" ? "bg-[#0F5C56]/5 text-[#0F5C56]" : "bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      {m.contenu}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <input
                      value={reponseDraft}
                      onChange={(e) => setReponseDraft(e.target.value)}
                      placeholder="Répondre…"
                      className="flex-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => envoyerReponse(c)}
                      disabled={envoiEnCours || !reponseDraft.trim()}
                      className="rounded-full bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => ouvrir(c.id)}
                    className="rounded-lg bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Ouvrir
                  </button>
                  {c.statut === "nouvelle" && (
                    <button
                      onClick={() => marquerTraitee(c.id)}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
                    >
                      Marquer traitée
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
