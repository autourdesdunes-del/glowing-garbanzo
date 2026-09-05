"use client";

import { useState } from "react";
import { Client, Reservation } from "@/lib/types";
import { ASSIGNE_A_OPTIONS } from "@/lib/constants";
import { todayStr } from "@/lib/dates";
import { getEurToEgpRate } from "@/lib/exchangeRate";
import { soldeInclutAcompteImpaye } from "@/lib/resa";
import { euros, fmtDateDMY } from "@/lib/contactStepFormat";
import { Field } from "@/components/Field";
import MontantEgpField from "@/components/MontantEgpField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

// Bouton "Marquer encaissé" / "Encaissé ✅" réutilisé partout où un montant
// attend d'être pointé comme réglé (solde RDV, solde à l'activité...).
export function EncaisseButton({
  paye,
  onMarquer,
  onAnnuler,
  marquerLabel = "Marquer encaissé",
  onDifferent,
  differentLabel = "Réglé autrement",
}: {
  paye: boolean;
  onMarquer: () => void;
  onAnnuler: () => void;
  marquerLabel?: string;
  onDifferent?: () => void;
  differentLabel?: string;
}) {
  if (paye) {
    return (
      <button
        onClick={onAnnuler}
        className="whitespace-nowrap rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        Encaissé ✅
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] font-semibold text-yellow-700">En attente</span>
      <button
        onClick={onMarquer}
        className="whitespace-nowrap rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        {marquerLabel}
      </button>
      {onDifferent && (
        <button
          onClick={onDifferent}
          className="whitespace-nowrap text-[10px] font-medium text-neutral-500 underline hover:text-neutral-700"
        >
          {differentLabel}
        </button>
      )}
    </div>
  );
}

// Écart entre ce qui était attendu au solde (avant ajustement de l'acompte)
// et ce qui l'est réellement — affiché à l'identique quel que soit le mode
// choisi pour le solde (RDV, virement/paypal/CB, activité), pour que ça
// fonctionne pour chaque client, pas seulement "paiement à l'activité".
function EcartAcompteLine({
  reel,
  prevu,
  entreProchesOublie,
}: {
  reel: number;
  prevu: number;
  entreProchesOublie: boolean;
}) {
  if (reel === prevu) return null;
  return (
    <p className="mt-1 text-xs font-medium text-red-600">
      {euros(reel)} € au lieu de {euros(prevu)} € → raison :{" "}
      {entreProchesOublie ? "rattrapage de l'oubli « Entre proches »" : "montant de l'acompte ajusté"}
    </p>
  );
}

export const INTEGRAL_MODES = [
  { key: "rdv", label: "Rendez-vous paiement planifié", className: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "activite_eur", label: "Paiement à la première activité en €", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "activite_egp", label: "Paiement à la première activité en EGP", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "paypal", label: "Paiement via PayPal", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "virement", label: "Paiement par virement bancaire", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "cb", label: "Paiement par CB", className: "border-orange-300 bg-orange-50 text-orange-700" },
] as const;

const RDV_MODES = ["Carte bleue", "Espèces EUR", "Espèces EGP"] as const;

const INTEGRAL_MODE_SOLDE_MODE: Record<string, string> = {
  activite_eur: "Espèces EUR",
  activite_egp: "Espèces EGP",
  paypal: "PayPal",
  virement: "Virement bancaire",
  cb: "Carte bleue",
};

