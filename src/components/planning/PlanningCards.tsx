"use client";

import {
  Client,
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
  chevalChameauBadge,
  cleanActivityTitle,
  enCoursBadge,
  isDeuxiemeIleOption,
  momentBadge,
  optionsBadge,
  packBadge,
  paiementBadge,
  participantsFor,
  paxLine,
  pointureBadge,
  reductionBadge,
  resaTotalMontant,
  siteCaireBadge,
  taxeTransfertManquante,
  volBadge,
} from "@/lib/resa";
import { infosManquantesToutes } from "@/lib/infosManquantes";
import { euros, fmtDate } from "@/lib/planningViewFormat";

// Carte résumé d'une activité (Réservations) et petite ligne label/valeur
// des modales de détail — extraites de PlanningView.tsx pour l'alléger,
// sans changement de comportement.

export function ReservationSummaryCard({
  client,
  r,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  hotelsRef = [],
  onClick,
  onOpenClient,
  size = "full",
}: {
  client: Client;
  r: Reservation;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  hotelsRef?: HotelReference[];
  onClick: () => void;
  onOpenClient: (clientId: string) => void;
  size?: "full" | "medium" | "compact";
}) {
  const hotelHorsHurghada = (() => {
    const m = matchHotel(client.hotel, hotelsRef);
    return !!m && !m.sur_hurghada;
  })();
  const options = resaOptions[r.id] || [];
  const total = resaTotalMontant(r, client, options, resaTarifs[r.id] || []);
  const { nbAd, nbEnf } = participantsFor(r, client);
  // Le calcul du montant restant a besoin des réservations (et étapes de
  // paiement) de CE client uniquement — jamais du tableau global toutes
  // activités confondues, sous peine de sommer les montants de plusieurs
  // clients (bug déjà rencontré).
  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
  const clientEtapes = paiementsEtapes.filter((e) => e.client_id === client.id);
  const badge = paiementBadge(client, r, clientReservations, resaOptions, resaTarifs, clientEtapes);
  const paiementWarning = activitePaiementWarning(
    client,
    r,
    clientReservations,
    resaOptions,
    resaTarifs,
    clientEtapes
  );
  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);
  const infosManquantes = infosManquantesToutes(client, reservations);
  const infoComplet = infosManquantes.length === 0;
  const infoStatut = infoComplet ? null : infosManquantes[0];

  if (size === "medium") {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-3"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium leading-snug text-[#171717]">
            {cleanActivityTitle(r.nom_activite) || "Activité"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
          </p>
          {r.info_importante.trim() && (
            <span
              title={r.info_importante}
              className="max-w-[180px] truncate whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
            >
              ⚠ {r.info_importante}
            </span>
          )}
          {acompteWarning && (
            <span className="whitespace-nowrap text-[10px] font-medium text-yellow-700">
              ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
            </span>
          )}
          {momentBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              {momentBadge(r)}
            </span>
          )}
          {reductionBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {reductionBadge(r)}
            </span>
          )}
          {enCoursBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              {enCoursBadge(r)}
            </span>
          )}
          {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)), reservations, r.id) && (
            <span className="whitespace-nowrap rounded-full bg-[#0F5C56] px-1.5 py-0.5 text-[10px] font-medium text-white">
              {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)), reservations, r.id)}
            </span>
          )}
          {volBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
            </span>
          )}
          {packBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              {packBadge(r)}
            </span>
          )}
          {siteCaireBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#0F5C56]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0F5C56]">
              {siteCaireBadge(r)}
            </span>
          )}
          {pointureBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {pointureBadge(r)}
            </span>
          )}
          {chevalChameauBadge(r, client) && (
            <span className="whitespace-nowrap rounded-full bg-[#8B4531] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {chevalChameauBadge(r, client)}
            </span>
          )}
          {taxeTransfertManquante(r, hotelHorsHurghada) && (
            <span className="whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
              ⚠ Taxe manquante
            </span>
          )}
          {r.avoir_utilise > 0 && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              Avoir {euros(r.avoir_utilise)} €
            </span>
          )}
        </div>
        {r.pickup_reel && (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#0F5C56]">
            🚐 Pick-up {r.pickup_reel}
          </p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClient(client.id);
          }}
          className="mt-1 text-xs font-medium text-[#171717] hover:underline"
        >
          {client.nom || "Sans nom"}
        </button>
        <p className="mt-1 text-xs text-neutral-500">{paxLine(r, client)}</p>
        <div className="mt-2 flex items-start justify-between gap-2">
          <span
            className={`min-w-0 flex-1 rounded-full px-1.5 py-0.5 text-xs font-medium leading-tight ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-[#171717]">
            {euros(total)} €
          </span>
        </div>
        {(paiementWarning || (!infoComplet && infoStatut)) && (
          <p className="mt-1.5 text-xs font-medium leading-tight text-red-600">
            {paiementWarning
              ? `⚠️ ${euros(paiementWarning.amount)} ${paiementWarning.devise} to pay`
              : `⚠️ ${infoStatut}`}
          </p>
        )}
      </div>
    );
  }

  if (size === "compact") {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-2"
      >
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-xs font-medium leading-tight text-[#171717]">
            {cleanActivityTitle(r.nom_activite) || "Activité"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
          </p>
          {volBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
            </span>
          )}
          {packBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              {packBadge(r)}
            </span>
          )}
          {siteCaireBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#0F5C56]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#0F5C56]">
              {siteCaireBadge(r)}
            </span>
          )}
          {pointureBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {pointureBadge(r)}
            </span>
          )}
          {chevalChameauBadge(r, client) && (
            <span className="rounded-full bg-[#8B4531] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {chevalChameauBadge(r, client)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClient(client.id);
          }}
          className="mt-0.5 text-xs font-medium text-[#171717] hover:underline"
        >
          {client.nom || "Sans nom"}
        </button>
        <p className="mt-0.5 text-[10px] text-neutral-500">{paxLine(r, client)}</p>
        <div className="mt-1 flex items-start justify-between gap-1">
          <span
            className={`min-w-0 flex-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-[#171717]">
            {euros(total)} €
          </span>
        </div>
        {(paiementWarning || (!infoComplet && infoStatut)) && (
          <p className="mt-1 text-[10px] font-medium text-red-600">
            {paiementWarning
              ? `⚠️ ${euros(paiementWarning.amount)} ${paiementWarning.devise}`
              : `⚠️ ${infoStatut}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-[#171717]">
          {cleanActivityTitle(r.nom_activite) || "Activité"}
          {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
        </p>
        {r.info_importante.trim() && (
          <span
            title={r.info_importante}
            className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
          >
            ⚠ {r.info_importante}
          </span>
        )}
        {acompteWarning && (
          <span className="text-xs font-medium text-yellow-700">
            ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
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
        {taxeTransfertManquante(r, hotelHorsHurghada) && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            ⚠ Taxe de transfert manquante
          </span>
        )}
        {r.avoir_utilise > 0 && (
          <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
            Avoir de {euros(r.avoir_utilise)} € utilisé
          </span>
        )}
        {paiementWarning && (
          <span className="text-xs font-medium text-red-600">
            ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {fmtDate(r.date_debut as string)}
        {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
      </p>
      {r.pickup_reel && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#0F5C56]">
          🚐 Pick-up {r.pickup_reel}
        </p>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenClient(client.id);
        }}
        className="text-sm font-medium text-[#171717] hover:underline"
      >
        {client.nom || "Sans nom"}
      </button>
      <p className="mt-1 text-xs text-neutral-500">{paxLine(r, client)}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-base font-semibold text-[#171717]">{euros(total)} €</span>
      </div>
      {infoComplet ? (
        <p className="mt-2 text-[10px] text-neutral-400">dossier complet ✔️</p>
      ) : (
        <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
          {infoStatut}
        </span>
      )}
    </div>
  );
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-[#171717]">{children}</span>
    </div>
  );
}
