"use client";

import { useEffect, useState } from "react";
import { Client, ClientHotel, HotelReference, TransfertTaxe } from "@/lib/types";
import { matchHotel, matchTransfertTaxe, villeTransfertInfo } from "@/lib/hotelHelp";
import { ZONES_HOTEL } from "@/lib/constants";
import { euros, fmtDateCourte, hebergementSummary } from "@/lib/contactStepFormat";
import { PropertyRow } from "@/components/Field";
import { PropIcon } from "@/components/clientSteps/ContactStepPrimitives";
import { createClient } from "@/lib/supabase/client";
import AjouterHotelZoneModal from "@/components/AjouterHotelZoneModal";

// Bloc "Hôtel" complet (ligne résumé + pop-up hôtel simple / circuit
// multi-hôtels / Airbnb) — extrait de ContactStep pour être réutilisable
// tel quel dans QuickAddClient (le pop-up "+ Nouveau client" n'avait
// jusqu'ici accès qu'à un simple champ texte, aucun moyen d'ajouter un
// circuit ou de passer en Airbnb avant d'aller sur la fiche complète).
export default function HebergementSection({
  client,
  onChange,
  hotelsRef,
  taxesRef,
  onOpenHelp,
  onAddHotelRef,
  onClientHotelsChange,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  hotelsRef: HotelReference[];
  taxesRef: TransfertTaxe[];
  // Optionnel : le pop-up "+ Nouveau client" (QuickAddClient) n'a pas
  // d'onglet Help vers lequel basculer — le lien "Vérifier le montant" est
  // alors simplement masqué.
  onOpenHelp?: () => void;
  onAddHotelRef: (nom: string, ville: string) => Promise<void>;
  // ClientDetail garde sa propre copie de client_hotels (badge "Hôtel" en
  // haut de fiche) — sans ce callback, ajouter/modifier le circuit ici ne
  // se reflète pas là-haut avant un rechargement complet de la page.
  onClientHotelsChange?: (hotels: ClientHotel[]) => void;
}) {
  const supabase = createClient();
  const [clientHotels, setClientHotels] = useState<ClientHotel[]>([]);
  const [showCircuit, setShowCircuit] = useState(false);
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [ajouterHotelZoneOpen, setAjouterHotelZoneOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("client_hotels")
        .select("*")
        .eq("client_id", client.id)
        .order("ordre", { ascending: true });
      setClientHotels((data as ClientHotel[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  useEffect(() => {
    onClientHotelsChange?.(clientHotels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientHotels]);

  const addHotelStep = async () => {
    const { data, error } = await supabase
      .from("client_hotels")
      .insert({ client_id: client.id, ordre: clientHotels.length })
      .select()
      .single();
    if (!error && data) {
      setClientHotels((prev) => [...prev, data as ClientHotel]);
      setShowCircuit(true);
    }
  };

  const updateHotelStep = async (id: string, patch: Partial<ClientHotel>) => {
    setClientHotels((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    await supabase.from("client_hotels").update(patch).eq("id", id);
  };

  const deleteHotelStep = async (id: string) => {
    setClientHotels((prev) => {
      const next = prev.filter((h) => h.id !== id);
      // En repassant à 0 hôtel, on revient à l'affichage "simple hôtel" au
      // lieu de laisser la section Circuit vide affichée en double avec
      // le champ Hôtel classique (showCircuit ne se réinitialisait jamais
      // tout seul).
      if (next.length === 0) setShowCircuit(false);
      return next;
    });
    await supabase.from("client_hotels").delete().eq("id", id);
  };

  const moveHotelStep = (id: string, dir: -1 | 1) => {
    const idx = clientHotels.findIndex((h) => h.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= clientHotels.length) return;
    const next = [...clientHotels];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((h, i) => ({ ...h, ordre: i }));
    setClientHotels(reordered);
    reordered.forEach((h) => supabase.from("client_hotels").update({ ordre: h.ordre }).eq("id", h.id));
  };

  const hotelMatch = matchHotel(client.hotel, hotelsRef);
  const taxeResultat = hotelMatch
    ? matchTransfertTaxe(taxesRef, hotelMatch.ville, client.adultes, client.enfants)
    : null;
  // Un circuit incomplet (date OU ville manquante sur au moins un hôtel) ne
  // peut jamais être validé — sans la ville, impossible de savoir si une
  // taxe de transfert s'applique (voir villeTransfertInfo ci-dessous).
  const circuitIncomplet = clientHotels.some((h) => !h.date_arrivee || !h.date_depart || !h.ville.trim());

  return (
    <div className="space-y-1.5">
      <PropertyRow label="Hôtel" icon={<PropIcon name="hotel" />} shaded>
        {clientHotels.length > 0 ? (
          <button type="button" onClick={() => setHotelModalOpen(true)} className="w-full space-y-2 text-left">
            {clientHotels.map((h) => {
              const info = villeTransfertInfo(h.ville, taxesRef, client.adultes, client.enfants, ZONES_HOTEL);
              return (
                <div key={h.id} className="text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-[#171717]">{h.ville || "Destination —"}</span>
                    <span className="text-[10px] text-neutral-400">
                      {fmtDateCourte(h.date_arrivee)} → {fmtDateCourte(h.date_depart)}
                    </span>
                  </div>
                  <div className="text-[#171717]">
                    {h.nom || "Hôtel —"}
                    {h.chambre.trim() ? ` - ${h.chambre}` : ""}
                  </div>
                  {info.kind === "hurghada" && (
                    <span className="text-xs text-emerald-600">✓ Pas de taxe de transfert.</span>
                  )}
                  {info.kind === "taxe" && (
                    <span className="text-xs text-orange-600">
                      ⚠ Taxe de transfert possible
                      {info.taxe.type === "montant" ? ` (${euros(info.taxe.montant)} €)` : ""}
                      {info.taxe.type === "a_demander" ? ` (${info.taxe.note})` : ""}.
                    </span>
                  )}
                </div>
              );
            })}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setHotelModalOpen(true)}
            className="text-left text-sm font-semibold text-[#171717] hover:underline"
          >
            {hebergementSummary(client)}
          </button>
        )}
      </PropertyRow>

      {clientHotels.length === 0 && client.type_hebergement !== "airbnb" && client.hotel.trim() && (
        <div className="-mt-1 pl-[180px] text-xs">
          {hotelMatch ? (
            hotelMatch.sur_hurghada ? (
              <span className="text-emerald-600">
                ✓ Cet hôtel est bien sur Hurghada — pas de taxe de transfert.
              </span>
            ) : (
              <span className="text-orange-600">
                ⚠ Cet hôtel n&apos;est pas sur Hurghada ({hotelMatch.ville}), il peut comporter une taxe de
                transfert
                {taxeResultat?.type === "montant" ? ` (${euros(taxeResultat.montant)} €)` : ""}
                {taxeResultat?.type === "a_demander" ? ` (${taxeResultat.note})` : ""}.
                {onOpenHelp && (
                  <>
                    {" "}
                    <button type="button" onClick={onOpenHelp} className="underline hover:no-underline">
                      Vérifier le montant
                    </button>
                  </>
                )}
              </span>
            )
          ) : (
            <span className="text-neutral-400">
              Hôtel non répertorié dans HELP.{" "}
              <button
                type="button"
                onClick={() => setAjouterHotelZoneOpen(true)}
                className="underline hover:no-underline"
              >
                L&apos;ajouter
              </button>
            </span>
          )}
        </div>
      )}

      {ajouterHotelZoneOpen && (
        <AjouterHotelZoneModal
          hotelNom={client.hotel}
          onAdd={(ville) => onAddHotelRef(client.hotel, ville)}
          onClose={() => setAjouterHotelZoneOpen(false)}
        />
      )}

      {hotelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-4 text-lg font-semibold text-[#171717]">Hébergement</h2>
            <div className="space-y-1.5">
              {client.type_hebergement === "airbnb" ? (
                <>
                  <PropertyRow label="Airbnb" icon={<PropIcon name="hotel" />}>
                    <div className="flex items-center gap-2">
                      <input
                        value={client.hotel}
                        onChange={(e) => onChange({ hotel: e.target.value })}
                        placeholder="Nom / lien de l'Airbnb"
                        className="input-flat flex-1 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => onChange({ type_hebergement: "hotel" })}
                        className="flex-shrink-0 whitespace-nowrap text-xs text-neutral-400 hover:text-neutral-600"
                      >
                        Revenir à un hôtel
                      </button>
                    </div>
                  </PropertyRow>
                  <PropertyRow label="Adresse / GPS">
                    <input
                      value={client.airbnb_adresse}
                      onChange={(e) => onChange({ airbnb_adresse: e.target.value })}
                      placeholder="Adresse ou lien Google Maps"
                      className="input-flat"
                    />
                  </PropertyRow>
                  <PropertyRow label="Appart / Bâtiment">
                    <div className="flex items-center gap-2">
                      <input
                        value={client.airbnb_appartement}
                        onChange={(e) => onChange({ airbnb_appartement: e.target.value })}
                        placeholder="N° appartement (si besoin)"
                        className="input-flat flex-1"
                      />
                      <input
                        value={client.airbnb_building}
                        onChange={(e) => onChange({ airbnb_building: e.target.value })}
                        placeholder="Bâtiment (si besoin)"
                        className="input-flat flex-1"
                      />
                    </div>
                  </PropertyRow>
                </>
              ) : (
                <>
                  {clientHotels.length === 0 && (
                    <>
                      <PropertyRow label="Hôtel" icon={<PropIcon name="hotel" />}>
                        <input
                          value={client.hotel}
                          onChange={(e) => onChange({ hotel: e.target.value })}
                          placeholder="Hôtel"
                          className="input-flat w-full font-medium"
                        />
                      </PropertyRow>
                      {client.hotel.trim() && !hotelMatch && (
                        <div className="pl-[26px] text-xs text-orange-600">
                          ⚠ Cet hôtel n&apos;est pas répertorié — il faut l&apos;ajouter pour continuer.{" "}
                          <button
                            type="button"
                            onClick={() => setAjouterHotelZoneOpen(true)}
                            className="underline hover:no-underline"
                          >
                            L&apos;ajouter
                          </button>
                        </div>
                      )}
                      <PropertyRow label="N° chambre(s)">
                        <input
                          value={client.chambre}
                          onChange={(e) => onChange({ chambre: e.target.value })}
                          placeholder="N° chambre(s)"
                          className="input-flat w-full"
                        />
                      </PropertyRow>
                      <button
                        type="button"
                        onClick={() => onChange({ type_hebergement: "airbnb" })}
                        className="pl-[26px] text-left text-xs text-neutral-400 hover:text-neutral-600"
                      >
                        › changer vers un airbnb
                      </button>
                    </>
                  )}

                  <div className="border-t border-neutral-100 pt-2">
                    {clientHotels.length === 0 && !showCircuit ? (
                      <button
                        type="button"
                        onClick={addHotelStep}
                        className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline"
                      >
                        + Ajouter d&apos;autres hôtels (circuit)
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-neutral-500">
                          Circuit (Caire, Louxor, Assouan, Marsa Alam, Siwa…)
                        </p>
                        {clientHotels.map((h, i) => (
                          <div key={h.id} className="space-y-1.5 rounded-md border border-neutral-200 p-2">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={i === 0}
                                  onClick={() => moveHotelStep(h.id, -1)}
                                  className="text-xs text-neutral-500 disabled:opacity-20"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={i === clientHotels.length - 1}
                                  onClick={() => moveHotelStep(h.id, 1)}
                                  className="text-xs text-neutral-500 disabled:opacity-20"
                                >
                                  ▼
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteHotelStep(h.id)}
                                className="text-xs text-red-600"
                              >
                                ✕ Retirer
                              </button>
                            </div>
                            <input
                              value={h.nom}
                              onChange={(e) => updateHotelStep(h.id, { nom: e.target.value })}
                              placeholder="Hôtel"
                              className="input w-full text-sm"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                value={h.ville}
                                onChange={(e) => updateHotelStep(h.id, { ville: e.target.value })}
                                placeholder="Ville *"
                                className={`input text-sm ${!h.ville.trim() ? "border-red-300 focus:border-red-400" : ""}`}
                              />
                              <input
                                value={h.chambre}
                                onChange={(e) => updateHotelStep(h.id, { chambre: e.target.value })}
                                placeholder="Chambre"
                                className="input text-sm"
                              />
                              <div>
                                <p className="mb-0.5 text-[10px] text-neutral-400">Arrivée</p>
                                <input
                                  type="date"
                                  value={h.date_arrivee ?? ""}
                                  onChange={(e) =>
                                    updateHotelStep(h.id, { date_arrivee: e.target.value || null })
                                  }
                                  className="input w-full text-sm"
                                />
                              </div>
                              <div>
                                <p className="mb-0.5 text-[10px] text-neutral-400">Départ</p>
                                <input
                                  type="date"
                                  value={h.date_depart ?? ""}
                                  onChange={(e) =>
                                    updateHotelStep(h.id, { date_depart: e.target.value || null })
                                  }
                                  className="input w-full text-sm"
                                />
                              </div>
                            </div>
                            {(() => {
                              const info = villeTransfertInfo(
                                h.ville,
                                taxesRef,
                                client.adultes,
                                client.enfants,
                                ZONES_HOTEL
                              );
                              if (info.kind === "hurghada") {
                                return (
                                  <p className="text-xs text-emerald-600">
                                    ✓ Cet hôtel est bien sur Hurghada — pas de taxe de transfert.
                                  </p>
                                );
                              }
                              if (info.kind === "taxe") {
                                return (
                                  <p className="text-xs text-orange-600">
                                    ⚠ {info.ville} n&apos;est pas sur Hurghada, taxe de transfert possible
                                    {info.taxe.type === "montant" ? ` (${euros(info.taxe.montant)} €)` : ""}
                                    {info.taxe.type === "a_demander" ? ` (${info.taxe.note})` : ""}.
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addHotelStep}
                          className="text-xs text-[#171717] hover:underline"
                        >
                          + Ajouter un hôtel
                        </button>
                        {circuitIncomplet && (
                          <p className="text-xs text-orange-600">
                            ⚠ Renseigne la ville et les dates d&apos;arrivée/de départ de chaque hôtel pour
                            continuer.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              disabled={
                client.type_hebergement !== "airbnb" &&
                (clientHotels.length === 0 ? !!client.hotel.trim() && !hotelMatch : circuitIncomplet)
              }
              onClick={() => setHotelModalOpen(false)}
              className="mt-5 w-full rounded-md bg-[#171717] py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
