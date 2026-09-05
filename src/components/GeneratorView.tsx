"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client, HotelReference, TransfertTaxe } from "@/lib/types";
import { PROSPECT_STATUTS } from "@/lib/constants";
import { matchHotel, matchTransfertTaxe } from "@/lib/hotelHelp";
import { useToast } from "@/components/ToastProvider";
import {
  buildProgrammeText,
  detecterAmbiguiteCircuit,
  euros,
  fmtDDMonth,
  Ligne,
  moisLabelFromDates,
  nextLigneId,
  suggererProgramme,
} from "@/lib/generatorProgram";

// Mêmes villes que HelpView (référence hôtels) — Autre en dernier pour la
// saisie libre quand aucune des zones connues ne convient.
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

export default function GeneratorView({
  catalogue,
  clients,
}: {
  catalogue: CatalogueItem[];
  clients: Client[];
}) {
  const supabase = createClient();
  const toast = useToast();

  const prospects = clients.filter((c) => PROSPECT_STATUTS.includes(c.statut));

  const [prospectId, setProspectId] = useState("");
  const [moisLabelOverride, setMoisLabelOverride] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [adultes, setAdultes] = useState(2);
  const [enfants, setEnfants] = useState(0);
  const [agesEnfants, setAgesEnfants] = useState("");
  const [interets, setInterets] = useState("");
  const [activitesAEviter, setActivitesAEviter] = useState("");
  const [hotel, setHotel] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [picker, setPicker] = useState("");
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [popupAmbiguiteVilles, setPopupAmbiguiteVilles] = useState<string[] | null>(null);
  const [preferenceCircuit, setPreferenceCircuit] = useState<"excursions" | "circuit" | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hotels, setHotels] = useState<HotelReference[]>([]);
  const [transfertTaxes, setTransfertTaxes] = useState<TransfertTaxe[]>([]);
  const [popupHotelInconnu, setPopupHotelInconnu] = useState(false);
  const [nouvelHotelVille, setNouvelHotelVille] = useState("Hurghada");
  const [nouvelHotelVilleAutre, setNouvelHotelVilleAutre] = useState("");

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

  const nbPersonnes = adultes + enfants;

  // Résumé texte de la conversation Kommo — la seule source qui peut
  // contenir une nuance que les champs structurés (dates, envies...) ne
  // captent pas. Affiché en lecture seule pour que l'employée le voie
  // sans devoir rouvrir la fiche prospect à côté.
  const prospectSelectionne = clients.find((c) => c.id === prospectId);
  const resume = prospectSelectionne?.kommo_resume || "";

  // Zone de l'hôtel du prospect (Makadi, Sahl Hasheesh, El Gouna, Soma Bay,
  // Safaga...) et taxe de transfert correspondante — jamais un montant
  // deviné : soit une tranche précise (voir HELP > Taxes de transfert)
  // correspond, soit rien n'est ajouté automatiquement.
  const villeClient = useMemo(() => matchHotel(hotel, hotels)?.ville || "", [hotel, hotels]);
  const taxeResultat = useMemo(
    () => matchTransfertTaxe(transfertTaxes, villeClient, adultes, enfants),
    [transfertTaxes, villeClient, adultes, enfants]
  );
  const taxeTransfertMontant = taxeResultat.type === "montant" ? taxeResultat.montant : 0;

  // Un hôtel non reconnu (donc absent de hotels_reference) empêche de
  // détecter sa zone — la taxe de transfert éventuelle serait alors
  // oubliée silencieusement (cf. matchHotel). On le signale à l'employée
  // (via un événement explicite — saisie ou choix d'un prospect — jamais
  // depuis un effet, cf. règle react-hooks/set-state-in-effect) plutôt que
  // de laisser passer sans rien dire. Ignoré tant que la référence hôtels
  // n'a pas fini de charger, sinon tout hôtel semblerait inconnu.
  const verifierHotelConnu = (valeur: string = hotel) => {
    if (hotels.length > 0 && valeur.trim() && !matchHotel(valeur, hotels)) {
      setNouvelHotelVille("Hurghada");
      setNouvelHotelVilleAutre("");
      setPopupHotelInconnu(true);
    }
  };

  const ajouterHotelInconnu = async () => {
    const ville = nouvelHotelVille === "Autre" ? nouvelHotelVilleAutre.trim() : nouvelHotelVille;
    if (!hotel.trim() || !ville) return;
    const { data, error } = await supabase
      .from("hotels_reference")
      .insert({ nom: hotel.trim(), ville, sur_hurghada: ville === "Hurghada" })
      .select()
      .single();
    if (error || !data) {
      toast("Impossible d'ajouter cet hôtel (déjà présent ?).");
      return;
    }
    setHotels((prev) => [...prev, data as HotelReference]);
    setPopupHotelInconnu(false);
    toast("Hôtel ajouté à la référence.", "success");
  };

  const applyProspect = (id: string) => {
    setProspectId(id);
    // La réponse au popup Caire/Louxor ne vaut que pour le prospect pour
    // lequel elle a été donnée — un autre dossier repart de zéro.
    setPreferenceCircuit(null);
    const c = clients.find((cl) => cl.id === id);
    if (!c) return;
    setDateDebut(c.kommo_sejour_debut_estime || "");
    setDateFin(c.kommo_sejour_fin_estime || "");
    setAdultes(c.kommo_nb_adultes_estime ?? 2);
    setEnfants(c.kommo_nb_enfants_estime ?? 0);
    setAgesEnfants(c.kommo_ages_enfants_estime || "");
    setInterets(c.kommo_activites_interet || "");
    setActivitesAEviter(c.kommo_activites_a_eviter || "");
    const hotelValue = c.kommo_hotel_estime || c.hotel || "";
    setHotel(hotelValue);
    setPopupHotelInconnu(false);
    verifierHotelConnu(hotelValue);
  };

  const lancerGeneration = (preference: "excursions" | "circuit" | null) => {
    if (taxeResultat.type === "a_demander") {
      toast(`Taxe de transfert (${villeClient}) : ${taxeResultat.note} — non ajoutée automatiquement.`);
    }
    const { lignes: suggestions, activitesTarifGroupeIgnorees } = suggererProgramme({
      catalogue,
      dateDebut,
      dateFin,
      nbAdultes: adultes,
      nbEnfants: enfants,
      agesEnfants,
      interets,
      activitesAEviter,
      villeClient,
      taxeTransfertMontant,
      preferenceCircuit: preference,
    });
    if (activitesTarifGroupeIgnorees.length > 0) {
      toast(
        `Correspond aussi à un tarif de groupe (prix au bateau, pas par personne) — à ajouter à la main : ${activitesTarifGroupeIgnorees.join(", ")}.`
      );
    }
    if (suggestions.length === 0) {
      if (activitesTarifGroupeIgnorees.length === 0) {
        toast("Aucune activité du catalogue ne correspond à ces critères — ajoute-les à la main.");
      }
      return;
    }
    setLignes(suggestions);
  };

  const genererAuto = () => {
    // "Le Caire et/ou Louxor" sans savoir si le prospect part en excursions
    // depuis Hurghada ou en circuit multi-villes change complètement le
    // programme — on ne devine pas, on demande à l'employée avant de
    // générer quoi que ce soit.
    if (!preferenceCircuit) {
      const ambiguite = detecterAmbiguiteCircuit(catalogue, interets);
      if (ambiguite) {
        setPopupAmbiguiteVilles(ambiguite.villes);
        return;
      }
    }
    lancerGeneration(preferenceCircuit);
  };

  const choisirOptionAmbiguite = (option: "excursions" | "circuit" | "demander") => {
    setPopupAmbiguiteVilles(null);
    if (option === "demander") {
      toast("Demande d'abord la précision au client avant de générer.");
      return;
    }
    setPreferenceCircuit(option);
    lancerGeneration(option);
  };

  const addLigne = (catalogueItemId: string) => {
    const item = catalogue.find((a) => a.id === catalogueItemId);
    if (!item) return;
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
    setPicker("");
  };

  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLigne = (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  };

  // Les dates exactes du séjour, quand elles sont connues, sont plus
  // utiles au prospect qu'un simple nom de mois — sauf si l'employée a
  // explicitement tapé quelque chose dans "Mois affiché" (reste prioritaire).
  const moisLabel =
    moisLabelOverride ||
    (dateDebut && dateFin ? `du ${fmtDDMonth(dateDebut)} au ${fmtDDMonth(dateFin)}` : "") ||
    moisLabelFromDates(lignes.map((l) => l.date)) ||
    moisLabelFromDates([dateDebut, dateFin]);
  const texte = useMemo(
    () => buildProgrammeText(moisLabel, nbPersonnes, hotel, lignes, catalogue),
    [moisLabel, nbPersonnes, hotel, lignes, catalogue]
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

  const addToProspect = async () => {
    if (!prospectId) {
      toast("Choisis un prospect pour y ajouter ces activités.");
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
      // La remise éventuelle est répercutée sur le prix unitaire pour que
      // le total de la réservation (toujours calculé, jamais saisi à la
      // main — règle métier) reste cohérent avec le total annoncé au client.
      const puEffectif =
        l.remise > 0 ? Math.max(l.prixParPersonne - l.remise / Math.max(l.nbPersonnes, 1), 0) : l.prixParPersonne;
      const { error } = await supabase.from("reservations").insert({
        client_id: prospectId,
        nom_activite: l.nom,
        catalogue_item_id: l.catalogueItemId || null,
        pu_adulte: puEffectif,
        participants_mode: "custom",
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
      });
      if (error) {
        toast("Échec de l'ajout d'une activité.");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast(`${lignes.length} activité(s) ajoutée(s) au dossier du prospect.`, "success");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Générateur de programme</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choisis un prospect : le profil déduit de sa conversation (Kommo) préremplit les critères, puis
          « Générer automatiquement » propose un premier programme selon ses envies, son budget familial
          (enfants/ados) et les jours où chaque activité est disponible — à ajuster avant envoi.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <label className="text-xs text-neutral-500">
          Prospect
          <select value={prospectId} onChange={(e) => applyProspect(e.target.value)} className="input mt-1">
            <option value="">— Choisir un prospect —</option>
            {prospects.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom || "Sans nom"}
              </option>
            ))}
          </select>
        </label>

        {resume && (
          <div className="mt-3 rounded-md bg-[#C9973E]/10 p-3 text-sm text-[#8B4531]">
            <span className="font-medium">Résumé Kommo : </span>
            {resume}
          </div>
        )}

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
          <label className="col-span-2 text-xs text-neutral-500">
            Âges enfants/ados
            <input
              type="text"
              value={agesEnfants}
              onChange={(e) => setAgesEnfants(e.target.value)}
              placeholder="ex. 6, 9 et 14 ans"
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500">
            Hôtel
            <input
              type="text"
              value={hotel}
              onChange={(e) => setHotel(e.target.value)}
              onBlur={() => verifierHotelConnu()}
              className="input mt-1"
            />
            {villeClient && villeClient.toLowerCase() !== "hurghada" && (
              <span className="mt-1 block text-[11px] text-[#8B4531]">
                {taxeResultat.type === "montant" &&
                  `Zone ${villeClient} — taxe de transfert ${euros(taxeTransfertMontant)}€ ajoutée automatiquement à chaque activité.`}
                {taxeResultat.type === "a_demander" && `Zone ${villeClient} — ${taxeResultat.note}.`}
                {taxeResultat.type === "aucune" &&
                  `Zone ${villeClient} — aucune tranche de taxe connue pour ce groupe (voir HELP).`}
              </span>
            )}
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Envies exprimées dans la conversation (séparées par une virgule)
            <input
              type="text"
              value={interets}
              onChange={(e) => {
                setInterets(e.target.value);
                setPreferenceCircuit(null);
              }}
              placeholder="ex. plongée, îles, culture"
              className="input mt-1"
            />
          </label>
          <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
            Activités à éviter (séparées par une virgule)
            <input
              type="text"
              value={activitesAEviter}
              onChange={(e) => setActivitesAEviter(e.target.value)}
              placeholder="ex. désert, plongée"
              className="input mt-1"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Mois affiché
            <input
              type="text"
              value={moisLabelOverride}
              onChange={(e) => setMoisLabelOverride(e.target.value)}
              placeholder={moisLabelFromDates([dateDebut, dateFin]) || "Auto"}
              className="input mt-1"
            />
          </label>
        </div>

        <button
          onClick={genererAuto}
          className="mt-3 rounded-md bg-[#171717] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          ✨ Générer automatiquement
        </button>
      </div>

      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
        <button
          type="button"
          onClick={() => setDetailOuvert((v) => !v)}
          className="flex w-full items-center justify-between text-left text-xs font-medium text-neutral-500"
        >
          <span>Activités du programme{lignes.length > 0 ? ` (${lignes.length})` : ""} — modifier à la main</span>
          <span className="text-neutral-400">{detailOuvert ? "▲" : "▼"}</span>
        </button>

        {detailOuvert && (
        <>
        <label className="mt-3 block text-xs text-neutral-500">
          + Ajouter une activité au programme
          <select value={picker} onChange={(e) => addLigne(e.target.value)} className="input mt-1">
            <option value="">— Choisir dans le catalogue —</option>
            {catalogue
              .filter((a) => a.valide)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
          </select>
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
                    Remise (€)
                    <input
                      type="number"
                      min={0}
                      value={l.remise}
                      onChange={(e) => updateLigne(l.id, { remise: Math.max(0, Number(e.target.value)) })}
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
        </>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Message à envoyer au prospect</p>
            <span className="rounded-full bg-[#0F5C56]/10 px-2.5 py-1 text-xs font-medium text-[#0F5C56]">
              Total : {euros(totalGeneral)}€
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
              onClick={addToProspect}
              disabled={saving || !prospectId}
              className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Ajout…" : `Ajouter ${lignes.length} activité(s) au dossier du prospect`}
            </button>
          </div>
        </div>
      )}

      {popupAmbiguiteVilles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
            <h2 className="font-heading text-base font-semibold text-[#171717]">
              Le Caire et Louxor — excursions ou circuit ?
            </h2>
            <p className="mt-3 text-sm text-[#171717]">
              Le prospect a mentionné {popupAmbiguiteVilles.join(" et ")} sans qu&apos;on sache s&apos;il compte
              les visiter en excursions à la journée depuis Hurghada, ou en circuit multi-villes (vol vers Le
              Caire, tournée des deux). Le programme proposé sera très différent selon le cas.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => choisirOptionAmbiguite("excursions")}
                className="rounded-md border border-[#171717]/20 px-3 py-2 text-left text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
              >
                Option 1 — Excursions à la journée depuis Hurghada
              </button>
              <button
                type="button"
                onClick={() => choisirOptionAmbiguite("circuit")}
                className="rounded-md border border-[#171717]/20 px-3 py-2 text-left text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
              >
                Option 2 — Circuit multi-villes
              </button>
              <button
                type="button"
                onClick={() => choisirOptionAmbiguite("demander")}
                className="rounded-md bg-[#171717] px-3 py-2 text-left text-sm font-medium text-white hover:opacity-90"
              >
                Option 3 — Je demande au client
              </button>
            </div>
          </div>
        </div>
      )}

      {popupHotelInconnu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl">
            <h2 className="font-heading text-base font-semibold text-[#171717]">Hôtel non reconnu</h2>
            <p className="mt-3 text-sm text-[#171717]">
              &laquo;&nbsp;{hotel}&nbsp;&raquo; ne correspond à aucun hôtel de la liste de référence — sa
              zone (et une éventuelle taxe de transfert) ne peut donc pas être détectée automatiquement.
              Vérifie l&apos;orthographe, ou ajoute-le à la référence :
            </p>
            <label className="mt-4 block text-xs font-medium text-neutral-500">
              Localisation de &laquo;&nbsp;{hotel}&nbsp;&raquo;
              <select
                value={nouvelHotelVille}
                onChange={(e) => setNouvelHotelVille(e.target.value)}
                className="input mt-1"
              >
                {VILLES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {nouvelHotelVille === "Autre" && (
              <input
                value={nouvelHotelVilleAutre}
                onChange={(e) => setNouvelHotelVilleAutre(e.target.value)}
                placeholder="Nom de la ville"
                className="input mt-2"
              />
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPopupHotelInconnu(false)}
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-[#fafafa]"
              >
                Ignorer
              </button>
              <button
                onClick={ajouterHotelInconnu}
                className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Ajouter à la référence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
