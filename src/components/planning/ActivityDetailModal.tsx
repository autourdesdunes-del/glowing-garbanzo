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
import { matchHotel } from "@/lib/hotelHelp";
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
  paiementStatutKey,
  participantsFor,
  paxLine,
  pointureBadge,
  reductionBadge,
  resaBreakdown,
  resaTotalMontant,
  reservationsActives,
  siteCaireBadge,
  soldeInclutAcompteImpaye,
  STATUT_PAIEMENT_OPTIONS,
  taxeTransfertManquante,
  volBadge,
} from "@/lib/resa";
import { fmtAnnulationSuffix } from "@/lib/dates";
import { buildEgyptActivityBlock } from "@/lib/egyptBlock";
import { useConfirm } from "@/components/ConfirmProvider";
import { euros, fmtDate } from "@/lib/planningViewFormat";
import { DetailRow } from "@/components/planning/PlanningCards";

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
  hotelsRef: HotelReference[];
  onClose: () => void;
  onBack?: () => void;
}) {
  const supabase = createClient();
  const confirm = useConfirm();
  const [showSoldeDetail, setShowSoldeDetail] = useState(false);
  const [copiedEgypt, setCopiedEgypt] = useState(false);
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
  // Le client vient d'une liste tenue par le parent (rafraîchie par polling)
  // — sans état local, changer le statut de paiement ici mettrait à jour la
  // base mais l'affichage resterait sur l'ancien statut jusqu'au prochain
  // rafraîchissement.
  const [soldeOverride, setSoldeOverride] = useState<Partial<Client> | null>(null);
  const effectiveClient = soldeOverride ? { ...client, ...soldeOverride } : client;
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
  const breakdown = resaBreakdown(r, client, options, tarifs, reservations, matchHotel(client.hotel, hotelsRef)?.ville);
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
      : paiementBadge(effectiveClient, r, clientReservations, resaOptions, resaTarifs, clientEtapes);
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
  const acompteClient =
    client.paiement_type === "acompte" && client.acompte_valide ? Number(client.acompte_montant) || 0 : 0;
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

  const hotelMatch = matchHotel(client.hotel, hotelsRef);
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

  const copyEgyptBlock = async () => {
    try {
      await navigator.clipboard.writeText(egyptBlock);
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
            {momentBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {momentBadge(r)}
              </span>
            )}
            {reductionBadge(r) && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {reductionBadge(r)}
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
            {taxeTransfertManquante(r, !!hotelMatch && !hotelMatch.sur_hurghada) && (
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
          {r.pickup_reel && (
            <DetailRow label="Pick-up">
              <span className="text-[#0F5C56]">🚐 {r.pickup_reel}</span>
            </DetailRow>
          )}
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
            {r.statut_resa === "Annulée" ? (
              // Le menu déroulant "en direct" reste caché sur une activité
              // annulée — sinon on peut la remarquer "Payé" par erreur alors
              // que le vrai statut à retenir est celui décidé à l'annulation
              // (remboursée / avoir créé / non remboursée).
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
            ) : (
              <select
                value={paiementStatutKey(effectiveClient, r)}
                onChange={async (e) => {
                  const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === e.target.value);
                  if (!opt) return;
                  if (opt.key.startsWith("paye_") && soldeInclutAcompteImpaye(effectiveClient)) {
                    const ok = await confirm({
                      title: "L'acompte n'a pas encore été marqué encaissé",
                      message: `L'acompte de ${euros(effectiveClient.acompte_montant)} € (${effectiveClient.acompte_mode}) est toujours "en attente". En continuant, tout le séjour — acompte compris — sera considéré comme payé partout dans le dossier. Le montant collecté couvre-t-il bien aussi cet acompte ?`,
                      confirmLabel: "Oui, l'acompte est inclus",
                      cancelLabel: "Non, annuler",
                    });
                    if (!ok) return;
                  }
                  const patch = opt.patch(r);
                  setSoldeOverride((prev) => ({ ...prev, ...patch }));
                  await supabase.from("clients").update(patch).eq("id", client.id);
                }}
                className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${badge.className}`}
              >
                {STATUT_PAIEMENT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
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

        {reductionBadge(r) && (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {reductionBadge(r)}
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
          <pre className="font-amounts mt-2 whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 text-xs">
            {egyptBlock}
          </pre>
          <button
            onClick={copyEgyptBlock}
            className="mt-2 rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {copiedEgypt ? "Copié ✓" : "Copier"}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
