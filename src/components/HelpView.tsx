"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArbreNoeud, CodePromo, HotelReference, TransfertTaxe } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import TransfertTaxeModificationRequestModal from "@/components/TransfertTaxeModificationRequestModal";

const VILLES = [
  "Hurghada",
  "El Gouna",
  "Makadi Bay",
  "Soma Bay",
  "Sahl Hasheesh",
  "Marsa Alam",
  "Le Caire",
  "Louxor",
  "Assouan",
  "Autre",
];

export default function HelpView({ tab }: { tab: "hotels" | "taxes" | "promos" | "arbre" }) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [hotels, setHotels] = useState<HotelReference[]>([]);
  const [hotelSearch, setHotelSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [taxes, setTaxes] = useState<TransfertTaxe[]>([]);
  const [codesPromo, setCodesPromo] = useState<CodePromo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newHotelNom, setNewHotelNom] = useState("");
  const [newHotelVille, setNewHotelVille] = useState("Hurghada");
  const [newHotelVilleAutre, setNewHotelVilleAutre] = useState("");
  const [addHotelOpen, setAddHotelOpen] = useState(false);
  const [taxesOuvertes, setTaxesOuvertes] = useState<Record<string, boolean>>({});
  const [taxeRequestOpen, setTaxeRequestOpen] = useState(false);
  const [noeuds, setNoeuds] = useState<ArbreNoeud[]>([]);
  const [editNoeudId, setEditNoeudId] = useState<string | null>(null);
  const [nouveauNoeudParent, setNouveauNoeudParent] = useState("");

  const submitTaxeModificationRequest = async (payload: {
    transfertTaxeId: string | null;
    ville: string;
    trancheLabel: string;
    explication: string;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const demandeurNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    const { error } = await supabase.from("transfert_taxe_modification_requests").insert({
      transfert_taxe_id: payload.transfertTaxeId,
      ville: payload.ville,
      tranche_label: payload.trancheLabel,
      explication: payload.explication,
      demandeur_id: user.id,
      demandeur_nom: demandeurNom,
    });
    if (error) {
      toast("Échec de l'envoi de la demande.");
      return;
    }
    toast("Demande envoyée à la Direction.");
    setTaxeRequestOpen(false);
  };

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: t }, { data: p }, { data: a }] = await Promise.all([
        supabase.from("hotels_reference").select("*").order("nom", { ascending: true }),
        supabase.from("transfert_taxes").select("*").order("ville", { ascending: true }),
        supabase.from("codes_promo").select("*").order("created_at", { ascending: false }),
        supabase.from("arbre_noeuds").select("*").order("ordre", { ascending: true }),
      ]);
      setHotels((h as HotelReference[]) || []);
      setTaxes((t as TransfertTaxe[]) || []);
      setCodesPromo((p as CodePromo[]) || []);
      setNoeuds((a as ArbreNoeud[]) || []);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ajouterNoeud = async (parentId: string | null) => {
    const { data, error } = await supabase
      .from("arbre_noeuds")
      .insert({
        parent_id: parentId,
        libelle: "Nouvelle question",
        type_reponse: "texte",
        reponse_texte: "",
        ordre: noeuds.filter((n) => n.parent_id === parentId).length + 1,
      })
      .select()
      .single();
    if (!error && data) {
      setNoeuds((prev) => [...prev, data as ArbreNoeud]);
      setEditNoeudId((data as ArbreNoeud).id);
    } else {
      toast("Échec de l'ajout.");
    }
  };

  const modifierNoeud = async (id: string, patch: Partial<ArbreNoeud>) => {
    setNoeuds((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    const { error } = await supabase.from("arbre_noeuds").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const supprimerNoeud = async (id: string) => {
    const aDesEnfants = noeuds.some((n) => n.parent_id === id);
    const ok = await confirm({
      message: aDesEnfants
        ? "Ce nœud a des sous-questions, elles seront supprimées aussi. Continuer ?"
        : "Supprimer cette question ?",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setNoeuds((prev) => prev.filter((n) => n.id !== id && n.parent_id !== id));
    const { error } = await supabase.from("arbre_noeuds").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const addHotel = async () => {
    if (!newHotelNom.trim()) return;
    const ville = newHotelVille === "Autre" ? newHotelVilleAutre.trim() : newHotelVille;
    if (!ville) return;
    const { data, error } = await supabase
      .from("hotels_reference")
      .insert({
        nom: newHotelNom.trim(),
        ville,
        sur_hurghada: ville === "Hurghada",
      })
      .select()
      .single();
    if (!error && data) {
      setHotels((prev) => [...prev, data as HotelReference].sort((a, b) => a.nom.localeCompare(b.nom)));
      setNewHotelNom("");
      setNewHotelVille("Hurghada");
      setNewHotelVilleAutre("");
      setAddHotelOpen(false);
    } else {
      toast("Impossible d'ajouter cet hôtel (déjà présent ?).");
    }
  };

  const deleteHotel = async (id: string) => {
    const ok = await confirm({ message: "Retirer cet hôtel de la référence ?", confirmLabel: "Retirer", danger: true });
    if (!ok) return;
    const removed = hotels.find((h) => h.id === id);
    setHotels((prev) => prev.filter((h) => h.id !== id));
    const { error } = await supabase.from("hotels_reference").delete().eq("id", id);
    if (error) {
      // Sans ce rollback, l'hôtel restait invisible dans la liste (état
      // local déjà retiré) alors qu'il existe toujours en base, jusqu'au
      // prochain rechargement — confusion "je l'ai supprimé mais il est
      // revenu".
      if (removed) setHotels((prev) => [...prev, removed]);
      toast("Échec de la suppression.");
    }
  };


  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">

      {tab === "hotels" && (
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">
          Hôtels — sur Hurghada ou non
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Sert à détecter automatiquement, dans la fiche client, si une taxe de transfert
          s&apos;applique (hors Hurghada : El Gouna, Makadi, Soma Bay…).
        </p>

        <div className="mt-4 flex items-center gap-3">
          <input
            value={hotelSearch}
            onChange={(e) => setHotelSearch(e.target.value)}
            placeholder="Rechercher un hôtel ou une ville…"
            className="input flex-1"
          />
          <button
            onClick={() => setAddHotelOpen(true)}
            className="whitespace-nowrap rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Ajouter un hôtel
          </button>
        </div>

        {Array.from(new Set(hotels.map((h) => h.ville)))
          .sort((a, b) => (a === "Hurghada" ? -1 : b === "Hurghada" ? 1 : 0))
          .map((ville) => {
          const q = hotelSearch.trim().toLowerCase();
          const list = hotels
            .filter((h) => h.ville === ville)
            .filter((h) => !q || h.nom.toLowerCase().includes(q) || h.ville.toLowerCase().includes(q))
            .sort((a, b) => a.nom.localeCompare(b.nom));
          if (list.length === 0) return null;
          const ouvert = expandedGroups[ville] ?? !!q;
          return (
            <div key={ville} className="mt-3 rounded-md border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => setExpandedGroups((prev) => ({ ...prev, [ville]: !ouvert }))}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-[#171717]"
              >
                <span>
                  📍{ville.toUpperCase()}{" "}
                  <span className="font-normal text-neutral-400">({list.length})</span>
                </span>
                <span className="text-neutral-400">{ouvert ? "▲" : "▼"}</span>
              </button>
              {ouvert && (
                <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                  {list.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="text-neutral-700">{h.nom}</span>
                      <button
                        onClick={() => deleteHotel(h.id)}
                        className="flex-shrink-0 text-xs text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {tab === "taxes" && (
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#171717]">
          🏦 Taxes de transfert
        </h2>
        <p className="mt-2 rounded-md bg-[#C9973E]/10 p-3 text-sm text-[#8B4531]">
          Si une personne est seule, faire une demande pour connaître le montant de la taxe.
        </p>
        <p className="mt-3 text-xs text-neutral-400">
          Référence uniquement — non modifiable ici.
        </p>
        <button
          type="button"
          onClick={() => setTaxeRequestOpen(true)}
          className="mt-3 rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Demander une modification de tarif
        </button>

        {Array.from(new Set(taxes.map((t) => t.ville))).map((ville) => {
          const tranches = taxes
            .filter((t) => t.ville === ville && t.montant !== null)
            .sort((a, b) => a.ordre - b.ordre);
          if (tranches.length === 0) return null;
          const ouvert = taxesOuvertes[ville] ?? false;
          const noteZone = tranches.map((t) => t.note).find((n) => n.trim());
          return (
            <div key={ville} className="mt-3 rounded-md border border-neutral-200 bg-white">
              <button
                type="button"
                onClick={() => setTaxesOuvertes((prev) => ({ ...prev, [ville]: !ouvert }))}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-[#171717]"
              >
                <span>📍{ville.toUpperCase()}</span>
                <span className="text-neutral-400">{ouvert ? "▲" : "▼"}</span>
              </button>
              {ouvert && (
                <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                  {noteZone && <p className="text-xs italic text-neutral-400">{noteZone}</p>}
                  <ul className="space-y-3 text-sm text-neutral-700">
                    {tranches.map((t) => (
                      <li key={t.id}>
                        {t.label.split("\n").map((ligne, i) => (
                          <p key={i}>{ligne}</p>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {tab === "promos" && (
        <div>
          <h2 className="font-heading text-lg font-semibold text-[#171717]">🏷️ Codes promo</h2>
          <p className="mt-2 rounded-md bg-[#C9973E]/10 p-3 text-sm text-[#8B4531]">
            Vérifie ici qu&apos;un code donné par un client est valide.
          </p>
          <p className="mt-3 text-xs text-neutral-400">
            Référence uniquement — ajoutés/retirés par la Direction.
          </p>
          {codesPromo.filter((c) => c.actif).length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">Aucun code actif pour l&apos;instant.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              {codesPromo
                .filter((c) => c.actif)
                .map((c) => (
                  <div key={c.id} className="px-4 py-3">
                    <p className="text-sm font-semibold text-[#171717]">{c.code}</p>
                    {c.description && <p className="text-xs text-[#666666]">{c.description}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === "arbre" && (
        <div>
          <h2 className="font-heading text-lg font-semibold text-[#171717]">Arbre d&apos;aide</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Affiché aux clients (fiche activité et espace client) avant qu&apos;ils n&apos;écrivent
            à l&apos;équipe. Type &quot;donnee&quot; : résolu automatiquement depuis la réservation du
            client dans l&apos;espace client (jamais sur une fiche publique) — sources disponibles :
            pickup, rdv, statut, inclus, aprevoir, montgolfiere, solde, annulation. Type
            &quot;interactif&quot; : pose une question et attend une réponse avant de répondre
            (hotel_zone, choix_ile, planning_sejour) — logique câblée côté site, ni le texte ni la
            source ne se modifient ici.
          </p>

          <button
            onClick={() => ajouterNoeud(null)}
            className="mt-4 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Nouvelle rubrique
          </button>

          <div className="mt-4 space-y-3">
            {noeuds
              .filter((n) => n.parent_id === null)
              .sort((a, b) => a.ordre - b.ordre)
              .map((racine) => (
                <div key={racine.id} className="rounded-md border border-neutral-200 bg-white">
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    {editNoeudId === racine.id ? (
                      <input
                        value={racine.libelle}
                        onChange={(e) => modifierNoeud(racine.id, { libelle: e.target.value })}
                        onBlur={() => setEditNoeudId(null)}
                        autoFocus
                        className="input flex-1"
                      />
                    ) : (
                      <button
                        onClick={() => setEditNoeudId(racine.id)}
                        className="flex-1 text-left text-sm font-semibold text-[#171717]"
                      >
                        {racine.libelle || "(sans titre)"}
                      </button>
                    )}
                    <button
                      onClick={() => supprimerNoeud(racine.id)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="divide-y divide-neutral-100 border-t border-neutral-100 px-3">
                    {noeuds
                      .filter((n) => n.parent_id === racine.id)
                      .sort((a, b) => a.ordre - b.ordre)
                      .map((enfant) => (
                        <div key={enfant.id} className="py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              value={enfant.libelle}
                              onChange={(e) => modifierNoeud(enfant.id, { libelle: e.target.value })}
                              className="input flex-1 text-sm"
                              placeholder="Question"
                            />
                            <select
                              value={enfant.type_reponse}
                              disabled={enfant.type_reponse === "interactif"}
                              onChange={(e) =>
                                modifierNoeud(enfant.id, {
                                  type_reponse: e.target.value as ArbreNoeud["type_reponse"],
                                })
                              }
                              className="input w-28 text-xs disabled:opacity-60"
                            >
                              <option value="texte">Texte</option>
                              <option value="donnee">Donnée</option>
                              {enfant.type_reponse === "interactif" && (
                                <option value="interactif">Interactif</option>
                              )}
                            </select>
                            <button
                              onClick={() => supprimerNoeud(enfant.id)}
                              className="shrink-0 text-xs text-red-600 hover:underline"
                            >
                              Suppr.
                            </button>
                          </div>
                          {enfant.type_reponse === "interactif" ? (
                            <p className="mt-1.5 text-xs italic text-neutral-400">
                              Logique interactive câblée côté site ({enfant.source}) — libellé modifiable
                              ci-dessus, le reste ne se modifie que dans le code.
                            </p>
                          ) : enfant.type_reponse === "texte" ? (
                            <textarea
                              value={enfant.reponse_texte}
                              onChange={(e) => modifierNoeud(enfant.id, { reponse_texte: e.target.value })}
                              rows={2}
                              placeholder="Réponse affichée au client"
                              className="input mt-1.5 w-full text-xs"
                            />
                          ) : (
                            <input
                              value={enfant.source}
                              onChange={(e) => modifierNoeud(enfant.id, { source: e.target.value })}
                              placeholder="pickup / rdv / statut / inclus / aprevoir / montgolfiere / solde / annulation"
                              className="input mt-1.5 w-full text-xs"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                  <div className="px-3 py-2">
                    <button
                      onClick={() => ajouterNoeud(racine.id)}
                      className="text-xs font-medium text-[#0F5C56] hover:underline"
                    >
                      + Ajouter une question ici
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {addHotelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddHotelOpen(false)}>
          <div
            className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-[#171717]">Ajouter un hôtel</h2>
              <button type="button" onClick={() => setAddHotelOpen(false)} className="text-neutral-400 hover:text-[#171717]">
                ✕
              </button>
            </div>
            <label className="mt-4 block text-xs font-medium text-neutral-500">
              Nom de l&apos;hôtel
              <input
                value={newHotelNom}
                onChange={(e) => setNewHotelNom(e.target.value)}
                placeholder="Nom de l'hôtel"
                autoFocus
                className="input mt-1"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-neutral-500">
              Localisation
              <select
                value={newHotelVille}
                onChange={(e) => setNewHotelVille(e.target.value)}
                className="input mt-1"
              >
                {VILLES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {newHotelVille === "Autre" && (
              <input
                value={newHotelVilleAutre}
                onChange={(e) => setNewHotelVilleAutre(e.target.value)}
                placeholder="Nom de la ville"
                className="input mt-2"
              />
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setAddHotelOpen(false)}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-[#fafafa]"
              >
                Annuler
              </button>
              <button
                onClick={addHotel}
                disabled={!newHotelNom.trim()}
                className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {taxeRequestOpen && (
        <TransfertTaxeModificationRequestModal
          taxes={taxes}
          onSubmit={submitTaxeModificationRequest}
          onClose={() => setTaxeRequestOpen(false)}
        />
      )}
    </div>
  );
}