// Le flux de règlement (RDV planifié / à la première activité en €-EGP /
// PayPal / virement / CB) est identique qu'on règle le séjour en intégral
// ou seulement le reste après un acompte — seul le montant à couvrir change.
export function PaiementResteFlow({
  client,
  onChange,
  reservations,
  montantACouvrir,
  totalSejour,
  montantActiviteAttenduPrevu,
  montantActiviteAttenduReel,
  confirm,
  toast,
  isDirection = false,
  onEncaissementDifferent,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  reservations: Reservation[];
  montantACouvrir: number;
  // Total du séjour au moment où le solde est marqué payé — figé dans
  // client.solde_montant pour que paiementProgress puisse ensuite détecter
  // qu'une activité ajoutée après coup a fait grossir le total (voir
  // resa.ts) sans se faire tromper par un solde_paye qui date d'avant.
  totalSejour: number;
  // Montant attendu à l'activité de collecte, avant/après ajustement de
  // l'acompte, SANS déduire ce qui est déjà réglé — sert uniquement à
  // signaler durablement l'écart ("604€ au lieu de 600€"), même une fois
  // le solde complètement réglé (contrairement à montantACouvrir qui
  // retombe à 0 dans ce cas). Égaux à montantACouvrir si non fournis.
  montantActiviteAttenduPrevu?: number;
  montantActiviteAttenduReel?: number;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
  isDirection?: boolean;
  onEncaissementDifferent: (prefill: {
    montant: number;
    mode: string;
    date?: string;
    activiteId?: string | null;
  }) => void;
}) {
  const montantAttenduPrevu = montantActiviteAttenduPrevu ?? montantACouvrir;
  const montantAttenduReel = montantActiviteAttenduReel ?? montantACouvrir;
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [egpModal, setEgpModal] = useState<{ r: Reservation; rate: number } | null>(null);
  // "Marquer encaissé" demande la date où le client a réellement payé —
  // souvent pas le jour où l'employée clique (elle rattrape parfois un
  // paiement de plusieurs jours plus tôt) — plutôt que de figer todayStr()
  // en silence.
  const [encaisseDateModal, setEncaisseDateModal] = useState<{ mode: string; date: string } | null>(null);

  const assigneSelectValue = (ASSIGNE_A_OPTIONS as readonly string[]).includes(client.solde_assigne_a)
    ? client.solde_assigne_a
    : client.solde_assigne_a
      ? "Autre"
      : "";

  const validerRdv = () => {
    if (!client.solde_date || !client.solde_rdv_heure || !client.solde_assigne_a) {
      toast("Renseigne la date, l'heure et la personne assignée avant de valider.");
      return;
    }
    const mode = RDV_MODES.includes(client.solde_mode as (typeof RDV_MODES)[number])
      ? client.solde_mode
      : RDV_MODES[0];
    onChange({ solde_rdv_valide: true, solde_mode: mode });
  };

  // Marquer le solde encaissé (RDV finalisé, ou activité désignée) déclare
  // tout le séjour payé — y compris l'acompte, qui n'est jamais recompté
  // séparément (règle du solde unique). Si l'acompte est resté "en attente"
  // à ce moment-là, on prévient avant de continuer : sans ça, un acompte
  // PayPal jamais réellement encaissé se retrouve compté comme payé partout
  // (badges, résumé) sans que personne ne l'ait vraiment vérifié.
  const confirmerAcompteInclus = async () => {
    if (!soldeInclutAcompteImpaye(client)) return true;
    return confirm({
      title: "L'acompte n'a pas encore été marqué encaissé",
      message: `L'acompte de ${euros(client.acompte_montant)} € (${client.acompte_mode}) est toujours "en attente". En continuant, tout le séjour — acompte compris — sera considéré comme payé partout dans le dossier. Le montant collecté couvre-t-il bien aussi cet acompte ?`,
      confirmLabel: "Oui, l'acompte est inclus",
      cancelLabel: "Non, annuler",
    });
  };

  const finaliserRdv = async () => {
    if (!(await confirmerAcompteInclus())) return;
    const ok = await confirm({
      title: "Rendez-vous finalisé ?",
      message:
        'Souhaitez-vous passer toutes les activités en "Payé - rendez-vous paiement finalisé" ?',
      confirmLabel: "Oui",
      cancelLabel: "Non, je m'en occupe manuellement",
    });
    if (ok) {
      onChange({ solde_paye: true, solde_rdv_finalise: true, solde_montant: totalSejour });
    }
  };

  const validerDatePaiement = () => {
    if (!client.solde_date) {
      toast("Renseigne la date de paiement avant de valider.");
      return;
    }
    onChange({ solde_rdv_valide: true, solde_mode: INTEGRAL_MODE_SOLDE_MODE[client.paiement_integral_mode] });
  };

  const marquerEncaisse = async (mode: string, date: string) => {
    if (!(await confirmerAcompteInclus())) return;
    onChange({
      solde_paye: true,
      solde_mode: mode,
      solde_rdv_finalise: false,
      solde_date: date,
      solde_montant: totalSejour,
    });
  };

  const supprimerCartePaiement = () => {
    onChange({
      solde_rdv_valide: false,
      solde_paye: false,
      solde_rdv_finalise: false,
      solde_rdv_heure: "",
      solde_activite_id: null,
      solde_mode: "Espèces EUR",
      solde_montant: 0,
    });
  };

  const sortedByDate = [...reservations]
    .filter((r) => r.date_debut)
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  // Assigne directement l'activité choisie — un clic dans la liste (qu'elle
  // soit la seule datée ou choisie parmi plusieurs) est déjà un choix
  // délibéré, inutile de redemander confirmation juste après (ça faisait
  // perdre un clic à chaque fois que ce n'était pas la 1ère activité datée).
  const assignerActivite = (r: Reservation, key: string) => {
    setShowActivityPicker(false);
    if (key === "activite_egp") {
      getEurToEgpRate().then((rate) => setEgpModal({ r, rate: rate || client.egp_taux || 0 }));
    } else {
      onChange({
        solde_activite_id: r.id,
        solde_mode: "Espèces EUR",
        solde_rdv_valide: true,
        // Un ancien mode "RDV" laissait ces champs remplis — sans ce reset,
        // le client restait détecté comme "RDV paiement" (Suivis, Dashboard)
        // pour toujours, même une fois passé sur "paiement à l'activité"
        // (vécu sur Joël Marin : mode "à l'activité" mais toujours listé en
        // RDV paiement à cause d'un solde_rdv_heure/lieu jamais effacé).
        solde_rdv_heure: "",
        solde_rdv_lieu: "",
      });
    }
  };

  const selectActiviteMode = (key: string) => {
    // Ne change le mode que si une activité a bien pu être assignée — sinon
    // le mode affiché ("à l'activité") ne correspond à aucune activité
    // réelle (solde_activite_id resterait vide), ce qui a déjà produit un
    // état incohérent en prod.
    if (sortedByDate.length === 0) {
      toast("Aucune activité datée pour l'instant.");
      return;
    }
    onChange({ paiement_integral_mode: key });
    // Une seule activité datée : rien à choisir, on l'assigne directement.
    // Plusieurs : on montre la liste tout de suite (pas de confirmation
    // intermédiaire sur la 1ère activité avant de pouvoir en choisir une
    // autre).
    if (sortedByDate.length === 1) {
      assignerActivite(sortedByDate[0], key);
    } else {
      setShowActivityPicker(true);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {INTEGRAL_MODES.filter(
          (m) => !client.paiement_integral_mode || client.paiement_integral_mode === m.key
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              if (client.paiement_integral_mode === m.key) {
                onChange({
                  paiement_integral_mode: "",
                  solde_rdv_heure: "",
                  solde_rdv_lieu: "",
                  solde_rdv_valide: false,
                  solde_activite_id: null,
                });
                setShowActivityPicker(false);
                return;
              }
              if (m.key === "activite_eur" || m.key === "activite_egp") {
                selectActiviteMode(m.key);
              } else {
                onChange({
                  paiement_integral_mode: m.key,
                  solde_rdv_heure: "",
                  solde_rdv_lieu: "",
                  solde_rdv_valide: false,
                  solde_activite_id: null,
                });
              }
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              client.paiement_integral_mode === m.key
                ? m.className
                : "border-neutral-300 text-neutral-500"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {client.paiement_integral_mode === "rdv" && (
        <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
          {!client.solde_rdv_valide ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date du RDV paiement">
                  <input
                    type="date"
                    value={client.solde_date ?? ""}
                    onChange={(e) => onChange({ solde_date: e.target.value || null })}
                    className="input"
                  />
                </Field>
                <Field label="Heure">
                  <input
                    type="time"
                    value={client.solde_rdv_heure}
                    onChange={(e) => onChange({ solde_rdv_heure: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Mode de paiement">
                  <select
                    value={RDV_MODES.includes(client.solde_mode as (typeof RDV_MODES)[number]) ? client.solde_mode : RDV_MODES[0]}
                    onChange={(e) => onChange({ solde_mode: e.target.value })}
                    className="input"
                  >
                    {RDV_MODES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigné à">
                  <select
                    value={assigneSelectValue}
                    onChange={(e) =>
                      onChange({
                        solde_assigne_a: e.target.value === "Autre" ? "" : e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="">Choisir…</option>
                    {ASSIGNE_A_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                {assigneSelectValue === "Autre" && (
                  <Field label="Préciser le nom">
                    <input
                      value={client.solde_assigne_a}
                      onChange={(e) => onChange({ solde_assigne_a: e.target.value })}
                      className="input"
                    />
                  </Field>
                )}
              </div>
              <button
                onClick={validerRdv}
                className="mt-3 rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Valider
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-700">
                <p className="font-medium text-[#171717]">
                  RDV paiement — {fmtDateDMY(client.solde_date)} à {client.solde_rdv_heure}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#fafafa] px-2 py-0.5 text-xs text-[#171717]">
                    ⌂ {client.hotel || "—"}
                  </span>
                  <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs text-[#666666]">
                    👤 {client.solde_assigne_a}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {client.solde_mode}
                  </span>
                </div>
                <EcartAcompteLine
                  reel={montantAttenduReel}
                  prevu={montantAttenduPrevu}
                  entreProchesOublie={client.acompte_entre_proches_oublie}
                />
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <EncaisseButton
                  paye={client.solde_paye}
                  onMarquer={finaliserRdv}
                  onAnnuler={() => onChange({ solde_paye: false, solde_rdv_finalise: false, solde_mode: "" })}
                  onDifferent={() =>
                    onEncaissementDifferent({ montant: montantACouvrir, mode: client.solde_mode || RDV_MODES[0] })
                  }
                  marquerLabel="Rendez-vous finalisé"
                />
                {isDirection && (
                  <button
                    onClick={supprimerCartePaiement}
                    title="Supprimer"
                    className="p-1 text-red-500 hover:text-red-600"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {client.paiement_integral_mode &&
        client.paiement_integral_mode !== "rdv" &&
        client.paiement_integral_mode !== "activite_eur" &&
        client.paiement_integral_mode !== "activite_egp" &&
        (() => {
          const modeInfo = INTEGRAL_MODES.find((m) => m.key === client.paiement_integral_mode)!;
          const soldeMode = INTEGRAL_MODE_SOLDE_MODE[client.paiement_integral_mode];
          return (
            <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3">
              {!client.solde_rdv_valide ? (
                <>
                  <Field label="Date de paiement">
                    <input
                      type="date"
                      value={client.solde_date ?? ""}
                      onChange={(e) => onChange({ solde_date: e.target.value || null })}
                      className="input max-w-[200px]"
                    />
                  </Field>
                  <button
                    onClick={validerDatePaiement}
                    className="mt-3 rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Valider
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-neutral-700">
                    <p className="font-medium text-[#171717]">
                      {modeInfo.label} — {fmtDateDMY(client.solde_date)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                        {soldeMode}
                      </span>
                    </div>
                    <EcartAcompteLine
                      reel={montantAttenduReel}
                      prevu={montantAttenduPrevu}
                      entreProchesOublie={client.acompte_entre_proches_oublie}
                    />
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <EncaisseButton
                      paye={client.solde_paye}
                      onMarquer={() =>
                        setEncaisseDateModal({ mode: soldeMode, date: client.solde_date || todayStr() })
                      }
                      onAnnuler={() => onChange({ solde_paye: false, solde_mode: "" })}
                      onDifferent={() =>
                        onEncaissementDifferent({
                          montant: montantACouvrir,
                          mode: soldeMode,
                          date: client.solde_date || undefined,
                        })
                      }
                      marquerLabel={`${euros(montantACouvrir)} € encaissés`}
                    />
                    {isDirection && (
                      <button
                        onClick={supprimerCartePaiement}
                        title="Supprimer"
                        className="p-1 text-red-500 hover:text-red-600"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {(client.paiement_integral_mode === "activite_eur" ||
        client.paiement_integral_mode === "activite_egp") &&
        (() => {
          const modeInfo = INTEGRAL_MODES.find((m) => m.key === client.paiement_integral_mode)!;
          const soldeMode = client.paiement_integral_mode === "activite_egp" ? "Espèces EGP" : "Espèces EUR";
          const chosenResa = reservations.find((r) => r.id === client.solde_activite_id) || null;

          if (showActivityPicker || (!client.solde_rdv_valide && !chosenResa)) {
            return (
              <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3">
                <p className="mb-2 text-sm font-medium text-neutral-700">
                  Choisir l&apos;activité pour ce paiement
                </p>
                {sortedByDate.length === 0 && (
                  <p className="text-sm text-neutral-400">Aucune activité datée pour l&apos;instant.</p>
                )}
                <div className="space-y-1.5">
                  {sortedByDate.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => assignerActivite(r, client.paiement_integral_mode)}
                      className="flex w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-sm hover:border-[#171717]"
                    >
                      <span className="text-[#171717]">{r.nom_activite || "Activité sans nom"}</span>
                      <span className="font-amounts text-xs text-neutral-500">
                        {fmtDateDMY(r.date_debut)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (!chosenResa) return null;

          return (
            <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-neutral-700">
                  <p className="font-medium text-[#171717]">
                    {modeInfo.label} — {chosenResa.nom_activite || "Activité sans nom"} (
                    {fmtDateDMY(chosenResa.date_debut)})
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      {soldeMode}
                    </span>
                  </div>
                  <EcartAcompteLine
                    reel={montantAttenduReel}
                    prevu={montantAttenduPrevu}
                    entreProchesOublie={client.acompte_entre_proches_oublie}
                  />
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <EncaisseButton
                    paye={client.solde_paye}
                    onMarquer={() =>
                      setEncaisseDateModal({
                        mode: soldeMode,
                        date: chosenResa.date_debut || todayStr(),
                      })
                    }
                    onAnnuler={() => onChange({ solde_paye: false, solde_mode: "" })}
                    onDifferent={() =>
                      onEncaissementDifferent({
                        montant: montantACouvrir,
                        mode: soldeMode,
                        activiteId: chosenResa.id,
                      })
                    }
                    marquerLabel={`${euros(montantACouvrir)} € encaissés ici`}
                  />
                  {isDirection && (
                    <button
                      onClick={supprimerCartePaiement}
                      title="Supprimer"
                      className="p-1 text-red-500 hover:text-red-600"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {encaisseDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Quand le client a-t-il payé ?
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              Renseigne la date où l&apos;argent a réellement été remis — pas forcément
              aujourd&apos;hui si tu rattrapes un paiement déjà reçu.
            </p>
            <input
              type="date"
              value={encaisseDateModal.date}
              onChange={(e) => setEncaisseDateModal({ ...encaisseDateModal, date: e.target.value })}
              className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  marquerEncaisse(encaisseDateModal.mode, encaisseDateModal.date || todayStr());
                  setEncaisseDateModal(null);
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Valider
              </button>
              <button
                onClick={() => setEncaisseDateModal(null)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {egpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Confirmer le montant en EGP
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              Le taux aujourd&apos;hui est à 1€ = {egpModal.rate.toFixed(2)} EGP, soit pour le
              client un total de{" "}
              <strong>{Math.round(montantACouvrir * egpModal.rate).toLocaleString("fr-FR")} EGP</strong>.
              Souhaitez-vous confirmer ?
            </p>
            <div className="mb-4">
              <MontantEgpField
                rate={egpModal.rate}
                onRateChange={(rate) => setEgpModal({ ...egpModal, rate })}
                montantEur={montantACouvrir}
                lockedMontantEur
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  onChange({
                    solde_activite_id: egpModal.r.id,
                    solde_mode: "Espèces EGP",
                    solde_rdv_valide: true,
                    egp_taux: egpModal.rate,
                    egp_montant: Math.round(montantACouvrir * egpModal.rate),
                  });
                  setEgpModal(null);
                }}
                className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Oui, je valide
              </button>
              <button
                onClick={() => setEgpModal(null)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
