"use client";

import { useEffect, useState } from "react";
import {
  AssouanVerification,
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import {
  CHAMPS_REQUIS_PRESETS,
  CRENEAUX_ACTIVITE,
  OPTIONS_PRESETS,
  SITES_CAIRE,
  VEHICULES_TRANSFERT,
} from "@/lib/constants";
import {
  groupeExtraCounts,
  billetEtapeShortLabel,
  billetUploadPatch,
  formatOptionLabel,
  hauteSaisonAttendu,
  isDeuxiemeIleOption,
  isGrandEgyptianMuseum,
  isLeCaireEnAvion,
  needsBilletInterneGenerique,
  isMontgolfiereActivity,
  isQuad,
  isSafariQuadBase,
  isSpeedboatPriveMaisonDauphins,
  joursDisponiblesMismatch,
  missingChampsFor,
  momentBadge,
  pointureBadge,
  volBadge,
  needsMomentSpeedboat,
  paiementStatutKey,
  participantsFor,
  resaTotalMontant,
  speedboatIleTitre,
  speedboatIleType,
  SPEEDBOAT_ILES,
  STATUT_PAIEMENT_OPTIONS,
  ajusteTitreTransfertAeroport,
  isAeroportTransfertHorsHurghada,
  senseTransfertAeroport,
} from "@/lib/resa";
import { weekdayFr } from "@/lib/dates";
import JourIndisponibleAlert from "@/components/JourIndisponibleAlert";
import AssouanHebergementAlert from "@/components/AssouanHebergementAlert";
import PhotoVolUpload from "@/components/PhotoVolUpload";

const MOMENTS_SPEEDBOAT = ["Matin", "Après-midi"] as const;
const MAISON_DAUPHINS_TEXT =
  "Les speedboat privé maison des dauphins sont recommandés le matin pour davantage de chances de voir les dauphins.";
import { Field } from "@/components/client-steps";
import MissingInfoModal from "@/components/MissingInfoModal";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import BilletAvionUpload from "@/components/BilletAvionUpload";
import AnnulerActiviteModal from "@/components/AnnulerActiviteModal";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function ReservationCard({
  r,
  client,
  options,
  tarifs,
  expanded,
  onToggleExpanded,
  onUpdate,
  onDelete,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onAddTarif,
  onUpdateTarif,
  onDeleteTarif,
  onUpdateClient,
  catalogue,
  catalogueTarifs,
  transfertTarifs,
  catalogueOptions,
  canSeeMargins,
  hotelHorsHurghada,
  coutReel,
  onUpdateCoutReel,
  onJourEscalation,
  onAssouanVerification,
  assouanVerification,
}: {
  r: Reservation;
  client: Client;
  options: ReservationOption[];
  tarifs: ReservationTarif[];
  expanded: boolean;
  onToggleExpanded: (v: boolean) => void;
  onUpdate: (patch: Partial<Reservation>) => void;
  onDelete: () => void;
  onAddOption: (seed?: { nom: string; prix: number }) => void;
  onUpdateOption: (optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (optId: string) => void;
  onAddTarif: (seed?: { label: string; pu: number }) => void;
  onUpdateTarif: (tarifId: string, patch: Partial<ReservationTarif>) => void;
  onDeleteTarif: (tarifId: string) => void;
  onUpdateClient: (patch: Partial<Client>) => void;
  catalogue: CatalogueItem[];
  catalogueTarifs: CatalogueTarif[];
  transfertTarifs: CatalogueTransfertTarif[];
  catalogueOptions: CatalogueOption[];
  canSeeMargins: boolean;
  hotelHorsHurghada?: boolean;
  coutReel: number;
  onUpdateCoutReel: (value: number) => void;
  onJourEscalation: (
    dateChoisie: string,
    jourChoisi: string,
    joursDisponibles: string[]
  ) => Promise<void>;
  onAssouanVerification: () => Promise<void>;
  assouanVerification: AssouanVerification | null;
}) {
  const [showPaxOverride, setShowPaxOverride] = useState(!!r.pax_override);
  const [jourAlertDate, setJourAlertDate] = useState<string | null>(null);
  const [validationError, setValidationError] = useState(false);
  const [readingPassport, setReadingPassport] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [showMomentModal, setShowMomentModal] = useState(false);
  const [showVolModal, setShowVolModal] = useState(false);
  const [showPointureModal, setShowPointureModal] = useState(false);
  const [showAnnulerModal, setShowAnnulerModal] = useState(false);
  const [assouanAlertOpen, setAssouanAlertOpen] = useState(false);
  const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
  const isTransfert = catalogueItem?.categorie === "Transfert" && transfertTarifs.length > 0;
  const zonesTransfertDisponibles = Array.from(new Set(transfertTarifs.map((t) => t.zone))).filter(
    Boolean
  );
  const matchTransfertTarif = (zone: string, vehicule: string) =>
    transfertTarifs.find((t) => t.zone === zone && t.vehicule === vehicule);
  const champsRequis = catalogueItem?.champs_requis_liste || [];
  const nomPourDetection = catalogueItem?.nom || r.nom_activite;
  const quadPourDetection = isQuad(nomPourDetection);
  const ileType = speedboatIleType(nomPourDetection);
  const needsMoment = needsMomentSpeedboat(nomPourDetection);
  const missingChamps = missingChampsFor(r, catalogueItem, assouanVerification);
  const champsRequisPersonnalises = champsRequis.filter(
    (c) => !(CHAMPS_REQUIS_PRESETS as readonly string[]).includes(c)
  );
  const pickFromCatalogue = async (id: string) => {
    const item = catalogue.find((a) => a.id === id);
    if (!item) return;
    // Ce menu reste affiché en permanence sur une activité déjà liée au
    // catalogue — un re-clic accidentel (même sur la même activité)
    // écrasait silencieusement les tarifs déjà personnalisés (adulte,
    // enfant…) avec les valeurs par défaut du catalogue, sans aucun
    // avertissement. On ne redemande rien si c'est déjà la même activité
    // (aucun changement), sinon on confirme avant d'écraser les tarifs.
    if (item.id === r.catalogue_item_id) return;
    if (r.catalogue_item_id) {
      const ok = await confirm({
        title: "Changer d'activité du catalogue ?",
        message:
          "Cette activité est déjà liée à une activité du catalogue. La remplacer va réinitialiser tous les tarifs (adulte, enfant…) avec les valeurs par défaut de la nouvelle activité — tes éventuelles modifications de prix seront perdues.",
        confirmLabel: "Remplacer",
        cancelLabel: "Annuler",
        danger: true,
      });
      if (!ok) return;
    }
    // Certaines activités démarrent déjà en forfait groupe (tarif_mode
    // copié depuis le catalogue) — sans ce pré-remplissage, le clic sur
    // "Forfait groupe" (qui fait le même travail) n'a jamais lieu puisque
    // le mode est déjà actif. Le forfait de base couvre déjà
    // prix_groupe_base_pax personnes, donc seuls les adultes au-delà
    // comptent en supplément.
    const { nbAd: nbAdActuel, nbEnf: nbEnfActuel } = participantsFor(r, client);
    const { extra1: extra1Actuel, extraEnfants: extraEnfantsActuel } = groupeExtraCounts(
      nbAdActuel,
      nbEnfActuel,
      item.prix_groupe_base_pax
    );
    onUpdate({
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
      ...(item.tarif_mode === "groupe"
        ? { participants_extra1: extra1Actuel, participants_extra_enfants: extraEnfantsActuel }
        : {}),
      horaire_approx: item.horaire_approx,
      inclus: (item.inclus_liste || []).join(", ") || item.inclus,
      non_inclus: item.non_inclus,
      a_prevoir: item.a_prevoir,
      point_rdv: item.point_rdv,
      photo_path: item.photo_path,
    });
  };
  const { nbAd, nbEnf } = participantsFor(r, client);
  const total = resaTotalMontant(r, client, options, tarifs);
  const soldeIci = client.solde_activite_id === r.id;
  const soldeLabel = soldeIci ? (client.solde_paye ? "Payé" : "À régler") : null;
  const statutKey = paiementStatutKey(client, r);
  const badge = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === statutKey)!;
  const hasInfo = !!r.info_importante;
  const leCaireEnAvion = isLeCaireEnAvion(nomPourDetection);
  const billetInterneGenerique = needsBilletInterneGenerique(nomPourDetection);

  // Toute activité avec un billet d'avion intérieur à gérer (achat fait par
  // l'agence) déduit automatiquement billet_requis de son nom — plus de case
  // à cocher manuelle. "Le Caire en avion" a un trajet fixe connu à l'avance
  // (Hurghada ↔ Le Caire) ; les autres cas (activité générique "Billets
  // d'avion", circuits) n'ont pas de villes prévisibles — elles restent à
  // remplir à la main dans le tableau des billets d'avion.
  useEffect(() => {
    if (leCaireEnAvion) {
      const patch: Partial<Reservation> = {};
      if (!r.billet_requis) patch.billet_requis = true;
      if (r.billet_ville_depart !== "Hurghada") patch.billet_ville_depart = "Hurghada";
      if (r.billet_ville_arrivee !== "Le Caire") patch.billet_ville_arrivee = "Le Caire";
      if (r.billet_date !== r.date_debut) patch.billet_date = r.date_debut;
      if (Object.keys(patch).length > 0) onUpdate(patch);
    } else if (billetInterneGenerique) {
      const patch: Partial<Reservation> = {};
      if (!r.billet_requis) patch.billet_requis = true;
      if (r.billet_date !== r.date_debut) patch.billet_date = r.date_debut;
      if (Object.keys(patch).length > 0) onUpdate(patch);
    } else if (r.billet_requis) {
      onUpdate({ billet_requis: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leCaireEnAvion,
    billetInterneGenerique,
    r.billet_requis,
    r.billet_ville_depart,
    r.billet_ville_arrivee,
    r.billet_date,
    r.date_debut,
  ]);

  const readNameFromPassport = async () => {
    const path = client.passeport_photos?.[0];
    if (!path) {
      toast("Ajoute d'abord une photo du passeport dans l'onglet Contact.");
      return;
    }
    setReadingPassport(true);
    try {
      const res = await fetch("/api/extract-passport-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Échec de la lecture du passeport.");
        return;
      }
      onUpdate({ billet_nom_complet: data.name });
    } catch {
      toast("Échec de la lecture du passeport.");
    } finally {
      setReadingPassport(false);
    }
  };

  if (!expanded) {
    if (r.statut_resa === "Annulée") {
      return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 opacity-60">
          <p className="font-medium text-neutral-500 line-through">
            {r.nom_activite || "Activité sans nom"}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Annulée le {r.annulation_date ? fmtDate(r.annulation_date) : "?"}
            {r.annulation_raison ? ` — ${r.annulation_raison}` : ""}
            {r.annulation_remb_avoir === "rembourse" && " — remboursée"}
            {r.annulation_remb_avoir === "avoir" && " — avoir créé"}
          </p>
        </div>
      );
    }
    if (r.statut_resa === "Confirmée") {
      return (
        <div
          onClick={() => onToggleExpanded(true)}
          className="cursor-pointer rounded-md border border-[#171717]/30 bg-white p-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#171717]">✓</span>
            <span className="font-medium text-[#171717]">
              {r.nom_activite || "Activité sans nom"}
              {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
            </span>
            {hasInfo && (
              <span
                title={r.info_importante}
                className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
              >
                ⚠ {r.info_importante}
              </span>
            )}
            {momentBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {momentBadge(r)}
              </span>
            )}
            {volBadge(r) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {volBadge(r)}
                {r.photo_vol_path ? " 📷" : ""}
              </span>
            )}
            {pointureBadge(r) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {pointureBadge(r)}
              </span>
            )}
            {options
              .filter((o) => !isDeuxiemeIleOption(o.nom))
              .map((o) => (
                <span
                  key={o.id}
                  className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-xs font-medium text-white"
                >
                  ⚙ {formatOptionLabel(o)}
                </span>
              ))}
            <span className="flex-1" />
            <span className="font-amounts text-sm">{euros(total)} €</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {fmtDate(r.date_debut)}
            {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
          </p>
          {(soldeIci || hasInfo || r.billet_requis) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {soldeIci && (
                <span className="rounded-full bg-[#C9973E] px-2 py-0.5 text-xs text-white">
                  💰 Solde ici — {soldeLabel}
                </span>
              )}
              {r.billet_requis && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  ✈ Billet — {billetEtapeShortLabel(r.billet_etape)}
                </span>
              )}
            </div>
          )}
          {hasInfo && (
            <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
              ⚠ {r.info_importante}
            </div>
          )}
        </div>
      );
    }
    return (
      <div
        onClick={() => onToggleExpanded(true)}
        className="cursor-pointer rounded-md border border-[#C9973E]/40 bg-white p-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-[#171717]">
            {r.nom_activite || "Activité sans nom"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
            {hasInfo && (
              <span
                title={r.info_importante}
                className="ml-2 inline-block max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 align-middle text-xs font-medium text-red-700"
              >
                ⚠ {r.info_importante}
              </span>
            )}
            {soldeIci && !client.solde_paye && (
              <span className="ml-2 text-xs text-red-600">⚠️ solde à régler ici</span>
            )}
          </p>
          {momentBadge(r) && (
            <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
              {momentBadge(r)}
            </span>
          )}
          {volBadge(r) && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
            </span>
          )}
          {pointureBadge(r) && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {pointureBadge(r)}
            </span>
          )}
          {options
            .filter((o) => !isDeuxiemeIleOption(o.nom))
            .map((o) => (
              <span
                key={o.id}
                className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-xs font-medium text-white"
              >
                ⚙ {formatOptionLabel(o)}
              </span>
            ))}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {fmtDate(r.date_debut)}
          {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
          {r.pickup_reel ? ` · Pick-up ${r.pickup_reel}` : ""}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {r.pax_override || `${nbAd} adultes${nbEnf ? `, ${nbEnf} enfant(s)` : ""}`}
        </p>
        {hasInfo && (
          <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
            ⚠ {r.info_importante}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          {soldeIci ? (
            <span className="rounded-full bg-[#C9973E] px-2 py-0.5 text-xs text-white">
              💰 Solde ici — {soldeLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="font-amounts text-sm">{euros(total)} €</span>
        </div>
        {r.billet_requis && (
          <span className="mt-1 block text-xs text-neutral-500">
            ✈ Billet — {billetEtapeShortLabel(r.billet_etape)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div id={`reservation-${r.id}`} className="rounded-md border border-[#666666]/20 bg-white p-3">
      {catalogue.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) pickFromCatalogue(e.target.value);
            e.target.value = "";
          }}
          className="input mb-2"
        >
          <option value="">— Choisir dans le catalogue —</option>
          {catalogue.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom}
            </option>
          ))}
        </select>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          placeholder="Nom de l'activité"
          value={r.nom_activite}
          onChange={(e) => onUpdate({ nom_activite: e.target.value })}
          className="input flex-1"
        />
        <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
          Retirer
        </button>
        {r.statut_resa !== "Annulée" && (
          <button
            onClick={() => setShowAnnulerModal(true)}
            className="whitespace-nowrap text-xs text-neutral-500 hover:text-red-600 hover:underline"
          >
            Annuler
          </button>
        )}
        <button
          onClick={() => {
            if (missingChamps.length > 0) {
              setValidationError(true);
              if (needsMoment && !r.moment) setShowMomentModal(true);
              if (missingChamps.includes("Vol & horaire")) setShowVolModal(true);
              if (missingChamps.includes("Pointure")) setShowPointureModal(true);
              return;
            }
            setValidationError(false);
            onUpdate({ statut_resa: "Confirmée" });
            onToggleExpanded(false);
          }}
          className="text-xs font-medium text-[#171717] hover:underline"
        >
          Valider
        </button>
      </div>

      {validationError && missingChamps.length > 0 && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠ Impossible de valider — champs manquants : {missingChamps.join(", ")}
        </div>
      )}

      {showMomentModal && (
        <MissingInfoModal
          message="vous devez renseigner si l'activité a lieu le matin ou l'après-midi."
          actionLabel="Je renseigne le moment"
          onAction={() => {
            setShowMomentModal(false);
            requestAnimationFrame(() => {
              setTimeout(() => {
                const el = document.getElementById(`field-moment-${r.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 50);
            });
          }}
          onClose={() => setShowMomentModal(false)}
        />
      )}

      {showVolModal && (
        <MissingInfoModal
          message={`vous n'avez pas rempli ces informations (${[
            !r.numero_vol.trim() && "numéro de vol",
            !r.horaire_vol.trim() && "horaire d'arrivée",
            !r.photo_vol_path && "photo du vol",
          ]
            .filter(Boolean)
            .join(", ")}).`}
          actionLabel="Je complète maintenant"
          onAction={() => {
            setShowVolModal(false);
            requestAnimationFrame(() => {
              setTimeout(() => {
                const el = document.getElementById(`field-numero-vol-${r.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 50);
            });
          }}
          onClose={() => setShowVolModal(false)}
        />
      )}

      {showPointureModal && (
        <MissingInfoModal
          message="vous n'avez pas rempli les pointures des clients."
          actionLabel="Je complète maintenant"
          onAction={() => {
            setShowPointureModal(false);
            requestAnimationFrame(() => {
              setTimeout(() => {
                const el = document.getElementById(`field-pointure-${r.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 50);
            });
          }}
          onClose={() => setShowPointureModal(false)}
        />
      )}

      {jourAlertDate && (
        <JourIndisponibleAlert
          nomActivite={nomPourDetection}
          jourChoisi={weekdayFr(jourAlertDate)}
          joursDisponibles={catalogueItem?.jours_disponibles || []}
          onChangeDate={() => setJourAlertDate(null)}
          onDemanderAutorisation={async () => {
            const joursDisponibles = catalogueItem?.jours_disponibles || [];
            await onJourEscalation(jourAlertDate, weekdayFr(jourAlertDate), joursDisponibles);
            onUpdate({ date_debut: jourAlertDate });
            setJourAlertDate(null);
          }}
        />
      )}

      {ileType && (
        <div className="mb-3" id={`field-ile-${r.id}`}>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Île *</p>
          <div className="flex flex-wrap gap-2">
            {SPEEDBOAT_ILES.map((ile) => (
              <button
                key={ile}
                type="button"
                onClick={() =>
                  onUpdate({
                    ile_selectionnee: ile,
                    nom_activite: speedboatIleTitre(ileType, ile, r.ile_selectionnee_2 || undefined),
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  r.ile_selectionnee === ile
                    ? "border-[#171717] bg-[#171717] text-white"
                    : validationError && !r.ile_selectionnee
                      ? "border-red-300 text-red-600"
                      : "border-neutral-300 text-neutral-600"
                }`}
              >
                {ile}
              </button>
            ))}
          </div>
          {r.ile_selectionnee === "Oziréa" && (
            <p className="mt-1.5 text-xs font-medium text-[#0F5C56]">
              ℹ️ Supplément Oziréa appliqué automatiquement : +30 € par adulte, +15 € par enfant.
            </p>
          )}
        </div>
      )}

      {needsMoment && isSpeedboatPriveMaisonDauphins(nomPourDetection) && (
        <div className="mb-3 flex items-start gap-2 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">
          <span>⚠</span>
          <span>{MAISON_DAUPHINS_TEXT}</span>
        </div>
      )}

      {needsMoment && (
        <div className="mb-3" id={`field-moment-${r.id}`}>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Moment *</p>
          <div className="flex gap-2">
            {MOMENTS_SPEEDBOAT.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdate({ moment: m })}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  r.moment === m
                    ? "border-[#171717] bg-[#171717] text-white"
                    : validationError && !r.moment
                      ? "border-red-300 text-red-600"
                      : "border-neutral-300 text-neutral-600"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}


      {options.length > 0 && (
        <div className="mb-3 rounded-md bg-[#C9973E]/10 px-3 py-2 text-xs text-[#666666]">
          ⚠ Option(s) ajoutée(s) : {options.map((o) => formatOptionLabel(o)).join(", ")}
        </div>
      )}

      {isTransfert && (
        <div className="mb-3 rounded-md border border-neutral-200 p-3">
          <p className="mb-2 text-xs font-medium text-neutral-500">
            Transfert : le prix est un forfait selon la zone de l&apos;hôtel et le véhicule
            utilisé, pas par personne.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={r.zone_transfert}
              onChange={(e) => {
                const zone = e.target.value;
                const match = matchTransfertTarif(zone, r.vehicule_transfert);
                onUpdate({
                  zone_transfert: zone,
                  ...(match ? { tarif_mode: "groupe", prix_groupe_base: match.prix } : {}),
                });
              }}
              className="input"
            >
              <option value="">— Zone de l&apos;hôtel —</option>
              {zonesTransfertDisponibles.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
            <select
              value={r.vehicule_transfert}
              onChange={(e) => {
                const vehicule = e.target.value;
                const match = matchTransfertTarif(r.zone_transfert, vehicule);
                onUpdate({
                  vehicule_transfert: vehicule,
                  ...(match ? { tarif_mode: "groupe", prix_groupe_base: match.prix } : {}),
                });
              }}
              className="input"
            >
              <option value="">— Véhicule —</option>
              {VEHICULES_TRANSFERT.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          {r.zone_transfert &&
            r.vehicule_transfert &&
            !matchTransfertTarif(r.zone_transfert, r.vehicule_transfert) && (
              <p className="mt-2 text-xs font-medium text-red-600">
                ⚠ Aucun tarif défini dans le catalogue pour cette zone + ce véhicule — saisis le
                prix forfait à la main ci-dessous.
              </p>
            )}
        </div>
      )}

      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => onUpdate({ tarif_mode: "personne" })}
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
            // Pré-remplit avec les participants déjà choisis plus bas —
            // pas besoin de ressaisir des nombres déjà sélectionnés. Le
            // forfait de base couvre déjà prix_groupe_base_pax personnes,
            // donc seuls les adultes au-delà comptent en supplément.
            const { extra1, extraEnfants } = groupeExtraCounts(
              nbAd,
              nbEnf,
              catalogueItem?.prix_groupe_base_pax ?? 0
            );
            onUpdate({
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

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date début">
          <input
            type="date"
            value={r.date_debut ?? ""}
            onChange={(e) => {
              const newDate = e.target.value || null;
              const joursDisponibles = catalogueItem?.jours_disponibles || [];
              if (newDate && joursDisponiblesMismatch(newDate, joursDisponibles)) {
                setJourAlertDate(newDate);
                return;
              }
              const attendu = catalogueItem ? hauteSaisonAttendu(newDate, catalogueItem) : null;
              onUpdate({
                date_debut: newDate,
                ...(attendu ? { pu_adulte: attendu.pu_adulte, pu_enfant: attendu.pu_enfant } : {}),
              });
            }}
            className="input"
          />
        </Field>
        {r.tarif_mode !== "groupe" ? (
          <>
            <Field label="PU adulte (€)">
              <input
                type="number"
                value={r.pu_adulte}
                onChange={(e) => onUpdate({ pu_adulte: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="PU enfant (€)">
              <input
                type="number"
                value={r.pu_enfant}
                onChange={(e) => onUpdate({ pu_enfant: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="PU accompagnateur (€)">
              <input
                type="number"
                value={r.pu_accompagnateur}
                onChange={(e) => onUpdate({ pu_accompagnateur: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field
              label={
                isMontgolfiereActivity(nomPourDetection)
                  ? "PU 4-7 ans, visites sans montgolfière (€)"
                  : "PU enfant 2-3 ans (€)"
              }
            >
              <input
                type="number"
                value={r.pu_enfant_3ans}
                onChange={(e) => onUpdate({ pu_enfant_3ans: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Prix forfait de base (€)">
              <input
                type="number"
                value={r.prix_groupe_base}
                onChange={(e) => onUpdate({ prix_groupe_base: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="PU personne supp. (€)">
              <input
                type="number"
                value={r.prix_groupe_extra1}
                onChange={(e) => onUpdate({ prix_groupe_extra1: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="PU enfant supp. (€)">
              <input
                type="number"
                value={r.prix_groupe_extra_enfant}
                onChange={(e) => onUpdate({ prix_groupe_extra_enfant: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Nb personnes supp.">
              <input
                type="number"
                min={0}
                value={r.participants_extra1}
                onChange={(e) => onUpdate({ participants_extra1: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Nb enfants supp.">
              <input
                type="number"
                min={0}
                value={r.participants_extra_enfants}
                onChange={(e) => onUpdate({ participants_extra_enfants: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </>
        )}
        {canSeeMargins && (
          <Field label="Coût réel (interne)">
            <input
              type="number"
              value={coutReel}
              onChange={(e) => onUpdateCoutReel(Number(e.target.value))}
              className="input"
            />
          </Field>
        )}
      </div>

      {(() => {
        const hauteSaison = catalogueItem ? hauteSaisonAttendu(r.date_debut, catalogueItem) : null;
        if (!hauteSaison || r.tarif_mode === "groupe") return null;
        const mismatch =
          (nbAd > 0 && Number(r.pu_adulte) !== hauteSaison.pu_adulte) ||
          (nbEnf > 0 && Number(r.pu_enfant) !== hauteSaison.pu_enfant);
        if (!mismatch) return null;
        return (
          <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ Cette date tombe en haute saison ({catalogueItem?.haute_saison_debut} au{" "}
            {catalogueItem?.haute_saison_fin}) — le tarif doit être {hauteSaison.pu_adulte} € par
            adulte
            {nbEnf > 0 ? ` et ${hauteSaison.pu_enfant} € par enfant` : ""}, corrige le prix
            ci-dessus.
          </div>
        );
      })()}

      <div className="mt-2">
        <p className="mb-1 text-xs font-medium text-neutral-500">
          PU supplémentaire (accompagnateur, passager, bébé…)
        </p>
        {tarifs.map((t) => (
          <div key={t.id} className="mb-2 flex flex-wrap items-center gap-2">
            <input
              placeholder="Ex. Accompagnateur"
              value={t.label}
              onChange={(e) => onUpdateTarif(t.id, { label: e.target.value })}
              className="input min-w-[160px] flex-1"
            />
            <input
              type="number"
              placeholder="PU €"
              value={t.pu}
              onChange={(e) => onUpdateTarif(t.id, { pu: Number(e.target.value) })}
              className="input w-24"
            />
            <span className="text-xs text-neutral-400">×</span>
            <input
              type="number"
              min={0}
              placeholder="Qté"
              value={t.quantite}
              onChange={(e) => onUpdateTarif(t.id, { quantite: Number(e.target.value) })}
              className="input w-16"
            />
            <span className="font-amounts w-20 text-right text-xs text-neutral-500">
              {euros((Number(t.quantite) || 0) * (Number(t.pu) || 0))} €
            </span>
            <button onClick={() => onDeleteTarif(t.id)} className="text-red-600">
              ✕
            </button>
          </div>
        ))}
        {catalogueTarifs
          .filter((ct) => !tarifs.some((t) => t.label === ct.label))
          .map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => onAddTarif({ label: ct.label, pu: ct.pu })}
              className="mb-2 mr-2 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
            >
              + {ct.label} ({euros(ct.pu)} €)
            </button>
          ))}
        <button
          type="button"
          onClick={() => onAddTarif()}
          className="text-xs text-[#171717] hover:underline"
        >
          + Ajouter un PU supplémentaire
        </button>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Participants</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ participants_mode: "tous" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode === "tous"
                ? "border-[#171717] bg-[#171717] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Tous ({client.adultes} ad. + {client.enfants} enf.)
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ participants_mode: "custom" })}
            className={`rounded-full border px-3 py-1 text-xs ${
              r.participants_mode === "custom"
                ? "border-[#C9973E] bg-[#C9973E] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Personnalisé
          </button>
        </div>
        {r.participants_mode === "custom" && (
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Field label="Adultes participants">
              <input
                type="number"
                value={r.participants_adultes}
                onChange={(e) => onUpdate({ participants_adultes: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Enfants participants">
              <input
                type="number"
                value={r.participants_enfants}
                onChange={(e) => onUpdate({ participants_enfants: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Accompagnateurs">
              <input
                type="number"
                value={r.participants_accompagnateurs}
                onChange={(e) => onUpdate({ participants_accompagnateurs: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field
              label={
                isMontgolfiereActivity(nomPourDetection) ? "Enfants 4-7 ans (visites)" : "Enfants 2-3 ans"
              }
            >
              <input
                type="number"
                value={r.participants_enfants_3ans}
                onChange={(e) => onUpdate({ participants_enfants_3ans: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Noms">
              <input
                value={r.participants_noms}
                onChange={(e) => onUpdate({ participants_noms: e.target.value })}
                className="input"
              />
            </Field>
          </div>
        )}
        <div className="mt-2">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={showPaxOverride}
              onChange={(e) => {
                setShowPaxOverride(e.target.checked);
                if (!e.target.checked) onUpdate({ pax_override: "" });
              }}
            />
            Écrire moi-même le texte affiché au lieu du calcul automatique
          </label>
          <p className="mb-1 text-xs text-neutral-400">
            Par défaut le nombre de participants ci-dessus est calculé automatiquement. Coche
            cette case seulement si tu veux le remplacer par un texte libre (ex. «{" "}
            {quadPourDetection ? "2 conducteurs, 3 passagers" : "2 participants, 1 accompagnateur"} »).
          </p>
          {showPaxOverride && (
            <input
              placeholder="Texte à afficher"
              value={r.pax_override}
              onChange={(e) => onUpdate({ pax_override: e.target.value })}
              className="input"
            />
          )}
        </div>
      </div>

      {champsRequis.length > 0 && (
        <div className="mt-3 rounded-md border border-[#0F5C56]/20 bg-[#0F5C56]/5 p-3">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Informations requises pour cette activité
          </p>
          <div className="grid grid-cols-2 gap-3">
            {champsRequis.includes("Pointure") && (
              <Field label="Pointure des clients (palmes) *">
                <input
                  id={`field-pointure-${r.id}`}
                  value={r.pointure}
                  onChange={(e) => onUpdate({ pointure: e.target.value })}
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
                    onUpdate({
                      creneau,
                      ...(isSafariQuadBase(nomPourDetection)
                        ? {
                            nom_activite:
                              creneau === "Coucher de soleil" ? "Safari quad au coucher du soleil" : nomPourDetection,
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
                      onUpdate({
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
                      onUpdate({
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
                    id={`field-numero-vol-${r.id}`}
                    value={r.numero_vol}
                    onChange={(e) => {
                      const numero_vol = e.target.value;
                      const titre = ajusteTitreTransfertAeroport(r.nom_activite, numero_vol, r.horaire_vol);
                      onUpdate({ numero_vol, ...(titre ? { nom_activite: titre } : {}) });
                    }}
                    className={`input ${
                      validationError && !r.numero_vol.trim()
                        ? "border-red-300 focus:border-red-400"
                        : ""
                    }`}
                  />
                </Field>
                <Field
                  label={
                    senseTransfertAeroport(r.nom_activite) === "hotel_aeroport"
                      ? "Horaire de départ *"
                      : "Horaire d'arrivée *"
                  }
                >
                  <input
                    id={`field-horaire-vol-${r.id}`}
                    value={r.horaire_vol}
                    onChange={(e) => {
                      const horaire_vol = e.target.value;
                      const titre = ajusteTitreTransfertAeroport(r.nom_activite, r.numero_vol, horaire_vol);
                      onUpdate({ horaire_vol, ...(titre ? { nom_activite: titre } : {}) });
                    }}
                    className={`input ${
                      validationError && !r.horaire_vol.trim()
                        ? "border-red-300 focus:border-red-400"
                        : ""
                    }`}
                  />
                </Field>
                <div id={`field-photo-vol-${r.id}`} className="col-span-2">
                  <PhotoVolUpload
                    path={r.photo_vol_path}
                    onChange={(path) => onUpdate({ photo_vol_path: path })}
                  />
                  {validationError && !r.photo_vol_path && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      ⚠ Photo du vol manquante
                    </p>
                  )}
                </div>
              </>
            )}
            {champsRequis.includes(
              "Site visité au Caire (musée / Saqqarah / citadelle / Grand Egyptian Museum)"
            ) && (
              <Field label="Site visité *">
                <select
                  value={r.site_caire}
                  onChange={(e) => onUpdate({ site_caire: e.target.value })}
                  className={`input ${
                    validationError && !r.site_caire ? "border-red-300 focus:border-red-400" : ""
                  }`}
                >
                  <option value="">—</option>
                  {SITES_CAIRE.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {isGrandEgyptianMuseum(r.site_caire) && (
            <p className="mt-3 text-xs font-medium text-[#0F5C56]">
              ℹ️ Supplément Grand Egyptian Museum appliqué automatiquement : +20 € par adulte, +10
              € par enfant (gratuit ≤ 3 ans).
            </p>
          )}
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
                        onUpdate({
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
          {catalogueItem?.necessite_verif_hebergement_assouan && (
            <div className="mt-3 rounded-md border border-[#0F5C56]/30 bg-[#0F5C56]/5 p-3">
              <p className="text-xs text-[#0F5C56]">
                ℹ️ Cette activité concerne Assouan — vérifie avec le client la localisation de son
                hôtel.
              </p>
              {!assouanVerification && (
                <button
                  type="button"
                  onClick={() => setAssouanAlertOpen(true)}
                  className="mt-1 text-xs font-medium text-[#0F5C56] underline"
                >
                  Voir l&apos;info à donner au client
                </button>
              )}
              {assouanVerification?.statut === "en_attente" && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  ⏳ Info envoyée, en attente de vérification par Sylvie.
                </p>
              )}
              {assouanVerification?.statut === "refusee" && (
                <div>
                  <p className="mt-1 text-xs font-medium text-red-600">
                    ⚠ {assouanVerification.resolu_par_nom || "Sylvie"} a refusé
                    {assouanVerification.resolu_message ? ` (« ${assouanVerification.resolu_message} »)` : ""} —
                    à refaire.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAssouanAlertOpen(true)}
                    className="mt-1 text-xs font-medium text-[#0F5C56] underline"
                  >
                    Revoir l&apos;info à donner au client
                  </button>
                </div>
              )}
              {assouanVerification?.statut === "validee" && (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  ✓ Vérifié par {assouanVerification.resolu_par_nom || "Sylvie"}.
                </p>
              )}
            </div>
          )}
          {assouanAlertOpen && (
            <AssouanHebergementAlert
              nomActivite={catalogueItem?.nom || r.nom_activite}
              onClose={() => setAssouanAlertOpen(false)}
              onConfirmerInfo={async () => {
                await onAssouanVerification();
                setAssouanAlertOpen(false);
              }}
            />
          )}
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Options</p>
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
                  onChange={(e) => onUpdateOption(o.id, { nom: e.target.value })}
                  className="input"
                />
              )}
              <input
                type="number"
                placeholder={isParachute ? "PU €" : "Prix €"}
                value={o.prix}
                onChange={(e) => onUpdateOption(o.id, { prix: Number(e.target.value) })}
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
                    onChange={(e) => onUpdateOption(o.id, { quantite: Number(e.target.value) })}
                    className="input w-32"
                  />
                  <span className="font-amounts text-xs text-neutral-500">
                    = {euros((Number(o.prix) || 0) * (Number(o.quantite) || 1))} €
                  </span>
                </>
              )}
              <button onClick={() => onDeleteOption(o.id)} className="text-red-600">
                ✕
              </button>
              {is2emeIle && (
                <div className="mt-1 flex w-full flex-wrap gap-2">
                  {SPEEDBOAT_ILES.filter((ile) => ile !== r.ile_selectionnee).map((ile) => (
                    <button
                      key={ile}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ile_selectionnee_2: ile,
                          ...(ileType
                            ? { nom_activite: speedboatIleTitre(ileType, r.ile_selectionnee, ile) }
                            : {}),
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        r.ile_selectionnee_2 === ile
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-neutral-300 text-neutral-600"
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
        {catalogueOptions
          .filter((co) => !options.some((o) => o.nom === co.nom))
          .map((co) => (
            <button
              key={co.id}
              type="button"
              onClick={() => onAddOption({ nom: co.nom, prix: co.prix })}
              className="mb-2 mr-2 rounded-full border border-dashed border-neutral-300 px-3 py-1 text-xs text-neutral-500 hover:border-[#171717] hover:text-[#171717]"
            >
              + {co.nom} ({euros(co.prix)} € {co.mode === "groupe" ? "groupe" : "/pers."})
            </button>
          ))}
        <button
          onClick={() => onAddOption()}
          className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Ajouter une option
        </button>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-neutral-700">Transfert</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ transfert_inclus: true })}
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
            onClick={() => onUpdate({ transfert_inclus: false })}
            className={`rounded-full border px-3 py-1 text-xs ${
              !r.transfert_inclus
                ? "border-[#C9973E] bg-[#C9973E] text-white"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            Taxe de transfert
          </button>
        </div>
        {hotelHorsHurghada && !isAeroportTransfertHorsHurghada(r.nom_activite) && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-orange-50 px-2 py-1.5 text-xs text-orange-700">
            <span>⚠ N&apos;oubliez pas que cet hôtel n&apos;est pas sur Hurghada, il y a peut-être une taxe de transfert.</span>
            {r.transfert_inclus && (
              <button
                type="button"
                onClick={() => onUpdate({ transfert_inclus: false })}
                className="whitespace-nowrap rounded-md bg-orange-600 px-2 py-1 text-white hover:opacity-90"
              >
                Corriger
              </button>
            )}
          </div>
        )}
        {!r.transfert_inclus && (
          <div className="mt-2 max-w-[200px]">
            <Field label="Montant total (€)">
              <input
                type="number"
                value={r.transfert_montant}
                onChange={(e) => onUpdate({ transfert_montant: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-3">
        <Field label="Pick-up réel (confirmé la veille, visible client)">
          <input
            placeholder="Rempli par l'employée"
            value={r.pickup_reel}
            onChange={(e) => onUpdate({ pickup_reel: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Info importante pour l'équipe (encadré visible)">
          <textarea
            rows={2}
            value={r.info_importante}
            onChange={(e) => onUpdate({ info_importante: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      {leCaireEnAvion && (
        <div className="mt-4 rounded-md border border-[#666666]/15 p-3">
          <p className="text-sm font-medium text-neutral-700">
            ✈ Billet d&apos;avion Hurghada ↔ Le Caire
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Le statut, les infos passagers et l&apos;envoi à Hossam se gèrent désormais dans
            Suivis → Billets d&apos;avion. Ici, tu peux juste uploader le billet reçu pour le
            suivi du dossier.
          </p>
          <div className="mt-3 flex gap-1.5">
            <div className="flex-1">
              <Field label="Nom complet (comme au passeport)">
                <input
                  value={r.billet_nom_complet}
                  onChange={(e) => onUpdate({ billet_nom_complet: e.target.value })}
                  placeholder="À écrire tel quel pour Hossam / le prestataire"
                  className="input"
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={readNameFromPassport}
              disabled={readingPassport}
              title="Lire le nom sur la photo du passeport"
              className="mt-6 h-fit shrink-0 rounded-md border border-[#666666]/30 px-2 py-1.5 text-xs text-neutral-600 hover:bg-[#fafafa] disabled:opacity-50"
            >
              {readingPassport ? "…" : "📷 Lire"}
            </button>
          </div>
          <div className="mt-3">
            <BilletAvionUpload
              path={r.billet_lien || null}
              onChange={(path) => onUpdate(billetUploadPatch(r, path))}
            />
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-[#666666]/10 pt-3 text-sm">
        {r.avoir_utilise > 0 && (
          <div className="mb-2 inline-block rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
            Avoir de {euros(r.avoir_utilise)} € utilisé sur cette activité
          </div>
        )}
        {isGrandEgyptianMuseum(r.site_caire) && (
          <div className="mb-1 text-xs text-neutral-500">
            dont {euros(nbAd * 20 + nbEnf * 10)} € de supplément Grand Egyptian Museum
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span>
            Total activité : <strong>{euros(total)} €</strong>
          </span>
          <select
            value={statutKey}
            onChange={(e) => {
              const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === e.target.value);
              if (opt) onUpdateClient(opt.patch(r));
            }}
            className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${badge.className}`}
          >
            {STATUT_PAIEMENT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showAnnulerModal && (
        <AnnulerActiviteModal
          r={r}
          client={client}
          options={options}
          tarifs={tarifs}
          catalogueItem={catalogueItem}
          onUpdate={onUpdate}
          onClose={() => setShowAnnulerModal(false)}
        />
      )}
    </div>
  );
}
