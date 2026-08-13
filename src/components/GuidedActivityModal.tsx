"use client";

import { useState } from "react";
import { ActivitesStep, PaiementsStep } from "@/components/client-steps";
import {
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

type Step = "activites" | "paiements";

// Rouvre la même "petite fenêtre" que le pas-à-pas de création, mais pour
// un client déjà existant — pour qu'ajouter une activité (ou regarder les
// paiements) plus tard garde le même geste guidé, pas juste le long
// formulaire du dossier.
export default function GuidedActivityModal({
  open,
  onClose,
  client,
  onChange,
  reservations,
  resaOptions,
  resaTarifs,
  onAddReservation,
  onUpdateReservation,
  onDeleteReservation,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onAddTarif,
  onUpdateTarif,
  onDeleteTarif,
  catalogue,
  catalogueTarifs,
  transfertTarifs,
  catalogueOptions,
  canSeeMargins,
  hotelHorsHurghada,
  coutsMap,
  onUpdateCoutReel,
  onBusEscalation,
  busEscalations,
  onJourEscalation,
}: {
  open: boolean;
  onClose: () => void;
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onAddReservation: () => Promise<string | null>;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onDeleteReservation: (id: string) => void;
  onAddOption: (resaId: string, seed?: { nom: string; prix: number }) => void;
  onUpdateOption: (resaId: string, optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (resaId: string, optId: string) => void;
  onAddTarif: (resaId: string, seed?: { label: string; pu: number }) => void;
  onUpdateTarif: (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => void;
  onDeleteTarif: (resaId: string, tarifId: string) => void;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  transfertTarifs: Record<string, CatalogueTransfertTarif[]>;
  catalogueOptions: Record<string, CatalogueOption[]>;
  canSeeMargins: boolean;
  hotelHorsHurghada: boolean;
  coutsMap: Record<string, number>;
  onUpdateCoutReel: (id: string, value: number) => void;
  onBusEscalation: (nomActivite: string, reservationId: string) => Promise<void>;
  busEscalations: BusEscalation[];
  onJourEscalation: (
    nomActivite: string,
    reservationId: string,
    dateChoisie: string,
    jourChoisi: string,
    joursDisponibles: string[]
  ) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("activites");

  const close = () => {
    setStep("activites");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[6px] border border-[#eaeaea] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[#171717]">
              {step === "activites" ? "Ajouter une activité" : "Paiements"}
            </h2>
            <p className="mt-0.5 text-xs text-[#666666]">
              {step === "activites" ? "Activités" : "Paiements"} — étape{" "}
              {step === "activites" ? "1" : "2"}/2
            </p>
          </div>
          <button type="button" onClick={close} className="text-[#666666] hover:text-[#171717]">
            ✕
          </button>
        </div>

        <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-[#fafafa]">
          <div
            className="h-full rounded-full bg-[#C9973E] transition-all"
            style={{ width: step === "activites" ? "50%" : "100%" }}
          />
        </div>

        {step === "activites" && (
          <ActivitesStep
            client={client}
            onChange={onChange}
            reservations={reservations}
            resaOptions={resaOptions}
            resaTarifs={resaTarifs}
            onAddReservation={onAddReservation}
            onUpdateReservation={onUpdateReservation}
            onDeleteReservation={onDeleteReservation}
            onAddOption={onAddOption}
            onUpdateOption={onUpdateOption}
            onDeleteOption={onDeleteOption}
            onAddTarif={onAddTarif}
            onUpdateTarif={onUpdateTarif}
            onDeleteTarif={onDeleteTarif}
            catalogue={catalogue}
            catalogueTarifs={catalogueTarifs}
            transfertTarifs={transfertTarifs}
            catalogueOptions={catalogueOptions}
            canSeeMargins={canSeeMargins}
            hotelHorsHurghada={hotelHorsHurghada}
            coutsMap={coutsMap}
            onUpdateCoutReel={onUpdateCoutReel}
            onBusEscalation={onBusEscalation}
            busEscalations={busEscalations}
            onJourEscalation={onJourEscalation}
          />
        )}

        {step === "paiements" && (
          <PaiementsStep
            client={client}
            onChange={onChange}
            reservations={reservations}
            resaOptions={resaOptions}
            resaTarifs={resaTarifs}
            onUpdateReservation={onUpdateReservation}
          />
        )}

        <div className="mt-5 flex gap-2">
          {step === "paiements" && (
            <button
              type="button"
              onClick={() => setStep("activites")}
              className="rounded-[6px] border border-[#eaeaea] px-3 py-2 text-sm font-medium text-[#666666] hover:bg-[#fafafa]"
            >
              Précédent
            </button>
          )}
          {step === "activites" ? (
            <button
              type="button"
              onClick={() => setStep("paiements")}
              className="flex-1 rounded-[6px] bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Suivant — Paiements
            </button>
          ) : (
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-[6px] bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Terminé
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

