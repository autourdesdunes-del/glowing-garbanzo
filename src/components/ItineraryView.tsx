"use client";

import { useEffect, useState } from "react";
import {
  AssouanVerification,
  BusEscalation,
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import {
  acompteWaitingWarning,
  activitePaiementWarning,
  activiteEnCoursAujourdhui,
  chevalChameauBadge,
  cleanActivityTitle,
  isDeuxiemeIleOption,
  momentBadge,
  optionsBadge,
  enCoursBadge,
  reductionBadge,
  paiementStatutKey,
  pointureBadge,
  packBadge,
  taxeTransfertManquante,
  volBadge,
  paiementBadge,
  participantsFor,
  paxLine,
  resaBreakdown,
  resaTotalMontant,
  STATUT_PAIEMENT_OPTIONS,
} from "@/lib/resa";
import AddActivityWizard from "@/components/AddActivityWizard";
import { buildPaxEnglish } from "@/components/client-steps";
import { hotelDisplayForEgypt } from "@/lib/hotelHelp";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-[#171717]">{children}</span>
    </div>
  );
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
export default function ItineraryView({
  client,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  expandedId,
  onToggleExpand,
  onSetPickup,
  onUpdateReservation,
  onDeleteReservation,
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
  hotelVille,
  coutsMap,
  onUpdateCoutReel,
  busEscalations = [],
  onBusEscalation,
  onJourEscalation,
  onAssouanVerification,
  assouanVerifications = [],
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  onSetPickup: (id: string, pickup: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onDeleteReservation: (id: string) => void;
  onAddOption: (resaId: string, seed?: { nom: string; prix: number; quantite?: number; prix_compte_ailleurs?: boolean }) => void;
  onUpdateOption: (resaId: string, optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (resaId: string, optId: string) => void;
  onAddTarif: (resaId: string, seed?: { label: string; pu: number }) => void;
  onUpdateTarif: (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => void;
  onDeleteTarif: (resaId: string, tarifId: string) => void;
  onUpdateClient: (patch: Partial<Client>) => void;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  transfertTarifs: Record<string, CatalogueTransfertTarif[]>;
  catalogueOptions: Record<string, CatalogueOption[]>;
  canSeeMargins: boolean;
  hotelHorsHurghada?: boolean;
  hotelVille?: string;
  coutsMap: Record<string, number>;
  onUpdateCoutReel: (id: string, value: number) => void;
  busEscalations?: BusEscalation[];
  onBusEscalation: (nomActivite: string, reservationId: string) => Promise<void>;
  onJourEscalation: (
    nomActivite: string,
    reservationId: string,
    dateChoisie: string,
    jourChoisi: string,
    joursDisponibles: string[]
  ) => Promise<void>;
  onAssouanVerification: (nomActivite: string, reservationId: string) => Promise<void>;
  assouanVerifications?: AssouanVerification[];
}) {
  const askPickup = (r: Reservation) => {
    if (!window.confirm("Pick up manquant, voulez-vous ajouter un pick up ?")) return;
    const val = window.prompt("Pick-up réel (heure / lieu) :", "");
    if (val && val.trim()) onSetPickup(r.id, val.trim());
  };

  const [voirAnnulees, setVoirAnnulees] = useState(false);
  // Le clic sur une activité ouvre d'abord son résumé (comme la vue
  // Réservations) — cliquer dessus ensuite ouvre l'édition complète pour
  // changer ce qu'il faut, puis "Valider" ramène au résumé mis à jour.
  const [editingExpanded, setEditingExpanded] = useState(false);
  const [egyptOpen, setEgyptOpen] = useState(false);
  const [copiedEgypt, setCopiedEgypt] = useState(false);
  useEffect(() => {
    setEditingExpanded(false);
    setEgyptOpen(false);
  }, [expandedId]);
  const nbAnnulees = reservations.filter((r) => r.statut_resa === "Annulée").length;
  const reservationsAffichees = voirAnnulees
    ? reservations
    : reservations.filter((r) => r.statut_resa !== "Annulée");

  const renderCard = (r: Reservation, day?: string) => {

    const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    const badge = paiementBadge(client, r, reservations, resaOptions, resaTarifs, paiementsEtapes);
    const paiementWarning = activitePaiementWarning(
      client,
      r,
      reservations,
      resaOptions,
      resaTarifs,
      paiementsEtapes
    );
    const acompteWarning = acompteWaitingWarning(client, r, reservations);
    const busEscalation = busEscalations.find((e) => e.reservation_id === r.id);
    const assouanVerification = assouanVerifications.find((v) => v.reservation_id === r.id);
    return (
      <div
        key={r.id}
        onClick={() => onToggleExpand(r.id)}
        className="cursor-pointer rounded-md bg-[#fafafa]/50 px-2.5 py-1.5 text-sm hover:bg-[#fafafa]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-[#171717]">
            {cleanActivityTitle(r.nom_activite) || "Activité sans nom"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
          </span>
          {r.info_importante.trim() && (
            <span
              title={r.info_importante}
              className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700"
            >
              ⚠ {r.info_importante}
            </span>
          )}
          {momentBadge(r) && (
            <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-[11px] font-medium text-[#8B4531]">
              {momentBadge(r)}
            </span>
          )}
          {reductionBadge(r) && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {reductionBadge(r)}
            </span>
          )}
          {enCoursBadge(r) && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              {enCoursBadge(r)}
            </span>
          )}
          {activiteEnCoursAujourdhui(r) && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              📍 en cours
            </span>
          )}
          {volBadge(r) && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
            </span>
          )}
          {packBadge(r) && (
            <span className="rounded-full bg-[#C9973E]/15 px-2 py-0.5 text-[11px] font-medium text-[#8B4531]">
              {packBadge(r)}
            </span>
          )}
          {taxeTransfertManquante(r, hotelHorsHurghada) && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              ⚠ Taxe de transfert manquante
            </span>
          )}
          {pointureBadge(r) && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              {pointureBadge(r)}
            </span>
          )}
          {chevalChameauBadge(r, client) && (
            <span className="rounded-full bg-[#8B4531] px-2 py-0.5 text-[11px] font-semibold text-white">
              {chevalChameauBadge(r, client)}
            </span>
          )}
          {optionsBadge((resaOptions[r.id] || []).filter((o) => !isDeuxiemeIleOption(o.nom))) && (
            <span className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-[11px] font-medium text-white">
              {optionsBadge((resaOptions[r.id] || []).filter((o) => !isDeuxiemeIleOption(o.nom)))}
            </span>
          )}
          {busEscalation && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                busEscalation.statut === "refusee"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {busEscalation.statut === "refusee"
                ? "⚠ Bus refusé — à traiter"
                : "⏳ Bus en attente de validation"}
            </span>
          )}
          {assouanVerification && assouanVerification.statut !== "validee" && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                assouanVerification.statut === "refusee"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {assouanVerification.statut === "refusee"
                ? "⚠ Hébergement Assouan à refaire"
                : "⏳ Hébergement Assouan en attente de validation"}
            </span>
          )}
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
          {r.avoir_utilise > 0 && (
            <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-[11px] font-medium text-[#8B4531]">
              Avoir de {euros(r.avoir_utilise)} € utilisé sur cette activité
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
          <span>
            {day ? fmtDate(day) : "Date à définir"}
            {day && r.date_fin && r.date_fin !== day ? ` → ${fmtDateShort(r.date_fin)}` : ""}
          </span>
          {r.pickup_reel ? (
            <span>· Pick-up {r.pickup_reel}</span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                askPickup(r);
              }}
              title="Pick-up manquant"
              className="text-red-500 hover:text-red-600"
            >
              ⏰
            </button>
          )}
        </div>
        <div className="mt-1 text-xs text-neutral-500">{paxLine(r, client)}</div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-amounts text-sm font-bold text-[#171717]">{euros(total)} €</span>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
    );
  };

  const dateless = reservationsAffichees.filter((r) => !r.date_debut);
  // Les jours affichés viennent des dates des activités elles-mêmes, pas
  // du séjour du client — sinon une activité datée disparaît silencieusement
  // dès que le séjour (Contact > Séjour) n'est pas encore renseigné, ou que
  // l'activité tombe hors de cette plage (avant l'arrivée, après le départ).
  // Un jour par activité datée — sur sa date de début uniquement, jamais un
  // groupe par jour couvert (une activité sur plusieurs jours, ex. "Le
  // Caire 2 jours", ne doit apparaître qu'une seule fois, avec sa plage de
  // dates affichée sur cette unique carte — pas une carte par jour).
  const daySet = new Set<string>();
  reservationsAffichees.forEach((r) => {
    if (!r.date_debut) return;
    daySet.add(r.date_debut);
  });
  const days = Array.from(daySet).sort();

  if (dateless.length === 0 && days.length === 0 && nbAnnulees === 0) {
    return <div className="text-sm text-neutral-400">Aucune activité planifiée pour l&apos;instant.</div>;
  }

  const expandedReservation = reservationsAffichees.find((r) => r.id === expandedId) || null;

  const expOptions = expandedReservation ? resaOptions[expandedReservation.id] || [] : [];
  const expTarifs = expandedReservation ? resaTarifs[expandedReservation.id] || [] : [];
  const expTotal = expandedReservation
    ? resaTotalMontant(expandedReservation, client, expOptions, expTarifs)
    : 0;
  const expBadge = expandedReservation
    ? paiementBadge(client, expandedReservation, reservations, resaOptions, resaTarifs, paiementsEtapes)
    : null;
  const expBreakdown = expandedReservation
    ? resaBreakdown(expandedReservation, client, expOptions, expTarifs, reservations, hotelVille)
    : [];
  const egyptBlock = `Name : ${client.nom || "—"}\n${buildPaxEnglish(client)}\nHotel : ${hotelDisplayForEgypt(
    client.hotel,
    hotelVille
  )}\nRoom Number : ${client.chambre || "—"}\nWhat's app : ${client.telephone || "—"}`;
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
    <div className="space-y-4">
      {expandedReservation && !editingExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => onToggleExpand(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading flex flex-wrap items-center gap-1.5 text-lg font-semibold text-[#171717]">
                {cleanActivityTitle(expandedReservation.nom_activite) || "Activité sans nom"}
                {expandedReservation.horaire_souhaite ? ` (${expandedReservation.horaire_souhaite})` : ""}
                {expandedReservation.info_importante.trim() && (
                  <span
                    title={expandedReservation.info_importante}
                    className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                  >
                    ⚠ {expandedReservation.info_importante}
                  </span>
                )}
                {reductionBadge(expandedReservation) && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {reductionBadge(expandedReservation)}
                  </span>
                )}
                {optionsBadge(expOptions.filter((o) => !isDeuxiemeIleOption(o.nom))) && (
                  <span className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-xs font-medium text-white">
                    {optionsBadge(expOptions.filter((o) => !isDeuxiemeIleOption(o.nom)))}
                  </span>
                )}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm("Supprimer cette activité ? Cette action est irréversible.")) return;
                    onDeleteReservation(expandedReservation.id);
                    onToggleExpand(null);
                  }}
                  title="Supprimer cette activité"
                  className="text-red-500 hover:text-red-600"
                >
                  🗑
                </button>
                <button
                  type="button"
                  onClick={() => onToggleExpand(null)}
                  className="text-neutral-400 hover:text-[#171717]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setEditingExpanded(true)}
                className="block w-full text-left"
              >
                <DetailRow label="Client">{client.nom || "Sans nom"}</DetailRow>
              </button>
              {expandedReservation.date_debut && (
                <DetailRow label="Date">
                  <span className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingExpanded(true)}
                      className="hover:underline"
                    >
                      {fmtDateShort(expandedReservation.date_debut)}
                      {expandedReservation.date_fin &&
                      expandedReservation.date_fin !== expandedReservation.date_debut
                        ? ` → ${fmtDateShort(expandedReservation.date_fin)}`
                        : ""}
                    </button>
                    {expandedReservation.pickup_reel ? (
                      <span className="text-[#0F5C56]">🚐 {expandedReservation.pickup_reel}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => askPickup(expandedReservation)}
                        className="text-xs font-normal text-red-500 hover:text-red-600"
                      >
                        + Pick-up
                      </button>
                    )}
                  </span>
                </DetailRow>
              )}
              <button
                type="button"
                onClick={() => setEditingExpanded(true)}
                className="block w-full text-left"
              >
                <DetailRow label="PAX">{paxLine(expandedReservation, client)}</DetailRow>
              </button>
              {expBadge && (
                <DetailRow label="Paiement">
                  <select
                    value={paiementStatutKey(client, expandedReservation)}
                    onChange={(e) => {
                      const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === e.target.value);
                      if (opt) onUpdateClient(opt.patch(expandedReservation));
                    }}
                    className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${expBadge.className}`}
                  >
                    {STATUT_PAIEMENT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </DetailRow>
              )}
              <button
                type="button"
                onClick={() => setEditingExpanded(true)}
                className="block w-full text-left"
              >
                <DetailRow label="Total">{euros(expTotal)} €</DetailRow>
              </button>
            </div>
            {expBreakdown.length > 0 && (
              <div className="mt-1 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                {expBreakdown.map((line, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span>{line.label}</span>
                    <span>= {euros(line.amount)} €</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-center text-xs text-neutral-400">
              Clique sur une ligne pour modifier cette activité
            </p>

            <button
              type="button"
              onClick={() => setEgyptOpen((o) => !o)}
              className="mt-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
            >
              <span className={`transition-transform ${egyptOpen ? "rotate-90" : ""}`}>›</span>
              Bloc équipe Égypte
            </button>
            {egyptOpen && (
              <div className="mt-1 rounded-md border border-[#666666]/20 bg-white p-3">
                <pre className="font-amounts whitespace-pre-wrap rounded-md bg-[#fafafa] p-2 text-xs">
                  {egyptBlock}
                </pre>
                <button
                  type="button"
                  onClick={copyEgyptBlock}
                  className="mt-2 rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  {copiedEgypt ? "Copié ✓" : "Copier"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {expandedReservation && editingExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => onToggleExpand(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AddActivityWizard
              key={expandedReservation.id}
              editReservationId={expandedReservation.id}
              client={client}
              catalogue={catalogue}
              catalogueTarifs={catalogueTarifs}
              transfertTarifs={transfertTarifs}
              catalogueOptions={catalogueOptions}
              hotelHorsHurghada={hotelHorsHurghada}
              onAddReservation={async () => null}
              onUpdateReservation={onUpdateReservation}
              onDeleteReservation={onDeleteReservation}
              onAddOption={onAddOption}
              onUpdateOption={onUpdateOption}
              onDeleteOption={onDeleteOption}
              onAddTarif={onAddTarif}
              onUpdateTarif={onUpdateTarif}
              onDeleteTarif={onDeleteTarif}
              reservations={reservations}
              resaOptions={resaOptions}
              resaTarifs={resaTarifs}
              onFinish={() => onToggleExpand(null)}
              onCancel={() => onToggleExpand(null)}
              onBusEscalation={onBusEscalation}
              onJourEscalation={onJourEscalation}
              onAssouanVerification={onAssouanVerification}
            />
          </div>
        </div>
      )}
      {nbAnnulees > 0 && (
        <button
          onClick={() => setVoirAnnulees((v) => !v)}
          className="text-xs font-medium text-neutral-500 hover:text-[#171717] hover:underline"
        >
          {voirAnnulees
            ? "Masquer les activités annulées"
            : `Voir les activités annulées (${nbAnnulees})`}
        </button>
      )}
      {dateless.length > 0 && (
        <div className="rounded-md border border-[#666666]/15 bg-white p-2.5">
          <div className="mb-1.5">
            <span className="font-heading text-sm font-semibold text-[#171717]">
              Activités sans date
            </span>
          </div>
          <div className="space-y-1.5">{dateless.map((r) => renderCard(r))}</div>
        </div>
      )}

      {days.map((day) => {
        const dayResas = reservationsAffichees.filter((r) => r.date_debut === day);

        return (
          <div key={day} className="rounded-md border border-[#666666]/15 bg-white p-2.5">
            <div className="space-y-1.5">{dayResas.map((r) => renderCard(r, day))}</div>
          </div>
        );
      })}
    </div>
  );
}
