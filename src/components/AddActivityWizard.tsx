"use client";

import { useState } from "react";
import {
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  Client,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { CHAMPS_REQUIS_PRESETS, CRENEAUX_ACTIVITE, OPTIONS_PRESETS } from "@/lib/constants";
import {
  groupeExtraCounts,
  isChevalOuChameau,
  isDeuxiemeIleOption,
  isSafariQuadBase,
  isSpeedboatFixedJournee,
  isSpeedboatPriveMaisonDauphins,
  needsCreneauSafariBuggy,
  needsMomentSpeedboat,
  participantsFor,
  resaTotalMontant,
  speedboatIleTitre,
  speedboatIleType,
  SPEEDBOAT_ILES,
} from "@/lib/resa";
import { Field } from "@/components/Field";
import ActivityRedirectAlert from "@/components/ActivityRedirectAlert";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Pour les activités spa/massage, "moment" (matin/après-midi/journée/plusieurs
// jours) ne veut rien dire — on demande un horaire précis à la place.
function isSpaMassage(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("spa") || n.includes("massage");
}

const MOMENTS_SPEEDBOAT = ["Matin", "Après-midi"] as const;

const MAISON_DAUPHINS_TEXT =
  "Les speedboat privé maison des dauphins sont recommandés le matin pour davantage de chances de voir les dauphins.";

// Le Caire/Louxor "en bus" (grand groupe, toutes nationalités mélangées) —
// on pousse à recommander la formule mini-bus à la place avant de laisser
// ajouter cette version, sauf si "mini" est déjà dans le nom.
function isDiscouragedBusActivity(nom: string) {
  const n = (nom || "").toLowerCase();
  return (n.includes("caire") || n.includes("louxor")) && n.includes("bus") && !n.includes("mini");
}

const MINI_BUS_TEXT =
  "Nous recommandons davantage la formule en mini-bus : c'est beaucoup plus confortable, avec seulement 8 à 9 personnes maximum, contre une cinquantaine de personnes pour la formule en bus. En mini-bus, l'excursion est aussi majoritairement francophone, alors qu'en bus toutes les nationalités sont mélangées. Le tarif pour la formule en mini-bus est de 85 € par personne.";

// Le Grand Safari Bédouin est pensé pour les familles avec enfants — pour
// un groupe composé uniquement d'adultes, on pousse plutôt vers le quad,
// le buggy ou le safari mix.
function isFamilySafariBedouin(nom: string) {
  const n = (nom || "").toLowerCase();
  return n.includes("safari") && n.includes("bédouin");
}

function isAdultsOnly(client: Client) {
  return (client.enfants || 0) === 0 && (client.bebes || 0) === 0;
}

const SAFARI_ADULTS_TEXT =
  "Le Grand Safari Bédouin est une activité pensée pour les familles avec enfants, avec des temps d'activité très courts (30 min de quad, 15 min de buggy). Pour des adultes, nous recommandons plutôt l'excursion quad classique de 2h : vous en profiterez beaucoup plus, tout en découvrant vous aussi le village bédouin. Vous pouvez même combiner l'excursion quad avec le dîner spectacle, pour le même tarif que le Grand Safari Bédouin.";

// Le titre affiché (nom_activite) se recalcule à chaque étape qui le
// concerne (île / moment / créneau), toujours à partir du nom catalogue de
// base — jamais en concaténant sur le titre déjà modifié, pour rester
// idempotent si l'employée revient en arrière et change sa réponse.
function baseTitleFor(catalogueItem: CatalogueItem, ileSelectionnee: string, ileSelectionnee2?: string) {
  const iType = speedboatIleType(catalogueItem.nom);
  return iType && ileSelectionnee
    ? speedboatIleTitre(iType, ileSelectionnee, ileSelectionnee2 || undefined)
    : catalogueItem.nom;
}

function titleWithSuffix(base: string, suffix: string) {
  return suffix ? `${base} — ${suffix}` : base;
}


type Step =
  | "choix"
  | "specifs"
  | "date"
  | "ile"
  | "moment"
  | "creneau"
  | "participants"
  | "monte"
  | "tarifs"
  | "options"
  | "transfert";

const STEP_TITLES: Record<Step, string> = {
  choix: "Choisir une activité",
  specifs: "Informations requises",
  date: "Date de l'activité",
  ile: "Choix de l'île",
  moment: "Matin ou après-midi",
  creneau: "Matin, après-midi ou coucher de soleil",
  participants: "Nombre de participants",
  monte: "Monte des enfants",
  tarifs: "Tarifs",
  options: "Options supplémentaires",
  transfert: "Taxe de transfert",
};

// Ajouter une nouvelle activité est le moment où il y a le plus de champs à
// remplir d'un coup — une question par écran plutôt que de montrer le
// formulaire complet de ReservationCard. Modifier une activité déjà créée
// continue d'utiliser ce formulaire complet (choix assumé : une fois
// l'activité posée, tout reste modifiable librement depuis un seul écran).
export default function AddActivityWizard({
  client,
  catalogue,
  catalogueTarifs,
  catalogueOptions,
  hotelHorsHurghada,
  onAddReservation,
  onUpdateReservation,
  onDeleteReservation,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onAddTarif,
  onUpdateTarif,
  onDeleteTarif,
  reservations,
  resaOptions,
  resaTarifs,
  onFinish,
  onCancel,
  onBusEscalation,
}: {
  client: Client;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  catalogueOptions: Record<string, CatalogueOption[]>;
  hotelHorsHurghada?: boolean;
  onBusEscalation: (nomActivite: string, reservationId: string) => Promise<void>;
  onAddReservation: () => Promise<string | null>;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onDeleteReservation: (id: string) => void;
  onAddOption: (resaId: string, seed?: { nom: string; prix: number }) => void;
  onUpdateOption: (resaId: string, optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (resaId: string, optId: string) => void;
  onAddTarif: (resaId: string, seed?: { label: string; pu: number }) => void;
  onUpdateTarif: (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => void;
  onDeleteTarif: (resaId: string, tarifId: string) => void;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("choix");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  // Une activité personnalisée doit être rattachée à une activité existante
  // du catalogue pour compter dans les statistiques (marges, top des
  // ventes…) qui se calculent par catalogue_item_id.
  const [customLinkId, setCustomLinkId] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<{
    item: CatalogueItem;
    kind: "bus" | "safari";
  } | null>(null);
  const [validationError, setValidationError] = useState(false);
  const [showPaxOverride, setShowPaxOverride] = useState(false);
  // Une activité personnalisée garde le titre tapé à la main — on ne le
  // recalcule jamais automatiquement (île / moment / créneau / nb de
  // chevaux) dans ce cas, contrairement aux activités venant du catalogue.
  const [isCustomFlow, setIsCustomFlow] = useState(false);

  const r = reservations.find((x) => x.id === draftId) || null;
  const options = draftId ? resaOptions[draftId] || [] : [];
  const tarifs = draftId ? resaTarifs[draftId] || [] : [];
  const catalogueItem = r?.catalogue_item_id ? catalogue.find((a) => a.id === r.catalogue_item_id) : null;
  const champsRequis = catalogueItem?.champs_requis_liste || [];
  const champsRequisPersonnalises = champsRequis.filter(
    (c) => !(CHAMPS_REQUIS_PRESETS as readonly string[]).includes(c)
  );
  const catTarifs = catalogueItem ? catalogueTarifs[catalogueItem.id] || [] : [];
  const catOptions = catalogueItem ? catalogueOptions[catalogueItem.id] || [] : [];

  const nbEnfantsParticipants = r ? participantsFor(r, client).nbEnf : 0;
  const showMonteStep =
    !!catalogueItem && isChevalOuChameau(catalogueItem.nom) && nbEnfantsParticipants > 0;

  const steps: Step[] = ["choix"];
  if (champsRequis.length > 0) steps.push("specifs");
  steps.push("date");
  if (catalogueItem && speedboatIleType(catalogueItem.nom)) steps.push("ile");
  if (catalogueItem && needsMomentSpeedboat(catalogueItem.nom)) steps.push("moment");
  if (catalogueItem && needsCreneauSafariBuggy(catalogueItem.nom)) steps.push("creneau");
  steps.push("participants");
  if (showMonteStep) steps.push("monte");
  steps.push("tarifs", "options", "transfert");
  const stepIndex = steps.indexOf(step);

  const startFromCatalogue = async (item: CatalogueItem): Promise<string | null> => {
    if (creating) return null;
    setCreating(true);
    setIsCustomFlow(false);
    const id = await onAddReservation();
    if (id) {
      onUpdateReservation(id, {
        nom_activite: item.nom,
        catalogue_item_id: item.id,
        pu_adulte: item.pu_adulte,
        pu_enfant: item.pu_enfant,
        pu_accompagnateur: item.pu_accompagnateur,
        pu_enfant_3ans: item.pu_enfant_3ans,
        tarif_mode: item.tarif_mode,
        prix_groupe_base: item.prix_groupe_base,
        prix_groupe_extra1: item.prix_groupe_extra1,
        prix_groupe_extra_enfant: item.prix_groupe_extra_enfant,
        horaire_approx: item.horaire_approx,
        inclus: (item.inclus_liste || []).join(", ") || item.inclus,
        non_inclus: item.non_inclus,
        a_prevoir: item.a_prevoir,
        point_rdv: item.point_rdv,
        photo_path: item.photo_path,
        transfert_inclus: !hotelHorsHurghada,
        moment: isSpeedboatFixedJournee(item.nom) ? "Journée" : "",
        ile_selectionnee: "",
        ile_selectionnee_2: "",
      });
      setDraftId(id);
      setValidationError(false);
      setStep((item.champs_requis_liste || []).length > 0 ? "specifs" : "date");
    }
    setCreating(false);
    return id;
  };

  const startCustom = async () => {
    if (creating || !customName.trim() || !customLinkId) return;
    setCreating(true);
    setIsCustomFlow(true);
    const linked = catalogue.find((a) => a.id === customLinkId);
    const id = await onAddReservation();
    if (id) {
      onUpdateReservation(id, {
        nom_activite: customName.trim(),
        catalogue_item_id: customLinkId,
        transfert_inclus: !hotelHorsHurghada,
        moment: linked && isSpeedboatFixedJournee(linked.nom) ? "Journée" : "",
        ile_selectionnee: "",
        ile_selectionnee_2: "",
      });
      setDraftId(id);
      setValidationError(false);
      setStep(linked && (linked.champs_requis_liste || []).length > 0 ? "specifs" : "date");
    }
    setCreating(false);
  };

  const cancel = () => {
    if (draftId) onDeleteReservation(draftId);
    setDraftId(null);
    setStep("choix");
    setCustomName("");
    setCustomLinkId("");
    setValidationError(false);
    setIsCustomFlow(false);
    onCancel();
  };

  const goBack = () => {
    setValidationError(false);
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const wrap = (children: React.ReactNode) => (
    <div className="rounded-md border border-[#666666]/20 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#171717]">{STEP_TITLES[step]}</p>
        <span className="text-xs text-neutral-400">
          Étape {stepIndex + 1}/{steps.length}
        </span>
      </div>
      {r && step !== "choix" && (
        <p className="mb-3 text-sm text-neutral-500">
          {r.nom_activite}
          {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
        </p>
      )}
      {children}
    </div>
  );

  const navButtons = (goNext: () => void, nextLabel: string) => (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={step === "specifs" || step === "date" ? cancel : goBack}
        className="rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
      >
        {step === "specifs" || step === "date" ? "Annuler" : "Précédent"}
      </button>
      <button
        type="button"
        onClick={goNext}
        className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {nextLabel}
      </button>
    </div>
  );

  if (step === "choix") {
    return wrap(
      <>
        {pendingRedirect && (
          <ActivityRedirectAlert
            nomActivite={pendingRedirect.item.nom}
            warningText={
              pendingRedirect.kind === "bus"
                ? "Merci d'essayer de rediriger les clients vers l'excursion en mini-bus."
                : "Cette activité est pensée pour les familles avec enfants, merci de rediriger les clients vers l'excursion quad ou l'excursion buggy ou, si possible, safari mix (minimum 3 pers.)."
            }
            copyText={pendingRedirect.kind === "bus" ? MINI_BUS_TEXT : SAFARI_ADULTS_TEXT}
            proceedLabel={
              pendingRedirect.kind === "bus"
                ? "Les clients ne souhaitent pas la formule en mini-bus"
                : "Les clients préfèrent quand même le Grand Safari Bédouin"
            }
            onCancel={() => setPendingRedirect(null)}
            onProceedAnyway={async () => {
              const { item } = pendingRedirect;
              setPendingRedirect(null);
              const newId = await startFromCatalogue(item);
              if (newId) await onBusEscalation(item.nom, newId);
            }}
          />
        )}
        {catalogue.length > 0 && (
          <div className="mb-3 space-y-2">
            {catalogue.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={creating}
                onClick={() => {
                  if (isDiscouragedBusActivity(a.nom)) {
                    setPendingRedirect({ item: a, kind: "bus" });
                  } else if (isFamilySafariBedouin(a.nom) && isAdultsOnly(client)) {
                    setPendingRedirect({ item: a, kind: "safari" });
                  } else {
                    startFromCatalogue(a);
                  }
                }}
                className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-sm hover:border-[#171717] disabled:opacity-50"
              >
                <span className="block font-medium text-[#171717]">{a.nom}</span>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <input
            placeholder="Ou activité personnalisée…"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="input"
          />
          <select
            value={customLinkId}
            onChange={(e) => setCustomLinkId(e.target.value)}
            className="input"
          >
            <option value="">Rattachée à quelle activité du catalogue ? *</option>
            {catalogue.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-400">
            Nécessaire pour que cette activité compte dans les statistiques de l&apos;activité du
            catalogue correspondante.
          </p>
          <button
            type="button"
            disabled={creating || !customName.trim() || !customLinkId}
            onClick={startCustom}
            className="w-full rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Créer
          </button>
        </div>
        <button type="button" onClick={onCancel} className="mt-3 text-xs text-neutral-400 hover:underline">
          Annuler
        </button>
      </>
    );
  }

  if (!r) return null;

  if (step === "specifs") {
    const missing: string[] = [];
    if (champsRequis.includes("Pointure") && !r.pointure.trim()) missing.push("Pointure");
    if (champsRequis.includes("Créneau (matin / après-midi / coucher de soleil)") && !r.creneau) {
      missing.push("Créneau");
    }
    if (
      champsRequis.includes("Conducteurs & passagers") &&
      (r.nb_conducteurs == null || r.nb_passagers == null)
    ) {
      missing.push("Conducteurs & passagers");
    }
    if (champsRequis.includes("Vol & horaire") && (!r.numero_vol.trim() || !r.horaire_vol.trim())) {
      missing.push("Vol & horaire");
    }
    champsRequisPersonnalises.forEach((c) => {
      if (!(r.champs_requis_coches || []).includes(c)) missing.push(c);
    });

    const goNext = () => {
      if (missing.length > 0) {
        setValidationError(true);
        return;
      }
      setValidationError(false);
      setStep("date");
    };

    return wrap(
      <>
        <div className="grid grid-cols-2 gap-3">
          {champsRequis.includes("Pointure") && (
            <Field label="Pointure *">
              <input
                value={r.pointure}
                onChange={(e) => onUpdateReservation(r.id, { pointure: e.target.value })}
                className={`input ${
                  validationError && !r.pointure.trim() ? "border-red-300 focus:border-red-400" : ""
                }`}
              />
            </Field>
          )}
          {champsRequis.includes("Créneau (matin / après-midi / coucher de soleil)") && (
            <Field label="Créneau *">
              <select
                value={r.creneau}
                onChange={(e) => {
                  const creneau = e.target.value;
                  onUpdateReservation(r.id, {
                    creneau,
                    ...(catalogueItem && !isCustomFlow
                      ? {
                          nom_activite: titleWithSuffix(
                            baseTitleFor(catalogueItem, r.ile_selectionnee, r.ile_selectionnee_2),
                            creneau
                          ),
                        }
                      : {}),
                  });
                }}
                className={`input ${
                  validationError && !r.creneau ? "border-red-300 focus:border-red-400" : ""
                }`}
              >
                <option value="">—</option>
                {CRENEAUX_ACTIVITE.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
          {champsRequis.includes("Conducteurs & passagers") && (
            <>
              <Field label="Conducteurs *">
                <input
                  type="number"
                  min={0}
                  value={r.nb_conducteurs ?? ""}
                  onChange={(e) =>
                    onUpdateReservation(r.id, {
                      nb_conducteurs: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className={`input ${
                    validationError && r.nb_conducteurs == null
                      ? "border-red-300 focus:border-red-400"
                      : ""
                  }`}
                />
              </Field>
              <Field label="Passagers *">
                <input
                  type="number"
                  min={0}
                  value={r.nb_passagers ?? ""}
                  onChange={(e) =>
                    onUpdateReservation(r.id, {
                      nb_passagers: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className={`input ${
                    validationError && r.nb_passagers == null
                      ? "border-red-300 focus:border-red-400"
                      : ""
                  }`}
                />
              </Field>
            </>
          )}
          {champsRequis.includes("Vol & horaire") && (
            <>
              <Field label="Numéro de vol *">
                <input
                  value={r.numero_vol}
                  onChange={(e) => onUpdateReservation(r.id, { numero_vol: e.target.value })}
                  className={`input ${
                    validationError && !r.numero_vol.trim() ? "border-red-300 focus:border-red-400" : ""
                  }`}
                />
              </Field>
              <Field label="Horaire de vol *">
                <input
                  value={r.horaire_vol}
                  onChange={(e) => onUpdateReservation(r.id, { horaire_vol: e.target.value })}
                  className={`input ${
                    validationError && !r.horaire_vol.trim() ? "border-red-300 focus:border-red-400" : ""
                  }`}
                />
              </Field>
            </>
          )}
        </div>
        {champsRequisPersonnalises.length > 0 && (
          <div className="mt-3 space-y-2">
            {champsRequisPersonnalises.map((c) => {
              const checked = (r.champs_requis_coches || []).includes(c);
              return (
                <label
                  key={c}
                  className={`flex items-center gap-2 text-sm text-neutral-700 ${
                    validationError && !checked ? "text-red-600" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onUpdateReservation(r.id, {
                        champs_requis_coches: e.target.checked
                          ? [...(r.champs_requis_coches || []), c]
                          : (r.champs_requis_coches || []).filter((x) => x !== c),
                      })
                    }
                  />
                  {c} *
                </label>
              );
            })}
          </div>
        )}

        {validationError && missing.length > 0 && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ Impossible de continuer — champs manquants : {missing.join(", ")}
          </div>
        )}

        {navButtons(goNext, "Suivant — Date")}
      </>
    );
  }

  if (step === "date") {
    const isSpa = isSpaMassage(r.nom_activite);
    const missingHoraire = isSpa && !r.horaire_souhaite;
    const nextStep = steps[steps.indexOf("date") + 1];
    const nextLabel =
      nextStep === "ile"
        ? "Suivant — Île"
        : nextStep === "moment"
          ? "Suivant — Matin/après-midi"
          : nextStep === "creneau"
            ? "Suivant — Créneau"
            : "Suivant — Participants";

    const goNext = () => {
      if (missingHoraire) {
        setValidationError(true);
        return;
      }
      setValidationError(false);
      setStep(nextStep);
    };

    return wrap(
      <>
        <Field label="Date début">
          <input
            type="date"
            value={r.date_debut ?? ""}
            onChange={(e) => onUpdateReservation(r.id, { date_debut: e.target.value || null })}
            className="input max-w-[220px]"
          />
        </Field>
        {isSpa && (
          <div className="mt-3">
            <Field label="Horaire souhaité *">
              <input
                type="time"
                value={r.horaire_souhaite}
                onChange={(e) => onUpdateReservation(r.id, { horaire_souhaite: e.target.value })}
                className={`input ${missingHoraire && validationError ? "border-red-300 focus:border-red-400" : ""}`}
              />
            </Field>
          </div>
        )}

        {validationError && missingHoraire && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ Impossible de continuer — l&apos;horaire souhaité est obligatoire.
          </div>
        )}

        {navButtons(goNext, nextLabel)}
      </>
    );
  }

  if (step === "ile") {
    const iType = speedboatIleType(catalogueItem?.nom || r.nom_activite);
    const missingIle = !r.ile_selectionnee;
    const nextStep = steps[steps.indexOf("ile") + 1];
    const nextLabel =
      nextStep === "moment"
        ? "Suivant — Matin/après-midi"
        : nextStep === "creneau"
          ? "Suivant — Créneau"
          : "Suivant — Participants";

    const selectIle = (ile: string) => {
      onUpdateReservation(r.id, {
        ile_selectionnee: ile,
        nom_activite: speedboatIleTitre(iType || "complete", ile, r.ile_selectionnee_2 || undefined),
      });
      setValidationError(false);
    };

    const goNext = () => {
      if (missingIle) {
        setValidationError(true);
        return;
      }
      setStep(nextStep);
    };

    return wrap(
      <>
        <div className="grid grid-cols-2 gap-2">
          {SPEEDBOAT_ILES.map((ile) => (
            <button
              key={ile}
              type="button"
              onClick={() => selectIle(ile)}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                r.ile_selectionnee === ile
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-200 text-neutral-700 hover:border-[#171717]"
              }`}
            >
              {ile}
            </button>
          ))}
        </div>
        {r.ile_selectionnee === "Oziréa" && (
          <p className="mt-3 text-xs font-medium text-[#0F5C56]">
            ℹ️ Supplément Oziréa appliqué automatiquement : +30 € par adulte, +15 € par enfant.
          </p>
        )}
        {validationError && missingIle && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ Impossible de continuer — merci de sélectionner une île.
          </div>
        )}

        {navButtons(goNext, nextLabel)}
      </>
    );
  }

  if (step === "moment") {
    const missingMoment = !r.moment;
    const nextStep = steps[steps.indexOf("moment") + 1];
    const isMaisonDauphins = isSpeedboatPriveMaisonDauphins(catalogueItem?.nom || r.nom_activite);

    const goNext = () => {
      if (missingMoment) {
        setValidationError(true);
        return;
      }
      setValidationError(false);
      setStep(nextStep);
    };

    return wrap(
      <>
        {isMaisonDauphins && (
          <div className="mb-3 flex items-start gap-2 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">
            <span>⚠</span>
            <span>{MAISON_DAUPHINS_TEXT}</span>
          </div>
        )}
        <div className="flex gap-2">
          {MOMENTS_SPEEDBOAT.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onUpdateReservation(r.id, {
                  moment: m,
                  ...(catalogueItem && !isCustomFlow
                    ? { nom_activite: titleWithSuffix(baseTitleFor(catalogueItem, r.ile_selectionnee, r.ile_selectionnee_2), m) }
                    : {}),
                });
                setValidationError(false);
              }}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                r.moment === m
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {validationError && missingMoment && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ Impossible de continuer — merci de sélectionner matin ou après-midi.
          </div>
        )}

        {navButtons(goNext, "Suivant — Participants")}
      </>
    );
  }

  if (step === "creneau") {
    const missingCreneau = !r.creneau;
    const selectCreneau = (c: string) => {
      onUpdateReservation(r.id, {
        creneau: c,
        ...(catalogueItem && !isCustomFlow && isSafariQuadBase(catalogueItem.nom)
          ? { nom_activite: c === "Coucher de soleil" ? "Safari quad au coucher du soleil" : catalogueItem.nom }
          : {}),
      });
      setValidationError(false);
    };

    const goNext = () => {
      if (missingCreneau) {
        setValidationError(true);
        return;
      }
      setStep(steps[steps.indexOf("creneau") + 1]);
    };

    return wrap(
      <>
        <div className="flex gap-2">
          {CRENEAUX_ACTIVITE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCreneau(c)}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                r.creneau === c
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {validationError && missingCreneau && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ Impossible de continuer — merci de sélectionner un créneau.
          </div>
        )}

        {navButtons(goNext, "Suivant — Participants")}
      </>
    );
  }

  if (step === "participants") {
    return wrap(
      <>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUpdateReservation(r.id, { participants_mode: "tous" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode !== "custom"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Tous ({client.adultes} ad. + {client.enfants} enf.)
          </button>
          <button
            type="button"
            onClick={() => onUpdateReservation(r.id, { participants_mode: "custom" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode === "custom"
                ? "border-[#C9973E] bg-[#C9973E] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Personnaliser
          </button>
        </div>
        {r.participants_mode === "custom" && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field label="Adultes participants">
              <input
                type="number"
                value={r.participants_adultes}
                onChange={(e) =>
                  onUpdateReservation(r.id, { participants_adultes: Number(e.target.value) })
                }
                className="input"
              />
            </Field>
            <Field label="Enfants participants">
              <input
                type="number"
                value={r.participants_enfants}
                onChange={(e) =>
                  onUpdateReservation(r.id, { participants_enfants: Number(e.target.value) })
                }
                className="input"
              />
            </Field>
            <Field label="Accompagnateurs">
              <input
                type="number"
                value={r.participants_accompagnateurs}
                onChange={(e) =>
                  onUpdateReservation(r.id, { participants_accompagnateurs: Number(e.target.value) })
                }
                className="input"
              />
            </Field>
            <Field label="Enfants 3 ans">
              <input
                type="number"
                value={r.participants_enfants_3ans}
                onChange={(e) =>
                  onUpdateReservation(r.id, { participants_enfants_3ans: Number(e.target.value) })
                }
                className="input"
              />
            </Field>
            <Field label="Noms">
              <input
                value={r.participants_noms}
                onChange={(e) => onUpdateReservation(r.id, { participants_noms: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        )}
        <div className="mt-3">
          {catalogueItem && isChevalOuChameau(catalogueItem.nom) && nbEnfantsParticipants > 0 && (
            <p className="mb-2 text-xs font-semibold text-red-600">
              ⚠ Conseillé : écrivez vous-même le texte affiché ci-dessous. Exemple : « 3 participants
              à cheval, 2 passagers »
            </p>
          )}
          <label
            className={`flex items-center gap-2 text-xs ${
              catalogueItem && isChevalOuChameau(catalogueItem.nom) && nbEnfantsParticipants > 0
                ? "font-semibold text-red-600"
                : "text-neutral-500"
            }`}
          >
            <input
              type="checkbox"
              checked={showPaxOverride}
              onChange={(e) => {
                setShowPaxOverride(e.target.checked);
                if (!e.target.checked) onUpdateReservation(r.id, { pax_override: "" });
              }}
            />
            Écrire moi-même le texte affiché (ex. « 2 participants, 1 accompagnateur »)
          </label>
          {showPaxOverride && (
            <input
              placeholder="Texte à afficher"
              value={r.pax_override}
              onChange={(e) => onUpdateReservation(r.id, { pax_override: e.target.value })}
              className="input mt-1"
            />
          )}
        </div>

        {navButtons(() => {
          // Certaines activités du catalogue démarrent déjà en forfait
          // groupe (tarif_mode copié depuis le catalogue) — sans ce
          // pré-remplissage ici, le clic sur "Forfait groupe" (qui fait le
          // même travail) n'a jamais lieu puisque le mode est déjà actif.
          if (r.tarif_mode === "groupe") {
            const { nbAd, nbEnf } = participantsFor(r, client);
            const { extra1, extraEnfants } = groupeExtraCounts(
              nbAd,
              nbEnf,
              catalogueItem?.prix_groupe_base_pax ?? 0
            );
            onUpdateReservation(r.id, {
              participants_extra1: extra1,
              participants_extra_enfants: extraEnfants,
            });
          }
          setStep(steps[steps.indexOf("participants") + 1]);
        }, showMonteStep ? "Suivant — Monte des enfants" : "Suivant — Tarifs")}
      </>
    );
  }

  if (step === "monte") {
    const { nbAd, nbEnf } = participantsFor(r, client);
    const reponses = Array.from({ length: nbEnf }, (_, i) => (r.enfants_monte || [])[i] || "seul");
    const nextStep = steps[steps.indexOf("monte") + 1];

    const setReponse = (i: number, valeur: "derriere" | "seul") => {
      const next = [...reponses];
      next[i] = valeur;
      onUpdateReservation(r.id, { enfants_monte: next });
    };

    const goNext = () => {
      const nbDerriere = reponses.filter((x) => x === "derriere").length;
      // Un enfant qui monte seul loue son propre cheval/chameau — il paie
      // donc le tarif adulte (prix par animal), pas le tarif enfant. Un
      // enfant derrière un adulte compte comme accompagnateur mais ne paie
      // rien (le tarif accompagnateur de cette activité doit être à 0 €
      // dans le catalogue).
      const nbSeul = nbEnf - nbDerriere;
      const nbChevaux = nbAd + nbSeul;
      onUpdateReservation(r.id, {
        enfants_monte: reponses,
        participants_mode: "custom",
        participants_adultes: nbChevaux,
        participants_enfants: 0,
        participants_accompagnateurs: nbDerriere,
      });
      setStep(nextStep);
    };

    return wrap(
      <>
        <p className="mb-3 text-sm text-neutral-500">
          Chaque enfant monte-t-il seul (son propre {catalogueItem?.nom.toLowerCase().includes("chameau") ? "chameau" : "cheval"}) ou derrière un adulte (accompagnateur) ?
        </p>
        <p className="mb-3 text-xs text-[#8B4531]">
          💡 Un enfant seul paie le tarif adulte (prix par animal). Un enfant derrière un adulte
          compte comme accompagnateur et ne paie rien.
        </p>
        <div className="space-y-2">
          {Array.from({ length: nbEnf }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2">
              <span className="text-sm font-medium text-[#171717]">Enfant {i + 1}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReponse(i, "seul")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    reponses[i] === "seul"
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-neutral-300 text-neutral-600"
                  }`}
                >
                  Seul
                </button>
                <button
                  type="button"
                  onClick={() => setReponse(i, "derriere")}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    reponses[i] === "derriere"
                      ? "border-[#C9973E] bg-[#C9973E] text-white"
                      : "border-neutral-300 text-neutral-600"
                  }`}
                >
                  Derrière un adulte
                </button>
              </div>
            </div>
          ))}
        </div>

        {navButtons(goNext, "Suivant — Tarifs")}
      </>
    );
  }

  if (step === "tarifs") {
    const { nbAd, nbEnf, nbAcc, nbEnf3 } = participantsFor(r, client);
    const total = resaTotalMontant(r, client, options, tarifs);

    return wrap(
      <>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => onUpdateReservation(r.id, { tarif_mode: "personne" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.tarif_mode !== "groupe"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Tarif par personne
          </button>
          <button
            type="button"
            onClick={() => {
              // Pré-remplit avec les participants déjà choisis à l'étape
              // précédente — l'employée n'a pas à ressaisir des nombres
              // qu'elle vient déjà de sélectionner. Le forfait de base
              // couvre déjà prix_groupe_base_pax personnes, donc seuls les
              // adultes au-delà comptent en supplément.
              const { extra1, extraEnfants } = groupeExtraCounts(
                nbAd,
                nbEnf,
                catalogueItem?.prix_groupe_base_pax ?? 0
              );
              onUpdateReservation(r.id, {
                tarif_mode: "groupe",
                participants_extra1: extra1,
                participants_extra_enfants: extraEnfants,
              });
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.tarif_mode === "groupe"
                ? "border-[#C9973E] bg-[#C9973E] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Forfait groupe
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {r.tarif_mode !== "groupe" ? (
            <>
              {nbAd > 0 && (
                <Field label="PU adulte (€)">
                  <input
                    type="number"
                    value={r.pu_adulte}
                    onChange={(e) => onUpdateReservation(r.id, { pu_adulte: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
              )}
              {nbEnf > 0 && (
                <Field label="PU enfant (€)">
                  <input
                    type="number"
                    value={r.pu_enfant}
                    onChange={(e) => onUpdateReservation(r.id, { pu_enfant: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
              )}
              {nbAcc > 0 && (
                <Field label="PU accompagnateur (€)">
                  <input
                    type="number"
                    value={r.pu_accompagnateur}
                    onChange={(e) =>
                      onUpdateReservation(r.id, { pu_accompagnateur: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
              )}
              {nbEnf3 > 0 && (
                <Field label="PU enfant 3 ans (€)">
                  <input
                    type="number"
                    value={r.pu_enfant_3ans}
                    onChange={(e) =>
                      onUpdateReservation(r.id, { pu_enfant_3ans: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
              )}
              {nbAd === 0 && nbEnf === 0 && nbAcc === 0 && nbEnf3 === 0 && (
                <p className="col-span-2 text-sm text-neutral-400">
                  Aucun participant à tarifer pour l&apos;instant — vérifie l&apos;étape précédente.
                </p>
              )}
            </>
          ) : (
            <>
              <Field label="Prix forfait de base (€)">
                <input
                  type="number"
                  value={r.prix_groupe_base}
                  onChange={(e) =>
                    onUpdateReservation(r.id, { prix_groupe_base: Number(e.target.value) })
                  }
                  className="input"
                />
              </Field>
              <Field label="PU personne supp. (€)">
                <input
                  type="number"
                  value={r.prix_groupe_extra1}
                  onChange={(e) =>
                    onUpdateReservation(r.id, { prix_groupe_extra1: Number(e.target.value) })
                  }
                  className="input"
                />
              </Field>
              {nbEnf > 0 && (
                <Field label="PU enfant supp. (€)">
                  <input
                    type="number"
                    value={r.prix_groupe_extra_enfant}
                    onChange={(e) =>
                      onUpdateReservation(r.id, { prix_groupe_extra_enfant: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
              )}
              <Field label="Nb personnes supp.">
                <input
                  type="number"
                  min={0}
                  value={r.participants_extra1}
                  onChange={(e) =>
                    onUpdateReservation(r.id, { participants_extra1: Number(e.target.value) })
                  }
                  className="input"
                />
              </Field>
              {nbEnf > 0 && (
                <Field label="Nb enfants supp.">
                  <input
                    type="number"
                    min={0}
                    value={r.participants_extra_enfants}
                    onChange={(e) =>
                      onUpdateReservation(r.id, { participants_extra_enfants: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
              )}
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Pour une réduction, ajuste directement les prix unitaires ci-dessus.
        </p>

        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-neutral-500">
            PU supplémentaire (accompagnateur, passager, bébé…)
          </p>
          {tarifs.map((t) => (
            <div key={t.id} className="mb-2 flex flex-wrap items-center gap-2">
              <input
                placeholder="Ex. Accompagnateur"
                value={t.label}
                onChange={(e) => onUpdateTarif(r.id, t.id, { label: e.target.value })}
                className="input min-w-[160px] flex-1"
              />
              <input
                type="number"
                placeholder="PU €"
                value={t.pu}
                onChange={(e) => onUpdateTarif(r.id, t.id, { pu: Number(e.target.value) })}
                className="input w-24"
              />
              <span className="text-xs text-neutral-400">×</span>
              <input
                type="number"
                min={0}
                placeholder="Qté"
                value={t.quantite}
                onChange={(e) => onUpdateTarif(r.id, t.id, { quantite: Number(e.target.value) })}
                className="input w-16"
              />
              <span className="font-amounts w-20 text-right text-xs text-neutral-500">
                {euros((Number(t.quantite) || 0) * (Number(t.pu) || 0))} €
              </span>
              <button onClick={() => onDeleteTarif(r.id, t.id)} className="text-red-600">
                ✕
              </button>
            </div>
          ))}
          {catTarifs
            .filter((ct) => !tarifs.some((t) => t.label === ct.label))
            .map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() => onAddTarif(r.id, { label: ct.label, pu: ct.pu })}
                className="mb-2 mr-2 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
              >
                + {ct.label} ({euros(ct.pu)} €)
              </button>
            ))}
          <button
            type="button"
            onClick={() => onAddTarif(r.id)}
            className="text-xs text-[#171717] hover:underline"
          >
            + Ajouter un PU supplémentaire
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#666666]/10 pt-3 text-sm">
          <span>
            Total activité : <strong>{euros(total)} €</strong>
          </span>
        </div>

        {navButtons(() => setStep("options"), "Suivant — Options")}
      </>
    );
  }

  if (step === "options") {
    const iType = speedboatIleType(catalogueItem?.nom || r.nom_activite);
    const selectIle2 = (ile2: string) => {
      onUpdateReservation(r.id, {
        ile_selectionnee_2: ile2,
        ...(iType ? { nom_activite: speedboatIleTitre(iType, r.ile_selectionnee, ile2) } : {}),
      });
    };
    return wrap(
      <>
        {options.map((o) => {
          const isParachute = o.nom === "Parachute";
          const is2emeIle = isDeuxiemeIleOption(o.nom);
          return (
            <div key={o.id} className="mb-2 flex flex-wrap items-center gap-2">
              <select
                value={OPTIONS_PRESETS.includes(o.nom as (typeof OPTIONS_PRESETS)[number]) ? o.nom : "Autre"}
                onChange={(e) => {
                  const nom = e.target.value === "Autre" ? "" : e.target.value;
                  onUpdateOption(
                    r.id,
                    o.id,
                    nom === "Parachute" && !o.prix ? { nom, prix: 10, quantite: o.quantite || 1 } : { nom }
                  );
                }}
                className="input"
              >
                {OPTIONS_PRESETS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              {!OPTIONS_PRESETS.includes(o.nom as (typeof OPTIONS_PRESETS)[number]) && (
                <input
                  placeholder="Préciser"
                  value={o.nom}
                  onChange={(e) => onUpdateOption(r.id, o.id, { nom: e.target.value })}
                  className="input"
                />
              )}
              <input
                type="number"
                placeholder={isParachute ? "PU €" : "Prix €"}
                value={o.prix}
                onChange={(e) => onUpdateOption(r.id, o.id, { prix: Number(e.target.value) })}
                className="input w-24"
              />
              {isParachute && (
                <>
                  <span className="text-xs text-neutral-400">×</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="Nb participants"
                    value={o.quantite}
                    onChange={(e) => onUpdateOption(r.id, o.id, { quantite: Number(e.target.value) })}
                    className="input w-32"
                  />
                  <span className="font-amounts text-xs text-neutral-500">
                    = {euros((Number(o.prix) || 0) * (Number(o.quantite) || 1))} €
                  </span>
                </>
              )}
              <button onClick={() => onDeleteOption(r.id, o.id)} className="text-red-600">
                ✕
              </button>
              {is2emeIle && (
                <div className="mt-1 flex w-full flex-wrap gap-2">
                  {SPEEDBOAT_ILES.filter((ile) => ile !== r.ile_selectionnee).map((ile) => (
                    <button
                      key={ile}
                      type="button"
                      onClick={() => selectIle2(ile)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                        r.ile_selectionnee_2 === ile
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-neutral-200 text-neutral-700 hover:border-[#171717]"
                      }`}
                    >
                      {ile}
                    </button>
                  ))}
                </div>
              )}
              {is2emeIle && !r.ile_selectionnee_2 && (
                <div className="w-full rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                  ⚠ Merci de choisir la 2ème île.
                </div>
              )}
            </div>
          );
        })}
        {catOptions
          .filter((co) => !options.some((o) => o.nom === co.nom))
          .map((co) => (
            <button
              key={co.id}
              type="button"
              onClick={() => onAddOption(r.id, { nom: co.nom, prix: co.prix })}
              className="mb-2 mr-2 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
            >
              + {co.nom} ({euros(co.prix)} € {co.mode === "groupe" ? "groupe" : "/pers."})
            </button>
          ))}
        {options.length === 0 && catOptions.length === 0 && (
          <p className="mb-2 text-sm text-neutral-400">Aucune option pour cette activité.</p>
        )}
        <div>
          <button
            type="button"
            onClick={() => onAddOption(r.id)}
            className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Ajouter une option
          </button>
        </div>

        {navButtons(() => setStep("transfert"), "Suivant — Transfert")}
      </>
    );
  }

  // step === "transfert"
  const total = resaTotalMontant(r, client, options, tarifs);
  return wrap(
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onUpdateReservation(r.id, { transfert_inclus: true })}
          className={`rounded-full border px-3 py-1 text-xs ${
            r.transfert_inclus
              ? "border-[#171717] bg-[#171717] text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          Transfert inclus
        </button>
        <button
          type="button"
          onClick={() => onUpdateReservation(r.id, { transfert_inclus: false })}
          className={`rounded-full border px-3 py-1 text-xs ${
            !r.transfert_inclus
              ? "border-[#C9973E] bg-[#C9973E] text-white"
              : "border-neutral-300 text-neutral-600"
          }`}
        >
          Taxe de transfert
        </button>
      </div>
      {hotelHorsHurghada ? (
        r.transfert_inclus && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-orange-50 px-2 py-1.5 text-xs text-orange-700">
            <span>⚠ Cet hôtel n&apos;est pas sur Hurghada, il y a peut-être une taxe de transfert.</span>
            <button
              type="button"
              onClick={() => onUpdateReservation(r.id, { transfert_inclus: false })}
              className="whitespace-nowrap rounded-md bg-orange-600 px-2 py-1 text-white hover:opacity-90"
            >
              Corriger
            </button>
          </div>
        )
      ) : (
        <div className="mt-2 rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-700">
          ✔️ Cet hôtel est bien situé sur Hurghada
        </div>
      )}
      {!r.transfert_inclus && (
        <div className="mt-2 max-w-[200px]">
          <Field label="Montant total (€)">
            <input
              type="number"
              value={r.transfert_montant}
              onChange={(e) => onUpdateReservation(r.id, { transfert_montant: Number(e.target.value) })}
              className="input"
            />
          </Field>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[#666666]/10 pt-3 text-sm">
        <span>
          Total activité : <strong>{euros(total)} €</strong>
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={goBack}
          className="rounded-md border border-[#eaeaea] px-3 py-2 text-sm text-[#666666] hover:bg-[#fafafa]"
        >
          Précédent
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex-1 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Ajouter l&apos;activité
        </button>
      </div>
    </>
  );
}
