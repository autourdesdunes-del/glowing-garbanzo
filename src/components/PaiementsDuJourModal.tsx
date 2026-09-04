"use client";

import { useState } from "react";
import {
  Client,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";
import { todayStr } from "@/lib/dates";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Même calcul que soldeRestantFor (SuivisView) : total du séjour moins
// l'acompte déjà encaissé et les règlements intermédiaires — c'est aussi le
// montant du solde une fois qu'il est marqué payé (rien dans ce calcul ne
// dépend de solde_paye), donc réutilisable pour l'afficher avant ET après.
function soldeDe(
  c: Client,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  paiementsEtapes: PaiementEtape[]
) {
  const acomptePaye =
    c.paiement_type === "acompte" && c.acompte_paye ? Number(c.acompte_montant) || 0 : 0;
  const totalSejour = reservations
    .filter((r) => r.client_id === c.id && r.statut_resa !== "Annulée")
    .reduce((sum, r) => sum + resaTotalMontant(r, c, resaOptions[r.id] || [], resaTarifs[r.id] || []), 0);
  const etapesSum = paiementsEtapes
    .filter((e) => e.client_id === c.id)
    .reduce((s, e) => s + (Number(e.montant) || 0), 0);
  return Math.max(totalSejour - acomptePaye - etapesSum, 0);
}

type Ligne = {
  client: Client;
  libelle: string;
  montant: number;
  paye: boolean;
  // Marquer payé demande la date réelle du paiement (pas toujours
  // aujourd'hui — on rattrape parfois un règlement d'un jour précédent) ;
  // annuler n'a pas besoin de date.
  onMarquerPaye: (date: string) => void;
  onAnnulerPaye: () => void;
};

export function computePaiementsDuJour(
  clients: Client[],
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  paiementsEtapes: PaiementEtape[],
  todayStr: string,
  onUpdateClient: (id: string, patch: Partial<Client>) => void
) {
  const encaisses: Ligne[] = [];
  const aPayer: Ligne[] = [];

  for (const c of clients) {
    if (c.statut !== "Client confirmé") continue;

    // Solde
    const activiteLiee = c.solde_activite_id
      ? reservations.find((r) => r.id === c.solde_activite_id) || null
      : null;
    const soldeConcerneAujourdhui = c.solde_activite_id
      ? activiteLiee?.statut_resa !== "Annulée" && activiteLiee?.date_debut === todayStr
      : c.solde_date === todayStr;
    if (soldeConcerneAujourdhui && (c.solde_activite_id || c.solde_rdv_heure || c.solde_rdv_lieu)) {
      const montant = soldeDe(c, reservations, resaOptions, resaTarifs, paiementsEtapes);
      const ligne: Ligne = {
        client: c,
        libelle: c.solde_activite_id
          ? `Solde à l'activité — ${activiteLiee?.nom_activite || "activité"}`
          : "RDV solde",
        montant,
        paye: !!c.solde_paye,
        onMarquerPaye: (date) => onUpdateClient(c.id, { solde_paye: true, solde_date: date }),
        onAnnulerPaye: () => onUpdateClient(c.id, { solde_paye: false, solde_date: null }),
      };
      (c.solde_paye ? encaisses : aPayer).push(ligne);
    }
    // Volontairement pas d'acompte ici (PayPal ou autre) — cette popup ne
    // couvre que le solde : RDV paiement et solde réglé à une activité.
  }

  return { encaisses, aPayer };
}

export default function PaiementsDuJourModal({
  encaisses,
  aPayer,
  onOpenClient,
  onClose,
}: {
  encaisses: Ligne[];
  aPayer: Ligne[];
  onOpenClient: (id: string) => void;
  onClose: () => void;
}) {
  const [dateModal, setDateModal] = useState<{ ligne: Ligne; date: string } | null>(null);

  const Row = ({ ligne }: { ligne: Ligne }) => (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <button
          onClick={() => onOpenClient(ligne.client.id)}
          className="text-sm font-medium text-[#171717] hover:underline"
        >
          {ligne.client.nom || "Sans nom"}
        </button>
        <p className="text-xs text-neutral-500">{ligne.libelle}</p>
      </div>
      <span className="font-amounts flex-shrink-0 text-sm text-[#171717]">{euros(ligne.montant)} €</span>
      <button
        onClick={() =>
          ligne.paye ? ligne.onAnnulerPaye() : setDateModal({ ligne, date: todayStr() })
        }
        className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${
          ligne.paye
            ? "border-neutral-300 text-neutral-600 hover:border-red-400 hover:text-red-600"
            : "border-[#171717] bg-[#171717] text-white hover:opacity-90"
        }`}
      >
        {ligne.paye ? "Marquer non payé" : "Marquer payé"}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[6px] border border-[#eaeaea] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-[#171717]">Paiements du jour</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            ✕
          </button>
        </div>

        <h4 className="mb-2 text-sm font-semibold text-neutral-700">
          À payer aujourd&apos;hui {aPayer.length > 0 && `(${aPayer.length})`}
        </h4>
        {aPayer.length === 0 ? (
          <p className="mb-4 text-sm text-neutral-400">Rien en attente.</p>
        ) : (
          <div className="mb-4">
            {aPayer.map((l, i) => (
              <Row key={`${l.client.id}-${l.libelle}-${i}`} ligne={l} />
            ))}
          </div>
        )}

        <h4 className="mb-2 text-sm font-semibold text-neutral-700">
          Encaissés aujourd&apos;hui {encaisses.length > 0 && `(${encaisses.length})`}
        </h4>
        {encaisses.length === 0 ? (
          <p className="text-sm text-neutral-400">Rien de nouveau.</p>
        ) : (
          <div>
            {encaisses.map((l, i) => (
              <Row key={`${l.client.id}-${l.libelle}-${i}`} ligne={l} />
            ))}
          </div>
        )}
      </div>

      {dateModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h3 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Quand le client a-t-il payé ?
            </h3>
            <p className="mb-4 text-sm text-neutral-600">
              Renseigne la date où l&apos;argent a réellement été remis — pas forcément
              aujourd&apos;hui si tu rattrapes un paiement déjà reçu.
            </p>
            <input
              type="date"
              value={dateModal.date}
              onChange={(e) => setDateModal({ ...dateModal, date: e.target.value })}
              className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  dateModal.ligne.onMarquerPaye(dateModal.date || todayStr());
                  setDateModal(null);
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Valider
              </button>
              <button
                onClick={() => setDateModal(null)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
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
