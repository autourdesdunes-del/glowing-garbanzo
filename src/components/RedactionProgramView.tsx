"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client, HotelReference, TransfertTaxe } from "@/lib/types";
import { matchHotel, matchTransfertTaxe } from "@/lib/hotelHelp";
import { deaccent } from "@/lib/deaccent";
import { useToast } from "@/components/ToastProvider";
import { buildRedactionText, eurosVirgule, fmtDDMonth, Ligne, moisLabelFromDates, nextLigneId } from "@/lib/generatorProgram";

// Onglet "Rédaction d'un programme" — flux manuel demandé par Mélanie le
// 2026-09-13, en complément de la Génération auto (GeneratorView) : recherche
// du lead, confirmation des dates/du nombre de personnes déjà connues,
// recherche libre dans le catalogue activité par activité, calcul du prix
// (par personne, taxe de transfert, total) au fil de l'eau. Ne devine rien —
// contrairement à suggererProgramme, aucune activité n'est ajoutée toute
// seule, l'employée choisit tout.
export default function RedactionProgramView({
  catalogue,
  clients,
}: {
  catalogue: CatalogueItem[];
  clients: Client[];
}) {
  const supabase = createClient();
  const toast = useToast();

  const [clientId, setClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientFocused, setClientFocused] = useState(false);

  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [adultes, setAdultes] = useState(2);
  const [enfants, setEnfants] = useState(0);
  const [hotel, setHotel] = useState("");

  const [activiteQuery, setActiviteQuery] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hotels, setHotels] = useState<HotelReference[]>([]);
  const [transfertTaxes, setTransfertTaxes] = useState<TransfertTaxe[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: t }] = await Promise.all([
        supabase.from("hotels_reference").select("*"),
        supabase.from("transfert_taxes").select("*"),
      ]);
      setHotels((h as HotelReference[]) || []);
      setTransfertTaxes((t as TransfertTaxe[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientSelectionne = clients.find((c) => c.id === clientId);
  const nbPersonnes = adultes + enfants;

  const qClient = deaccent(clientQuery.trim().toLowerCase());
  const clientsFiltres = useMemo(() => {
    if (qClient.length < 2) return [];
    return clients
      .filter(
        (c) => deaccent((c.nom || "").toLowerCase()).includes(qClient) || (c.telephone || "").includes(qClient)
      )
      .slice(0, 8);
  }, [clients, qClient]);

  // Zone de l'hôtel puis taxe de transfert correspondante — même logique que
  // la Génération auto (GeneratorView) : jamais un montant deviné, soit une
  // tranche précise existe, soit rien n'est ajouté automatiquement.
  const villeClient = useMemo(() => matchHotel(hotel, hotels)?.ville || "", [hotel, hotels]);
  const taxeResultat = useMemo(
    () => matchTransfertTaxe(transfertTaxes, villeClient, adultes, enfants),
    [transfertTaxes, villeClient, adultes, enfants]
  );
  const taxeTransfertMontant = taxeResultat.type === "montant" ? taxeResultat.montant : 0;

  const selectClient = (c: Client) => {
    setClientId(c.id);
    setClientQuery("");
    setClientFocused(false);
    // Un dossier déjà confirmé porte ses vraies dates/effectifs dans les
    // champs officiels (date_debut, adultes...) — les champs kommo_*_estime
    // ne sont que des estimations tirées de la conversation, à ne préférer
    // que tant qu'aucune valeur confirmée n'existe encore.
    setDateDebut(c.date_debut || c.kommo_sejour_debut_estime || "");
    setDateFin(c.date_fin || c.kommo_sejour_fin_estime || "");
    setAdultes(c.adultes || c.kommo_nb_adultes_estime || 2);
    setEnfants(c.enfants ?? c.kommo_nb_enfants_estime ?? 0);
    setHotel(c.hotel || c.kommo_hotel_estime || "");
  };

  const rechercheNette = deaccent(activiteQuery.trim()).toLowerCase();
  const motsRecherche = rechercheNette.split(/\s+/).filter(Boolean);
  const activitesFiltrees = useMemo(() => {
    if (motsRecherche.length === 0) return [];
    return catalogue
      .filter((a) => a.valide)
      .filter((a) => {
        const nomNormalise = deaccent(a.nom).toLowerCase();
        return motsRecherche.every((m) => nomNormalise.includes(m));
      })
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, rechercheNette]);

  const addLigne = (item: CatalogueItem) => {
    setLignes((prev) => [
      ...prev,
      {
        id: nextLigneId(),
        catalogueItemId: item.id,
        nom: item.nom,
        date: "",
        prixParPersonne: item.pu_adulte || 0,
        nbPersonnes: nbPersonnes || 2,
        remise: 0,
        remiseLabel: "",
        taxeTransfert: taxeTransfertMontant,
      },
    ]);
    setActiviteQuery("");
  };

  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLigne = (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  };

  const moisLabel =
    (dateDebut && dateFin ? `du ${fmtDDMonth(dateDebut)} au ${fmtDDMonth(dateFin)}` : "") ||
    moisLabelFromDates(lignes.map((l) => l.date)) ||
    moisLabelFromDates([dateDebut, dateFin]);

  const texte = useMemo(
    () => buildRedactionText(moisLabel, adultes, enfants, hotel, lignes, catalogue),
    [moisLabel, adultes, enfants, hotel, lignes, catalogue]
  );

  const totalGeneral = lignes.reduce(
    (s, l) => s + Math.max(l.prixParPersonne * l.nbPersonnes - (l.remise || 0) + (l.taxeTransfert || 0), 0),
    0
  );

  const copyTexte = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };

  const addToClient = async () => {
    if (!clientId) {
      toast("Choisis un lead pour y ajouter ces activités.");
      return;
    }
    if (lignes.length === 0) {
      toast("Ajoute au moins une activité au programme.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let creeParNom = "";
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("prenom, email")
        .eq("id", user.id)
        .single();
      creeParNom = prof?.prenom || (prof?.email || "").split("@")[0] || "";
    }
    for (const l of lignes) {
      const item = catalogue.find((a) => a.id === l.catalogueItemId);
      const puEffectif =
        l.remise > 0 ? Math.max(l.prixParPersonne - l.remise / Math.max(l.nbPersonnes, 1), 0) : l.prixParPersonne;
      const { error } = await supabase.from("reservations").insert({
        client_id: clientId,
        nom_activite: l.nom,
        catalogue_item_id: l.catalogueItemId || null,
        pu_adulte: puEffectif,
        participants_mode: "custom",
        participants_adultes: l.nbPersonnes,
        pax_override: `${l.nbPersonnes} personnes`,
        horaire_approx: item?.horaire_approx || "",
        inclus: (item?.inclus_liste || []).join(", ") || item?.inclus || "",
        non_inclus: (item?.non_inclus_liste || []).join(", ") || item?.non_inclus || "",
        a_prevoir: (item?.a_prevoir_liste || []).join(", ") || item?.a_prevoir || "",
        point_rdv: item?.point_rdv || "",
        photo_path: item?.photo_path || "",
        date_debut: l.date || null,
        transfert_inclus: !(l.taxeTransfert > 0),
        transfert_montant: l.taxeTransfert || 0,
        zone_transfert: villeClient,
        cree_par_id: user?.id || null,
        cree_par_nom: creeParNom,
        statut_resa: clientSelectionne?.statut === "Client confirmé" ? "Confirmée" : "Brouillon",
      });
      if (error) {
        toast("Échec de l'ajout d'une activité.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast(`${lignes.length} activité(s) ajoutée(s) au dossier.`, "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Rédaction d&apos;un programme</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Cherche le lead, confirme ses dates et le nombre de participants, puis ajoute les activités une par
          une depuis le catalogue — le prix par personne, la taxe de transfert et le total se calculent tout
          seuls, prêt à copier-coller.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <label className="text-xs text-neutral-500">
          Lead
          <div className="relative mt-1">
            <input
              type="text"
              value={clientId ? clientSelectionne?.nom || "" : clientQuery}
              onChange={(e) => {
                setClientId("");
                setClientQuery(e.target.value);
              }}
              onFocus={() => setClientFocused(true)}
              onBlur={() => setTimeout(() => setClientFocused(false), 150)}
              placeholder="Rechercher par nom ou téléphone…"
              className="input"
            />
            {clientFocused && qClient.length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-[#eaeaea] bg-white shadow-lg">
                {clientsFiltres.length === 0 && (
                  <div className="p-3 text-sm text-neutral-400">Aucun résultat.</div>
                )}
                {clientsFiltres.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectClient(c)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#fafafa]"
                  >
                    <span className="font-medium text-[#171717]">{c.nom || "Sans nom"}</span>
                    {c.telephone && <span className="ml-2 text-xs text-neutral-400">{c.telephone}</span>}
                    <span className="ml-2 text-xs text-neutral-400">— {c.statut}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-neutral-500">
            Arrivée
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Départ
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-xs text-neutral-500">
            Adultes
            <input
              type="number"
              min={0}
              value={adultes}
              onChange={(e) => setAdultes(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Enfants
            <input
              type="number"
              min={0}
              value={enfants}
              onChange={(e) => setEnfants(Math.max(0, Number(e.target.value)))}
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Hôtel
            <input type="text" value={hotel} onChange={(e) => setHotel(e.target.value)} className="input mt-1" />
            {villeClient && villeClient.toLowerCase() !== "hurghada" && (
              <span className="mt-1 block text-[11px] text-[#8B4531]">
                {taxeResultat.type === "montant" &&
                  `Zone ${villeClient} — taxe de transfert ${eurosVirgule(taxeTransfertMontant)} ajoutée automatiquement à chaque activité.`}
                {taxeResultat.type === "a_demander" && `Zone ${villeClient} — ${taxeResultat.note}.`}
                {taxeResultat.type === "aucune" &&
                  `Zone ${villeClient} — aucune tranche de taxe connue pour ce groupe (voir HELP).`}
              </span>
            )}
          </label>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <label className="text-xs text-neutral-500">
          + Ajouter une activité
          <div className="relative mt-1">
            <input
              type="text"
              value={activiteQuery}
              onChange={(e) => setActiviteQuery(e.target.value)}
              placeholder="Chercher une activité du catalogue…"
              className="input"
            />
            {activitesFiltrees.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-[#eaeaea] bg-white shadow-lg">
                {activitesFiltrees.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={() => addLigne(a)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#fafafa]"
                  >
                    <span className="font-medium text-[#171717]">{a.nom}</span>
                    <span className="ml-2 text-xs text-neutral-400">{eurosVirgule(a.pu_adulte || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        {lignes.length > 0 && (
          <div className="mt-3 space-y-2">
            {lignes.map((l) => (
              <div key={l.id} className="rounded-md border border-neutral-200 p-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={l.nom}
                    onChange={(e) => updateLigne(l.id, { nom: e.target.value })}
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLigne(l.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
                {/\ben bus\b/i.test(l.nom) && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Déconseillé — formule mini-bus recommandée par l&apos;agence.
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-[11px] text-neutral-500">
                    Date
                    <input
                      type="date"
                      value={l.date}
                      onChange={(e) => updateLigne(l.id, { date: e.target.value })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Prix / personne (€)
                    <input
                      type="number"
                      min={0}
                      value={l.prixParPersonne}
                      onChange={(e) => updateLigne(l.id, { prixParPersonne: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Nb personnes (ligne)
                    <input
                      type="number"
                      min={0}
                      value={l.nbPersonnes}
                      onChange={(e) => updateLigne(l.id, { nbPersonnes: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    Taxe de transfert (€)
                    <input
                      type="number"
                      min={0}
                      value={l.taxeTransfert}
                      onChange={(e) => updateLigne(l.id, { taxeTransfert: Math.max(0, Number(e.target.value)) })}
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                </div>
                <label className="mt-2 block text-[11px] text-neutral-500">
                  Remise (€)
                  <input
                    type="number"
                    min={0}
                    value={l.remise}
                    onChange={(e) => updateLigne(l.id, { remise: Math.max(0, Number(e.target.value)) })}
                    className="input mt-0.5 text-sm"
                  />
                </label>
                {l.remise > 0 && (
                  <label className="mt-2 block text-[11px] text-neutral-500">
                    Motif de la remise
                    <input
                      type="text"
                      value={l.remiseLabel}
                      onChange={(e) => updateLigne(l.id, { remiseLabel: e.target.value })}
                      placeholder="geste commercial"
                      className="input mt-0.5 text-sm"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Message à envoyer au client</p>
            <span className="rounded-full bg-[#0F5C56]/10 px-2.5 py-1 text-xs font-medium text-[#0F5C56]">
              Total : {eurosVirgule(totalGeneral)}
            </span>
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 font-sans text-sm text-[#171717]">
            {texte}
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyTexte}
              className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {copied ? "Copié ✓" : "Copier le message"}
            </button>
            <button
              onClick={addToClient}
              disabled={saving || !clientId}
              className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Ajout…" : `Ajouter ${lignes.length} activité(s) au dossier`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
