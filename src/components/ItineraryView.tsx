"use client";

import { useState } from "react";
import {
  AssouanVerification,
  BusEscalation,
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
  acompteWaitingWarning,
  activitePaiementWarning,
  chevalChameauBadge,
  cleanActivityTitle,
  formatOptionLabel,
  isDeuxiemeIleOption,
  momentBadge,
  pointureBadge,
  volBadge,
  paiementBadge,
  participantsFor,
  resaTotalMontant,
} from "@/lib/resa";
import ReservationCard from "@/components/ReservationCard";
import { localDateStr } from "@/lib/dates";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function toStr(d: Date) {
  return localDateStr(d);
}
function enumerateDays(start: string, end: string) {
  const days: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    days.push(toStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function paxLine(r: Reservation, client: Client) {
  if (r.pax_override) return r.pax_override;
  const { nbAd, nbEnf } = participantsFor(r, client);
  const showAges = r.participants_mode === "tous";
  const parts: string[] = [];
  let adLabel = `${nbAd} adulte${nbAd > 1 ? "s" : ""}`;
  if (showAges && client.ados_presents && client.ages_ados) {
    adLabel += ` (dont ados ${client.ages_ados})`;
  }
  parts.push(adLabel);
  if (nbEnf > 0) {
    let s = `${nbEnf} enfant${nbEnf > 1 ? "s" : ""}`;
    if (showAges && client.ages_enfants) s += ` (${client.ages_enfants} ans)`;
    parts.push(s);
  }
  if (showAges && client.bebes > 0) {
    let s = `${client.bebes} bébé${client.bebes > 1 ? "s" : ""}`;
    if (client.ages_bebes) s += ` (${client.ages_bebes} ans)`;
    parts.push(s);
  }
  return parts.join(", ");
}

export default function ItineraryView({
  client,
  reservations,
  resaOptions,
  resaTarifs,
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
  coutsMap,
  onUpdateCoutReel,
  busEscalations = [],
  onJourEscalation,
  onAssouanVerification,
  assouanVerifications = [],
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  expandedId: string | null;
  onToggleExpand: (id: string | null) => void;
  onSetPickup: (id: string, pickup: string) => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onDeleteReservation: (id: string) => void;
  onAddOption: (resaId: string, seed?: { nom: string; prix: number }) => void;
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
  coutsMap: Record<string, number>;
  onUpdateCoutReel: (id: string, value: number) => void;
  busEscalations?: BusEscalation[];
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
  const nbAnnulees = reservations.filter((r) => r.statut_resa === "Annulée").length;
  const reservationsAffichees = voirAnnulees
    ? reservations
    : reservations.filter((r) => r.statut_resa !== "Annulée");

  const renderCard = (r: Reservation, day?: string) => {
    if (expandedId === r.id) {
      return (
        <ReservationCard
          key={r.id}
          r={r}
          client={client}
          options={resaOptions[r.id] || []}
          tarifs={resaTarifs[r.id] || []}
          expanded
          onToggleExpanded={(v) => onToggleExpand(v ? r.id : null)}
          onUpdate={(patch) => onUpdateReservation(r.id, patch)}
          onDelete={() => onDeleteReservation(r.id)}
          onAddOption={(seed) => onAddOption(r.id, seed)}
          onUpdateOption={(optId, patch) => onUpdateOption(r.id, optId, patch)}
          onDeleteOption={(optId) => onDeleteOption(r.id, optId)}
          onAddTarif={(seed) => onAddTarif(r.id, seed)}
          onUpdateTarif={(tarifId, patch) => onUpdateTarif(r.id, tarifId, patch)}
          onDeleteTarif={(tarifId) => onDeleteTarif(r.id, tarifId)}
          onUpdateClient={onUpdateClient}
          catalogue={catalogue}
          catalogueTarifs={r.catalogue_item_id ? catalogueTarifs[r.catalogue_item_id] || [] : []}
          transfertTarifs={r.catalogue_item_id ? transfertTarifs[r.catalogue_item_id] || [] : []}
          catalogueOptions={r.catalogue_item_id ? catalogueOptions[r.catalogue_item_id] || [] : []}
          canSeeMargins={canSeeMargins}
          hotelHorsHurghada={hotelHorsHurghada}
          coutReel={coutsMap[r.id] || 0}
          onUpdateCoutReel={(v) => onUpdateCoutReel(r.id, v)}
          onJourEscalation={(dateChoisie, jourChoisi, joursDisponibles) =>
            onJourEscalation(r.nom_activite, r.id, dateChoisie, jourChoisi, joursDisponibles)
          }
          onAssouanVerification={() => onAssouanVerification(r.nom_activite, r.id)}
          assouanVerification={assouanVerifications.find((v) => v.reservation_id === r.id) || null}
        />
      );
    }

    const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
    const badge = paiementBadge(client, r);
    const paiementWarning = activitePaiementWarning(client, r, reservations, resaOptions, resaTarifs);
    const acompteWarning = acompteWaitingWarning(client, r, reservations);
    const busEscalation = busEscalations.find((e) => e.reservation_id === r.id);
    const assouanVerification = assouanVerifications.find((v) => v.reservation_id === r.id);
    return (
      <div
        key={r.id}
        onClick={() => onToggleExpand(r.id)}
        className="cursor-pointer rounded-md bg-[#fafafa]/50 px-3 py-2.5 text-sm hover:bg-[#fafafa]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-[#171717]">
            {cleanActivityTitle(r.nom_activite) || "Activité sans nom"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
          </span>
          {momentBadge(r) && (
            <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-[11px] font-medium text-[#8B4531]">
              {momentBadge(r)}
            </span>
          )}
          {volBadge(r) && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
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
          {(resaOptions[r.id] || [])
            .filter((o) => !isDeuxiemeIleOption(o.nom))
            .map((o) => (
              <span
                key={o.id}
                className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-[11px] font-medium text-white"
              >
                ⚙ {formatOptionLabel(o)}
              </span>
            ))}
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
          <span>{day ? fmtDate(day) : "Date à définir"}</span>
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
          <span className="font-amounts text-xs font-medium text-[#171717]">{euros(total)} €</span>
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
  const daySet = new Set<string>();
  reservationsAffichees.forEach((r) => {
    if (!r.date_debut) return;
    enumerateDays(r.date_debut, r.date_fin || r.date_debut).forEach((d) => daySet.add(d));
  });
  const days = Array.from(daySet).sort();

  if (dateless.length === 0 && days.length === 0 && nbAnnulees === 0) {
    return <div className="text-sm text-neutral-400">Aucune activité planifiée pour l&apos;instant.</div>;
  }

  return (
    <div className="space-y-4">
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
        <div className="rounded-md border border-[#666666]/15 bg-white p-4">
          <div className="mb-2">
            <span className="font-heading text-sm font-semibold text-[#171717]">
              Activités sans date
            </span>
          </div>
          <div className="space-y-2">{dateless.map((r) => renderCard(r))}</div>
        </div>
      )}

      {days.map((day) => {
        const dayResas = reservationsAffichees.filter((r) => {
          if (!r.date_debut) return false;
          const end = r.date_fin || r.date_debut;
          return day >= r.date_debut && day <= end;
        });

        return (
          <div key={day} className="rounded-md border border-[#666666]/15 bg-white p-4">
            <div className="mb-2">
              <span className="font-heading text-sm font-semibold capitalize text-[#171717]">
                {fmtDate(day)}
              </span>
            </div>
            <div className="space-y-2">{dayResas.map((r) => renderCard(r, day))}</div>
          </div>
        );
      })}
    </div>
  );
}
