"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, CatalogueOption, Client, HotelReference, TransfertTaxe } from "@/lib/types";
import { matchHotel, matchTransfertTaxe } from "@/lib/hotelHelp";
import { groupeExtraCounts, normalizeJoursDisponibles } from "@/lib/resa";
import { CRENEAUX_ACTIVITE } from "@/lib/constants";
import { deaccent } from "@/lib/deaccent";
import { useToast } from "@/components/ToastProvider";
import {
  buildRedactionText,
  datesInRange,
  eurosVirgule,
  extractAges,
  fmtDDMonth,
  GroupeLigne,
  Ligne,
  LigneOption,
  ligneTotal,
  moisLabelFromDates,
  nextLigneId,
  repartirAgesEnfants,
  RepartitionLigne,
  suggererDateLigne,
} from "@/lib/generatorProgram";

// Même règle que AddActivityWizard : une activité de demi-journée
// (excursion à la carte, coucher de soleil...) doit préciser le créneau
// (matin/après-midi/coucher de soleil) — sinon rien n'empêche de la
// réserver deux fois le même jour sans que personne ne le voie.
const CRENEAU_REQUIS = "Créneau (matin / après-midi / coucher de soleil)";

// Brouillon persistant : l'employée peut changer d'onglet ou de page sans
// perdre le programme en cours — demandé par Mélanie le 2026-09-13 après
// avoir perdu un devis en quittant l'écran par erreur. Volontairement
// propre au navigateur (pas de table Supabase) : c'est un brouillon de
// travail, pas un document à partager entre postes.
const DRAFT_KEY = "redactionProgramme:draft";
type Draft = {
  clientId: string;
  dateDebut: string;
  dateFin: string;
  adultes: number;
  enfants: number;
  agesEnfants: string;
  hotel: string;
  lignes: Ligne[];
};

