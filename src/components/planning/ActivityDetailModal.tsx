"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Client,
  ClientHotel,
  HotelReference,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { hotelNomPourActivite, matchHotel } from "@/lib/hotelHelp";
import {
  acompteWaitingWarning,
  activitePaiementWarning,
  avoirUtiliseTotal,
  badgeAnnulation,
  chevalChameauBadge,
  cleanActivityTitle,
  enCoursBadge,
  fmtEncaisseLe,
  isDeuxiemeIleOption,
  momentBadge,
  optionsBadge,
  packBadge,
  paiementBadge,
  participantsFor,
  paxLine,
  pointureBadge,
  reductionBadge,
  resaBreakdown,
  resaTotalMontant,
  reservationsActives,
  siteCaireBadge,
  STATUT_PAIEMENT_OPTIONS,
  taxeTransfertManquante,
  volBadge,
} from "@/lib/resa";
import { fmtAnnulationSuffix } from "@/lib/dates";
import { buildEgyptActivityBlock } from "@/lib/egyptBlock";
import { euros, fmtDate } from "@/lib/planningViewFormat";
import { DetailRow } from "@/components/planning/PlanningCards";
import { StatutBadgeSelect } from "@/components/StatutBadgeSelect";

// Modale de détail d'une activité (Réservations) — extraite de
// PlanningView.tsx pour l'alléger, sans changement de comportement.
export function ActivityDetailModal({
  client,
  r,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  onOpenClient,
  onOpenActivity,
  onOpenRdvPaiement,
  onUpdateReservation,
  hotelsRef,
  onClose,
  onBack,
}: {
  client: Client;
  r: Reservation;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  onOpenClient: (clientId: string) => void;
  onOpenActivity: (r: Reservation) => void;
  onOpenRdvPaiement: (clientId: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  hotelsRef: HotelReference[];
  onClose: () => void;
  onBack?: () => void;
}) {
  const supabase = createClient();
  const [showSoldeDetail, setShowSoldeDetail] = useState(false);
  const [copiedEgypt, setCopiedEgypt] = useState(false);
  const [editingPickup, setEditingPickup] = useState(false);
  const [pickupDraft, setPickupDraft] = useState(r.pickup_reel);
  const [pickupVeilleDraft, setPickupVeilleDraft] = useState(r.pickup_veille);
  // La modale garde `r` figé (capturé à l'ouverture) — sans état local,
  // valider un pick-up réaffichait "+ Ajouter le pick-up" jusqu'à fermeture/
  // réouverture, alors que l'enregistrement avait bien réussi (visible sur
  // la carte derrière).
  const [savedPickup, setSavedPickup] = useState(r.pickup_reel);
  const [savedPickupVeille, setSavedPickupVeille] = useState(r.pickup_veille);
  const [photoVolUrl, setPhotoVolUrl] = useState("");
  // Séjour multi-hôtels (circuit) : pour que le bloc équipe Égypte de cette
  // activité précise affiche seulement l'hôtel où le client se trouve ce
  // jour-là, pas les trois à la fois (voir hotelEgyptLinePourActivite).
  const [clientHotels, setClientHotels] = useState<ClientHotel[]>([]);
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
    const supabase = createClient();
    (async () => {
      if (!r.photo_vol_path) {
        setPhotoVolUrl("");
        return;
      }
      const { data } = await supabase.storage.from("photos-vol").createSignedUrl(r.photo_vol_path, 3600);
      setPhotoVolUrl(data?.signedUrl ?? "");
    })();
  }, [r.photo_vol_path]);
  const options = resaOptions[r.id] || [];
  const tarifs = resaTarifs[r.id] || [];
  const total = resaTotalMontant(r, client, options, tarifs);
  const hotelNomActivite = hotelNomPourActivite(clientHotels, r.date_debut, client.hotel);
  const breakdown = resaBreakdown(
    r,
    client,
    options,
    tarifs,
    reservations,
    matchHotel(hotelNomActivite, hotelsRef)?.ville
  );
  const { nbAd, nbEnf } = participantsFor(r, client);
  const soldeIci = client.solde_activite_id === r.id;
  // Le calcul du restant à payer a besoin des réservations de CE client
  // uniquement — jamais du tableau global toutes activités confondues.
  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
  const clientEtapes = paiementsEtapes.filter((e) => e.client_id === client.id);
  // Le badge de paiement "en direct" (solde/acompte) n'a pas de sens pour une
  // activité annulée — elle resterait potentiellement affichée "Payé" alors
  // qu'elle a été remboursée. Ce modal est atteignable depuis le tiroir
  // "activités annulées" du calendrier, contrairement au reste de cette vue
  // qui exclut déjà les annulées.
  const badge =
    r.statut_resa === "Annulée"
      ? badgeAnnulation(r)
      : paiementBadge(client, r, clientReservations, resaOptions, resaTarifs, clientEtapes);
  // Le solde peut être en attente de règlement sur une AUTRE activité déjà
  // identifiée (solde_activite_id pointe ailleurs) — dans ce cas on
  // renseigne où et quand, plutôt que de ne rien dire du tout.
  const soldeActiviteAilleurs =
    !soldeIci && !client.solde_paye && client.solde_activite_id
      ? clientReservations.find((rr) => rr.id === client.solde_activite_id) || null
      : null;
  // Un RDV paiement déjà planifié (à l'hôtel) est un cas normal, pas un trou
  // dans le suivi — le solde n'est simplement pas rattaché à une activité
  // puisqu'il se règle ailleurs. Ne jamais le confondre avec un solde
  // vraiment orphelin (aucune activité ET aucun RDV).
  const rdvPlanifie =
    !soldeIci &&
    !client.solde_paye &&
    !client.solde_activite_id &&
    !!(client.solde_rdv_heure || client.solde_rdv_lieu);
  // Solde en attente sans aucune activité de collecte NI RDV planifié — un
  // vrai trou dans le suivi qui doit se voir, sous peine de finir sans
  // jamais être encaissé.
  const soldeSansActivite =
    !soldeIci && !client.solde_paye && !client.solde_activite_id && !rdvPlanifie;
  const [showSoldeSansActiviteAlert, setShowSoldeSansActiviteAlert] = useState(soldeSansActivite);
  const totalSejourClient = reservationsActives(clientReservations).reduce(
    (s, rr) => s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
    0
  );
  const acompteClient = client.acompte_valide ? Number(client.acompte_montant) || 0 : 0;
  const etapesSumClient = clientEtapes.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const montantRdv = Math.max(
    totalSejourClient - acompteClient - etapesSumClient - avoirUtiliseTotal(reservationsActives(clientReservations)),
    0
  );
  const paiementWarning = activitePaiementWarning(
    client,
    r,
    clientReservations,
    resaOptions,
    resaTarifs,
    clientEtapes
  );
  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);

  const hotelMatch = matchHotel(hotelNomActivite, hotelsRef);
  const egyptBlock = buildEgyptActivityBlock(
    client,
    r,
    options,
    clientReservations,
    resaOptions,
    resaTarifs,
    clientEtapes,
    clientHotels,
    hotelMatch?.ville
  );

  // Le texte pré-rempli reste modifiable avant l'envoi (demande de Mélanie,
  // 2026-09-17), et conservé dans reservations.egypt_block_note (demande du
  // 2026-09-18) — undefined tant que l'employée n'a rien touché, auquel cas
  // on affiche/copie directement le texte recalculé (ce composant est
  // remonté à chaque activité via key={r.id}, pas besoin de reset manuel).
  const [egyptBlockEdite, setEgyptBlockEdite] = useState<string | undefined>(
    r.egypt_block_note || undefined
  );
  const egyptBlockAffiche = egyptBlockEdite ?? egyptBlock;
  const copyEgyptBlock = async () => {
    try {
      await navigator.clipboard.writeText(egyptBlockAffiche);
      setCopiedEgypt(true);
      setTimeout(() => setCopiedEgypt(false), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };

  return (
    <>
      {showSoldeSansActiviteAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-300 bg-white p-5 shadow-xl">
            <p className="text-sm font-medium text-red-700">
              ⚠️ Solde du séjour en attente — pas encore rattaché à une activité de collecte, à
              surveiller. Souhaitez-vous définir un paiement pour cette activité/ce client ?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenClient(client.id);
                  onClose();
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Oui, définir un paiement
              </button>
              <button
                type="button"
                onClick={() => setShowSoldeSansActiviteAlert(false)}
                className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:underline"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 flex items-center gap-1 text-xs font-medium text-[#0F5C56] hover:underline"
            >
              ← Retour au billet
            </button>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`font-heading text-lg font-semibold ${
                  r.statut_resa === "Annulée" ? "text-red-600" : "text-[#171717]"
                }`}
              >
                {cleanActivityTitle(r.nom_activite) || "Activité sans nom"}
                {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
                {r.statut_resa === "Annulée"
                  ? ` ${fmtAnnulationSuffix(r.annulation_date, r.annulation_heure)}`
                  : ""}
            </h3>
            {r.info_importante.trim() && (
              <span
                title={r.info_importante}
                className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
              >
                ⚠ {r.info_importante}
              </span>
            )}
            {r.montgolfiere_annulee && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                🎈 Montgolfière annulée
              </span>
            )}
            {r.participants_retires > 0 && (
              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">
                −{r.participants_retires} participant{r.participants_retires > 1 ? "s" : ""}
              </span>
            )}
            {momentBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {momentBadge(r)}
              </span>
            )}
            {reductionBadge(r, client, options, tarifs) && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {reductionBadge(r, client, options, tarifs)}
              </span>
            )}
            {enCoursBadge(r) && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {enCoursBadge(r)}
              </span>
            )}
            {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)), reservations, r.id) && (
              <span className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-xs font-medium text-white">
                {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)), reservations, r.id)}
              </span>
            )}
            {volBadge(r) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {volBadge(r)}
                {r.photo_vol_path ? " 📷" : ""}
              </span>
            )}
            {packBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/15 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {packBadge(r)}
              </span>
            )}
            {siteCaireBadge(r) && (
              <span className="rounded-full bg-[#0F5C56]/10 px-2 py-0.5 text-xs font-medium text-[#0F5C56]">
                {siteCaireBadge(r)}
              </span>
            )}
            {pointureBadge(r) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {pointureBadge(r)}
              </span>
            )}
            {chevalChameauBadge(r, client) && (
              <span className="rounded-full bg-[#8B4531] px-2 py-0.5 text-xs font-semibold text-white">
                {chevalChameauBadge(r, client)}
              </span>
            )}
            {taxeTransfertManquante(r, !!hotelMatch && !hotelMatch.sur_hurghada, hotelMatch?.ville) && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                ⚠ Taxe de transfert manquante
              </span>
            )}
            {r.avoir_utilise > 0 && (
              <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                Avoir de {euros(r.avoir_utilise)} € utilisé
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        {r.statut_resa === "Annulée" && r.annulation_raison && (
          <p className="mt-1 text-xs font-medium text-red-600">
            Annulée — {r.annulation_raison}
          </p>
        )}
        {(paiementWarning || acompteWarning) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {acompteWarning && (
              <span className="text-xs font-medium text-yellow-700">
                ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
              </span>
            )}
            {paiementWarning && (
              <span className="text-xs font-medium text-red-600">
                ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <DetailRow label="Client">
            <button
              type="button"
              onClick={() => {
                onOpenClient(client.id);
                onClose();
              }}
              className="text-[#171717] underline hover:no-underline"
            >
              {client.nom || "Sans nom"}
            </button>
          </DetailRow>
          <DetailRow label="Date">
            {fmtDate(r.date_debut || "")}
            {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
          </DetailRow>
          <DetailRow label="Pick-up (heure Égypte)">
            {editingPickup ? (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={pickupDraft}
                    onChange={(e) => setPickupDraft(e.target.value)}
                    placeholder="Heure Égypte / lieu"
                    className="input w-36 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = pickupDraft.trim();
                      onUpdateReservation(r.id, { pickup_reel: val, pickup_veille: pickupVeilleDraft });
                      setSavedPickup(val);
                      setSavedPickupVeille(pickupVeilleDraft);
                      setEditingPickup(false);
                    }}
                    className="rounded-md bg-[#171717] px-2 py-1 text-xs font-medium text-white"
                  >
                    OK
                  </button>
                </div>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={pickupVeilleDraft}
                    onChange={(e) => setPickupVeilleDraft(e.target.checked)}
                  />
                  Pick-up la veille au soir
                </label>
              </div>
            ) : savedPickup ? (
              <button
                type="button"
                onClick={() => {
                  setPickupDraft(savedPickup);
                  setPickupVeilleDraft(savedPickupVeille);
                  setEditingPickup(true);
                }}
                className="text-[#0F5C56] hover:underline"
              >
                🚐 {savedPickup}
                {savedPickupVeille ? " (la veille)" : ""}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPickupDraft("");
                  setPickupVeilleDraft(false);
                  setEditingPickup(true);
                }}
                className="text-xs font-medium text-[#0F5C56] underline"
              >
                + Ajouter le pick-up
              </button>
            )}
          </DetailRow>
          {(r.numero_vol.trim() || r.horaire_vol.trim() || r.photo_vol_path) && (
            <DetailRow label="Vol du client">
              <div className="flex flex-col items-end gap-0.5">
                <span>{[r.numero_vol.trim(), r.horaire_vol.trim()].filter(Boolean).join(" · ") || "—"}</span>
                {r.photo_vol_path && photoVolUrl && (
                  <a
                    href={photoVolUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-normal text-[#0F5C56] underline"
                  >
                    Voir la photo du vol
                  </a>
                )}
              </div>
            </DetailRow>
          )}
          <DetailRow label="PAX">{paxLine(r, client)}</DetailRow>
          <DetailRow label="Paiement">
            {(() => {
              if (r.statut_resa === "Annulée") {
                const b = badgeAnnulation(r);
                if (!b) return null;
                return (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.className}`}>{b.label}</span>
                );
              }
              if (!badge) return null;
              // Badge indépendant par activité (r.paiement_statut) — ne
              // touche jamais le solde partagé ni une reprise en attente sur
              // une autre activité (incident Carine LELOIR, rétabli en menu
              // par activité sur demande de Mélanie du 16/09, mais réellement
              // indépendant cette fois).
              return (
                <StatutBadgeSelect
                  value={r.paiement_statut || "attente"}
                  options={STATUT_PAIEMENT_OPTIONS}
                  onChange={(v) => onUpdateReservation(r.id, { paiement_statut: v })}
                />
              );
            })()}
          </DetailRow>
          <DetailRow label="Total">{euros(total)} €</DetailRow>
        </div>

        {breakdown.length > 0 && (
          <div className="mt-1 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
            {breakdown.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span>{line.label}</span>
                <span>= {euros(line.amount)} €</span>
              </div>
            ))}
          </div>
        )}

        {(soldeIci || soldeActiviteAilleurs) && (
          <div className="mt-3 rounded-md bg-[#C9973E]/10 p-3 text-sm">
            <div className="flex w-full items-center justify-between gap-2 font-medium text-[#8B4531]">
              <button
                type="button"
                onClick={() => setShowSoldeDetail((v) => !v)}
                className="flex-1 text-left"
              >
                {soldeIci ? (
                  `💰 Solde du séjour collecté ici — ${client.solde_paye ? "Payé" : "À régler"}`
                ) : (
                  <>
                    💰 Solde du séjour collecté ultérieurement —{" "}
                    <span
                      role="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenActivity(soldeActiviteAilleurs!);
                      }}
                      className="underline hover:no-underline"
                    >
                      {cleanActivityTitle(soldeActiviteAilleurs!.nom_activite) || "Activité"}
                      {soldeActiviteAilleurs!.date_debut
                        ? ` (${fmtDate(soldeActiviteAilleurs!.date_debut)})`
                        : ""}
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSoldeDetail((v) => !v)}
                className="shrink-0 text-xs"
              >
                {showSoldeDetail ? "▲" : "▼"}
              </button>
            </div>
            {showSoldeDetail && (
              <div className="mt-2 space-y-1 border-t border-[#C9973E]/30 pt-2 text-xs text-[#8B4531]">
                {client.paiement_type === "acompte" && client.acompte_valide && (
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      Acompte — {client.acompte_mode}
                      {client.acompte_paye && client.acompte_date_encaissement
                        ? ` (encaissé le ${fmtEncaisseLe(client.acompte_date_encaissement, client.acompte_encaisse_ts)})`
                        : client.acompte_paye
                        ? " (encaissé)"
                        : " (à encaisser)"}
                    </span>
                    <span>{euros(client.acompte_montant)} €</span>
                  </div>
                )}
                {clientReservations.map((rr) => (
                  <button
                    type="button"
                    key={rr.id}
                    onClick={() => onOpenActivity(rr)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span>
                      {cleanActivityTitle(rr.nom_activite) || "Activité"}
                      {rr.date_debut ? ` (${fmtDate(rr.date_debut)})` : ""}
                    </span>
                    <span>
                      {euros(resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []))} €
                    </span>
                  </button>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-[#C9973E]/30 pt-1 font-semibold">
                  <span>Total séjour</span>
                  <span>
                    {euros(
                      reservationsActives(clientReservations).reduce(
                        (s, rr) =>
                          s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
                        0
                      )
                    )}{" "}
                    €
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {soldeSansActivite && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700">
            ⚠️ Solde du séjour en attente — pas encore rattaché à une activité de collecte, à surveiller.
          </div>
        )}

        {rdvPlanifie && (
          <div className="mt-3 overflow-hidden rounded-md border border-blue-300 bg-blue-50 text-blue-700">
            <button
              type="button"
              onClick={() => {
                onOpenRdvPaiement(client.id);
                onClose();
              }}
              className="w-full p-3 text-left hover:bg-blue-100"
            >
              <p className="text-sm font-medium">📅 RDV paiement planifié</p>
              <p className="mt-1 text-xs">
                {client.solde_date ? fmtDate(client.solde_date) : "Date à définir"}
                {client.solde_rdv_heure ? ` — ${client.solde_rdv_heure}` : ""}
                {client.solde_rdv_lieu ? ` — ${client.solde_rdv_lieu}` : ""}
              </p>
              <p className="mt-1 whitespace-nowrap text-xs font-semibold">
                Montant : {euros(montantRdv)} €
              </p>
            </button>
            {clientReservations.length > 0 && (
              <div className="space-y-1 border-t border-blue-200 px-3 py-2 text-xs">
                {clientReservations.map((rr) => (
                  <button
                    type="button"
                    key={rr.id}
                    onClick={() => onOpenActivity(rr)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span>
                      {cleanActivityTitle(rr.nom_activite) || "Activité"}
                      {rr.date_debut ? ` (${fmtDate(rr.date_debut)})` : ""}
                    </span>
                    <span className="whitespace-nowrap">
                      {euros(resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []))} €
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {r.info_importante && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ {r.info_importante}
          </div>
        )}

        {reductionBadge(r, client, options, tarifs) && (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {reductionBadge(r, client, options, tarifs)}
            {r.reduction_motif ? ` — ${r.reduction_motif}` : ""}
          </div>
        )}

        {enCoursBadge(r) && (
          <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">{enCoursBadge(r)}</div>
        )}

        {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)), reservations, r.id) && (
          <div className="mt-3 rounded-md bg-[#0F5C56]/10 px-3 py-2 text-xs text-[#171717]">
            {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)), reservations, r.id)}
          </div>
        )}

        <div className="mt-3 rounded-md border border-[#666666]/20 bg-white p-4">
          <h3 className="font-heading text-sm font-semibold text-[#171717]">
            Bloc pour l&apos;équipe Égypte
          </h3>
          <p dir="rtl" className="mt-1 text-xs text-neutral-500">
            يرجى التحقق من صحة جميع الحقول قبل الإرسال
          </p>
          {/* Hauteur plafonnée avec défilement interne — sans ça, le nombre
              de lignes (hôtel/pick-up/quad-buggy/vol...) fait grossir la
              boîte indéfiniment, parfois plus grande que le reste de la
              fiche (mobile ET desktop, Mélanie 2026-09-19). */}
          <textarea
            value={egyptBlockAffiche}
            onChange={(e) => {
              setEgyptBlockEdite(e.target.value);
              onUpdateReservation(r.id, { egypt_block_note: e.target.value });
            }}
            rows={8}
            className="font-amounts mt-2 max-h-40 w-full resize-y overflow-y-auto whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={copyEgyptBlock}
              className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {copiedEgypt ? "Copié ✓" : "Copier"}
            </button>
            {egyptBlockEdite !== undefined && egyptBlockEdite !== egyptBlock && (
              <button
                type="button"
                onClick={() => {
                  setEgyptBlockEdite(undefined);
                  onUpdateReservation(r.id, { egypt_block_note: "" });
                }}
                className="text-xs text-neutral-400 hover:underline"
              >
                Revenir au texte pré-rempli
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