// Onglet "Rédaction d'un programme" — flux manuel demandé par Mélanie le
// 2026-09-13, en complément de la Génération auto (GeneratorView) : recherche
// du lead, confirmation des dates/du nombre de personnes déjà connues,
// recherche libre dans le catalogue activité par activité, calcul du prix
// (par personne — ou par tranche d'âge quand le catalogue distingue un prix
// enfant/bébé —, de la taxe de transfert, des options et du total au fil de
// l'eau. Ne devine rien qui ne soit pas vérifiable : contrairement à
// suggererProgramme (génération auto complète), aucune activité n'est
// ajoutée toute seule, seule la date proposée pour une activité déjà
// choisie par l'employée respecte automatiquement ses jours de
// disponibilité catalogue.
export default function RedactionProgramView({
  catalogue,
  clients,
  catalogueOptions,
}: {
  catalogue: CatalogueItem[];
  clients: Client[];
  catalogueOptions: Record<string, CatalogueOption[]>;
}) {
  const supabase = createClient();
  const toast = useToast();

  const loadDraft = (): Draft | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as Draft) : null;
    } catch {
      return null;
    }
  };
  const draftInitial = loadDraft();

  const [clientId, setClientId] = useState(draftInitial?.clientId || "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientFocused, setClientFocused] = useState(false);

  const [dateDebut, setDateDebut] = useState(draftInitial?.dateDebut || "");
  const [dateFin, setDateFin] = useState(draftInitial?.dateFin || "");
  const [adultes, setAdultes] = useState(draftInitial?.adultes ?? 2);
  const [enfants, setEnfants] = useState(draftInitial?.enfants ?? 0);
  const [agesEnfants, setAgesEnfants] = useState(draftInitial?.agesEnfants || "");
  const [hotel, setHotel] = useState(draftInitial?.hotel || "");

  const [activiteQuery, setActiviteQuery] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>(draftInitial?.lignes || []);
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

  useEffect(() => {
    const draft: Draft = { clientId, dateDebut, dateFin, adultes, enfants, agesEnfants, hotel, lignes };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // stockage indisponible (navigation privée...), tant pis pour la persistance
    }
  }, [clientId, dateDebut, dateFin, adultes, enfants, agesEnfants, hotel, lignes]);

  const clientSelectionne = clients.find((c) => c.id === clientId);
  const nbPersonnes = adultes + enfants;
  const joursSejour = useMemo(() => datesInRange(dateDebut, dateFin), [dateDebut, dateFin]);

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
    setAgesEnfants(c.ages_enfants || c.kommo_ages_enfants_estime || "");
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

  // Construit la répartition par tranche d'âge d'une ligne quand l'activité
  // distingue vraiment un prix enfant/bébé — sinon (activité à prix unique,
  // ou aucun enfant) on garde le calcul simple prixParPersonne × nbPersonnes
  // (repartition reste undefined).
  // Forfait "groupe" catalogue (speedboat privé, yacht...) : le prix n'est
  // jamais par personne, pu_adulte vaut 0 dans ce mode — l'utiliser aurait
  // affiché 0€ ou un faux prix par personne (ex. un forfait 2 pers. à 150€
  // multiplié à tort par le nombre de participants). extra1/extraEnfants
  // sont pré-remplis par groupeExtraCounts (même règle que partout ailleurs
  // dans l'app) mais restent éditables : rien n'empêche par ex. un groupe
  // de 2 adultes tenant dans le forfait de base sans aucun supplément.
  const construireGroupe = (item: CatalogueItem): GroupeLigne | undefined => {
    if (item.tarif_mode !== "groupe") return undefined;
    const extra = groupeExtraCounts(adultes, enfants, item.prix_groupe_base_pax);
    return {
      base: item.prix_groupe_base || 0,
      basePax: item.prix_groupe_base_pax || 0,
      extra1: extra.extra1,
      prixExtra1: item.prix_groupe_extra1 || 0,
      extraEnfants: extra.extraEnfants,
      prixExtraEnfant: item.prix_groupe_extra_enfant || 0,
    };
  };

  const construireRepartition = (item: CatalogueItem): RepartitionLigne[] | undefined => {
    if (item.tarif_mode === "groupe") return undefined;
    const distingue = item.pu_enfant !== item.pu_adulte || item.pu_bebe > 0 || item.pu_enfant_3ans > 0;
    if (enfants === 0 || !distingue) return undefined;
    const tranches: RepartitionLigne[] = [];
    if (adultes > 0) tranches.push({ tranche: "adulte", label: item.pu_adulte_age || "Adulte", pu: item.pu_adulte, nb: adultes });
    const ages = extractAges(agesEnfants);
    if (ages.length > 0) {
      if (ages.length !== enfants) {
        toast(
          `${enfants} enfant(s) mais ${ages.length} âge(s) trouvé(s) dans "Âges enfants" — vérifie la répartition des prix.`
        );
      }
      tranches.push(...repartirAgesEnfants(item, ages));
    } else {
      // Pas d'âge connu du tout : impossible de distinguer bébé/3 ans/enfant
      // — repli sur le tarif enfant générique du catalogue plutôt que de
      // deviner un âge, avec un rappel explicite pour que l'employée pense à
      // préciser les âges si elle veut le prix exact.
      toast('Âges des enfants inconnus — tarif enfant générique appliqué. Renseigne "Âges enfants" pour affiner.');
      tranches.push({ tranche: "enfant", label: item.pu_enfant_age || "Enfant", pu: item.pu_enfant || item.pu_adulte, nb: enfants });
    }
    return tranches;
  };

  const addLigne = (item: CatalogueItem) => {
    const datesDejaUtilisees = new Set(lignes.map((l) => l.date).filter(Boolean));
    const dateSuggeree = suggererDateLigne(item, joursSejour, datesDejaUtilisees);
    if (joursSejour.length > 0 && !dateSuggeree) {
      const joursDispo = normalizeJoursDisponibles(item.jours_disponibles);
      if (joursDispo.length > 0 && joursDispo.length < 7) {
        toast(`Aucun jour du séjour ne tombe un jour de circulation de "${item.nom}" (${joursDispo.join(", ")}) — date à choisir à la main.`);
      }
    }
    const repartition = construireRepartition(item);
    const groupe = construireGroupe(item);
    const creneauRequis = (item.champs_requis_liste || []).includes(CRENEAU_REQUIS);
    setLignes((prev) => [
      ...prev,
      {
        id: nextLigneId(),
        catalogueItemId: item.id,
        nom: item.nom,
        date: dateSuggeree,
        prixParPersonne: item.pu_adulte || 0,
        nbPersonnes: nbPersonnes || 2,
        remise: 0,
        remiseLabel: "",
        taxeTransfert: taxeTransfertMontant,
        options: [],
        repartition,
        groupe,
        ...(creneauRequis ? { creneau: "" } : {}),
      },
    ]);
    setActiviteQuery("");
  };

  // Taxe de transfert vendue seule, sans activité — même montant que celui
  // ajouté automatiquement à chaque activité (matchTransfertTaxe, référence
  // HELP), juste sous forme de ligne autonome pour un devis qui n'en a pas
  // besoin ailleurs.
  const addTaxeSeule = () => {
    setLignes((prev) => [
      ...prev,
      {
        id: nextLigneId(),
        catalogueItemId: "",
        nom: "Taxe de transfert",
        date: joursSejour[0] || "",
        prixParPersonne: 0,
        nbPersonnes: nbPersonnes || 2,
        remise: 0,
        remiseLabel: "",
        taxeTransfert: taxeTransfertMontant,
        options: [],
        estTaxeSeule: true,
      },
    ]);
  };

  const updateLigne = (id: string, patch: Partial<Ligne>) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const updateRepartitionRow = (ligneId: string, index: number, patch: Partial<RepartitionLigne>) => {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== ligneId || !l.repartition) return l;
        const repartition = l.repartition.map((r, i) => (i === index ? { ...r, ...patch } : r));
        return { ...l, repartition };
      })
    );
  };

  const removeLigne = (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  };

  const nbPersonnesLigne = (l: Ligne) =>
    l.repartition && l.repartition.length > 0 ? l.repartition.reduce((s, r) => s + r.nb, 0) : l.nbPersonnes;

  const addOption = (ligneId: string, co: CatalogueOption) => {
    const ligne = lignes.find((l) => l.id === ligneId);
    if (!ligne) return;
    const nouvelleOption: LigneOption = {
      id: nextLigneId(),
      nom: co.nom,
      prix: co.prix,
      mode: co.mode,
      quantite: co.mode === "personne" ? nbPersonnesLigne(ligne) || 1 : 1,
    };
    updateLigne(ligneId, { options: [...(ligne.options || []), nouvelleOption] });
  };

  const updateOption = (ligneId: string, optionId: string, patch: Partial<LigneOption>) => {
    setLignes((prev) =>
      prev.map((l) =>
        l.id === ligneId
          ? { ...l, options: (l.options || []).map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
          : l
      )
    );
  };

  const removeOption = (ligneId: string, optionId: string) => {
    setLignes((prev) =>
      prev.map((l) => (l.id === ligneId ? { ...l, options: (l.options || []).filter((o) => o.id !== optionId) } : l))
    );
  };

  const moisLabel =
    (dateDebut && dateFin ? `du ${fmtDDMonth(dateDebut)} au ${fmtDDMonth(dateFin)}` : "") ||
    moisLabelFromDates(lignes.map((l) => l.date)) ||
    moisLabelFromDates([dateDebut, dateFin]);

  const texte = useMemo(
    () => buildRedactionText(moisLabel, adultes, enfants, hotel, lignes, catalogue),
    [moisLabel, adultes, enfants, hotel, lignes, catalogue]
  );

  const totalGeneral = lignes.reduce((s, l) => s + ligneTotal(l), 0);

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
    const ligneSansCreneau = lignes.find((l) => l.creneau !== undefined && !l.creneau);
    if (ligneSansCreneau) {
      toast(`Choisis le créneau (matin / après-midi / coucher de soleil) de "${ligneSansCreneau.nom}" avant d'ajouter au dossier.`);
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
      const totalPersonnesLigne = Math.max(nbPersonnesLigne(l), 1);
      const remisePersonne = l.remise > 0 ? l.remise / totalPersonnesLigne : 0;
      const parAdulte = l.repartition?.find((r) => r.tranche === "adulte");
      const parEnfant = l.repartition?.find((r) => r.tranche === "enfant");
      const parEnfant3 = l.repartition?.find((r) => r.tranche === "enfant_3ans");
      const parBebe = l.repartition?.find((r) => r.tranche === "bebe");
      const champsRepartition = l.estTaxeSeule
        ? {
            tarif_mode: "personne" as const,
            participants_adultes: 0,
            pu_adulte: 0,
            pax_override: "Taxe de transfert",
          }
        : l.groupe
        ? {
            tarif_mode: "groupe" as const,
            participants_adultes: nbPersonnesLigne(l),
            prix_groupe_base: Math.max(l.groupe.base - l.remise, 0),
            prix_groupe_extra1: l.groupe.prixExtra1,
            prix_groupe_extra_enfant: l.groupe.prixExtraEnfant,
            participants_extra1: l.groupe.extra1,
            participants_extra_enfants: l.groupe.extraEnfants,
            pax_override: `${nbPersonnesLigne(l)} personnes`,
          }
        : l.repartition
        ? {
            tarif_mode: "personne" as const,
            participants_adultes: parAdulte?.nb || 0,
            participants_enfants: parEnfant?.nb || 0,
            participants_bebes: parBebe?.nb || 0,
            participants_enfants_3ans: parEnfant3?.nb || 0,
            pu_adulte: Math.max((parAdulte?.pu || 0) - remisePersonne, 0),
            pu_enfant: Math.max((parEnfant?.pu || 0) - remisePersonne, 0),
            pu_bebe: Math.max((parBebe?.pu || 0) - remisePersonne, 0),
            pu_enfant_3ans: Math.max((parEnfant3?.pu || 0) - remisePersonne, 0),
            pax_override: "",
          }
        : {
            tarif_mode: "personne" as const,
            participants_adultes: l.nbPersonnes,
            pu_adulte: l.remise > 0 ? Math.max(l.prixParPersonne - l.remise / Math.max(l.nbPersonnes, 1), 0) : l.prixParPersonne,
            pax_override: `${l.nbPersonnes} personnes`,
          };
      const { data: inserted, error } = await supabase
        .from("reservations")
        .insert({
          client_id: clientId,
          nom_activite: l.nom,
          catalogue_item_id: l.catalogueItemId || null,
          participants_mode: "custom",
          ...champsRepartition,
          horaire_approx: item?.horaire_approx || "",
          inclus: (item?.inclus_liste || []).join(", ") || item?.inclus || "",
          non_inclus: (item?.non_inclus_liste || []).join(", ") || item?.non_inclus || "",
          a_prevoir: (item?.a_prevoir_liste || []).join(", ") || item?.a_prevoir || "",
          point_rdv: item?.point_rdv || "",
          creneau: l.creneau || "",
          photo_path: item?.photo_path || "",
          date_debut: l.date || null,
          transfert_inclus: !(l.taxeTransfert > 0),
          transfert_montant: l.taxeTransfert || 0,
          zone_transfert: villeClient,
          cree_par_id: user?.id || null,
          cree_par_nom: creeParNom,
          statut_resa: clientSelectionne?.statut === "Client confirmé" ? "Confirmée" : "Brouillon",
        })
        .select()
        .single();
      if (error || !inserted) {
        toast("Échec de l'ajout d'une activité.");
        setSaving(false);
        return;
      }
      for (const o of l.options || []) {
        const { error: optError } = await supabase.from("reservation_options").insert({
          reservation_id: inserted.id,
          nom: o.nom,
          prix: o.prix,
          quantite: o.mode === "personne" ? o.quantite : 1,
          prix_compte_ailleurs: false,
          verrouille: false,
        });
        if (optError) toast(`Activité ajoutée mais échec de l'option "${o.nom}".`);
      }
    }
    setSaving(false);
    toast(`${lignes.length} activité(s) ajoutée(s) au dossier.`, "success");
    // Une fois enregistré dans le vrai dossier, le brouillon local n'a plus
    // de raison d'être repris — sinon la prochaine ouverture de l'onglet
    // réafficherait un programme déjà traité.
    setLignes([]);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // tant pis
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#171717]">Rédaction d&apos;un programme</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Cherche le lead, confirme ses dates et le nombre de participants, puis ajoute les activités une par
          une depuis le catalogue — la date proposée respecte les jours de disponibilité de l&apos;activité, et
          le prix par personne (ou par tranche d&apos;âge), la taxe de transfert, les options et le total se
          calculent tout seuls, prêt à copier-coller.
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
          {enfants > 0 && (
            <label className="col-span-2 text-xs text-neutral-500 sm:col-span-4">
              Âges enfants (ex. 6, 9 et 14 ans) — sert à appliquer le bon tarif catalogue par tranche d&apos;âge
              <input
                type="text"
                value={agesEnfants}
                onChange={(e) => setAgesEnfants(e.target.value)}
                placeholder="ex. 2, 6 et 9 ans"
                className="input mt-1"
              />
            </label>
          )}
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
            {taxeResultat.type === "montant" && (
              <button
                type="button"
                onClick={addTaxeSeule}
                className="mt-1.5 text-[11px] font-medium text-[#0F5C56] hover:underline"
              >
                + Ajouter la taxe de transfert seule ({eurosVirgule(taxeTransfertMontant)})
              </button>
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
                    <span className="ml-2 text-xs text-neutral-400">
                      {a.tarif_mode === "groupe"
                        ? `Forfait ${eurosVirgule(a.prix_groupe_base || 0)} (${a.prix_groupe_base_pax || 0} pers.)`
                        : eurosVirgule(a.pu_adulte || 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        {lignes.length > 0 && (
          <div className="mt-3 space-y-2">
            {lignes.map((l) => {
              const item = catalogue.find((a) => a.id === l.catalogueItemId);
              const joursDispo = item ? normalizeJoursDisponibles(item.jours_disponibles) : [];
              const contrainteJours = joursDispo.length > 0 && joursDispo.length < 7;
              const catOptions = item ? catalogueOptions[item.id] || [] : [];
              const optionsDisponibles = catOptions.filter((co) => !(l.options || []).some((o) => o.nom === co.nom));
              return (
                <div key={l.id} className="rounded-md border border-neutral-200 p-2.5">
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={l.nom}
                      onChange={(e) => updateLigne(l.id, { nom: e.target.value })}
                      className="input flex-1 text-sm"
                    />
                    <span className="shrink-0 self-center font-amounts text-xs font-medium text-[#0F5C56]">
                      {eurosVirgule(ligneTotal(l))}
                    </span>
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
                      {contrainteJours && (
                        <span className="mt-0.5 block text-[10px] text-[#8B4531]">
                          Circule uniquement : {joursDispo.join(", ")}
                        </span>
                      )}
                    </label>
                    {l.creneau !== undefined && (
                      <label className="text-[11px] text-neutral-500">
                        Créneau *
                        <select
                          value={l.creneau}
                          onChange={(e) => updateLigne(l.id, { creneau: e.target.value })}
                          className={`input mt-0.5 text-sm ${!l.creneau ? "border-red-300" : ""}`}
                        >
                          <option value="">— Choisir —</option>
                          {CRENEAUX_ACTIVITE.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {!l.creneau && <span className="mt-0.5 block text-[10px] text-red-600">Obligatoire</span>}
                      </label>
                    )}
                    {!l.repartition && !l.groupe && !l.estTaxeSeule && (
                      <>
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
                      </>
                    )}
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

                  {l.repartition && l.repartition.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-md bg-[#fafafa] p-2">
                      <p className="text-[11px] font-medium text-neutral-500">Répartition par tranche d&apos;âge</p>
                      {l.repartition.map((r, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 font-medium text-[#171717]">
                            {r.tranche === "adulte" ? "Adulte" : r.label || "Enfant"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={r.pu}
                            onChange={(e) => updateRepartitionRow(l.id, idx, { pu: Math.max(0, Number(e.target.value)) })}
                            className="input w-20 text-xs"
                          />
                          <span className="text-neutral-400">€ ×</span>
                          <input
                            type="number"
                            min={0}
                            value={r.nb}
                            onChange={(e) => updateRepartitionRow(l.id, idx, { nb: Math.max(0, Number(e.target.value)) })}
                            className="input w-16 text-xs"
                          />
                          <span className="text-neutral-500">= {eurosVirgule(r.pu * r.nb)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {l.groupe && (
                    <div className="mt-2 space-y-1 rounded-md bg-[#fafafa] p-2 text-xs">
                      <p className="text-[11px] font-medium text-neutral-500">
                        Forfait groupe — {l.groupe.basePax} pers. incluse(s)
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 font-medium text-[#171717]">Forfait de base</span>
                        <input
                          type="number"
                          min={0}
                          value={l.groupe.base}
                          onChange={(e) => updateLigne(l.id, { groupe: { ...l.groupe!, base: Math.max(0, Number(e.target.value)) } })}
                          className="input w-20 text-xs"
                        />
                        <span className="text-neutral-400">€</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 font-medium text-[#171717]">Adulte(s) suppl.</span>
                        <input
                          type="number"
                          min={0}
                          value={l.groupe.extra1}
                          onChange={(e) => updateLigne(l.id, { groupe: { ...l.groupe!, extra1: Math.max(0, Number(e.target.value)) } })}
                          className="input w-16 text-xs"
                        />
                        <span className="text-neutral-400">×</span>
                        <input
                          type="number"
                          min={0}
                          value={l.groupe.prixExtra1}
                          onChange={(e) => updateLigne(l.id, { groupe: { ...l.groupe!, prixExtra1: Math.max(0, Number(e.target.value)) } })}
                          className="input w-20 text-xs"
                        />
                        <span className="text-neutral-500">€ = {eurosVirgule(l.groupe.extra1 * l.groupe.prixExtra1)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-36 shrink-0 font-medium text-[#171717]">Enfant(s) suppl.</span>
                        <input
                          type="number"
                          min={0}
                          value={l.groupe.extraEnfants}
                          onChange={(e) => updateLigne(l.id, { groupe: { ...l.groupe!, extraEnfants: Math.max(0, Number(e.target.value)) } })}
                          className="input w-16 text-xs"
                        />
                        <span className="text-neutral-400">×</span>
                        <input
                          type="number"
                          min={0}
                          value={l.groupe.prixExtraEnfant}
                          onChange={(e) => updateLigne(l.id, { groupe: { ...l.groupe!, prixExtraEnfant: Math.max(0, Number(e.target.value)) } })}
                          className="input w-20 text-xs"
                        />
                        <span className="text-neutral-500">€ = {eurosVirgule(l.groupe.extraEnfants * l.groupe.prixExtraEnfant)}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-2">
                    <p className="text-[11px] text-neutral-500">Options / suppléments</p>
                    {(l.options || []).map((o) => (
                      <div key={o.id} className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-[#171717]">{o.nom}</span>
                        <input
                          type="number"
                          min={0}
                          value={o.prix}
                          onChange={(e) => updateOption(l.id, o.id, { prix: Math.max(0, Number(e.target.value)) })}
                          className="input w-20 text-xs"
                        />
                        <span className="text-neutral-400">€</span>
                        {o.mode === "personne" && (
                          <>
                            <span className="text-neutral-400">×</span>
                            <input
                              type="number"
                              min={0}
                              value={o.quantite}
                              onChange={(e) => updateOption(l.id, o.id, { quantite: Math.max(0, Number(e.target.value)) })}
                              className="input w-16 text-xs"
                            />
                            <span className="text-neutral-500">= {eurosVirgule(o.prix * o.quantite)}</span>
                          </>
                        )}
                        <button type="button" onClick={() => removeOption(l.id, o.id)} className="text-red-600">
                          ✕
                        </button>
                      </div>
                    ))}
                    {optionsDisponibles.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {optionsDisponibles.map((co) => (
                          <button
                            key={co.id}
                            type="button"
                            onClick={() => addOption(l.id, co)}
                            className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
                          >
                            + {co.nom} ({eurosVirgule(co.prix)} {co.mode === "groupe" ? "groupe" : "/pers."})
                          </button>
                        ))}
                      </div>
                    )}
                    {optionsDisponibles.length === 0 && (l.options || []).length === 0 && (
                      <p className="mt-1 text-[11px] text-neutral-400">Aucune option pour cette activité.</p>
                    )}
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
              );
            })}
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
