"use client";

import {
  Client,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { resaTotalMontant } from "@/lib/resa";

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
  onTogglePaye: () => void;
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
  const premiereActiviteDe = (clientId: string) =>
    [...reservations]
      .filter((r) => r.client_id === clientId && r.statut_resa !== "Annulée" && r.date_debut)
      .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""))[0] || null;

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
        onTogglePaye: () =>
          onUpdateClient(c.id, c.solde_paye ? { solde_paye: false, solde_date: null } : { solde_paye: true, solde_date: todayStr }),
      };
      (c.solde_paye ? encaisses : aPayer).push(ligne);
    }

    // Acompte — deux motifs bien distincts pour ne pas les confondre :
    // "à payer" se base sur la date de début du séjour (l'acompte doit être
    // réglé avant que ça commence), "encaissé" se base sur la date réelle
    // d'encaissement (acompte_date_encaissement) — jamais l'inverse, sinon
    // un acompte payé il y a 3 jours ressort comme "encaissé aujourd'hui"
    // simplement parce que le séjour démarre aujourd'hui.
    const premiereActivite = premiereActiviteDe(c.id);
    const acompteAPayerAujourdhui =
      c.paiement_type === "acompte" &&
      c.acompte_valide &&
      !c.acompte_paye &&
      premiereActivite?.date_debut === todayStr;
    const acompteEncaisseAujourdhui = c.acompte_paye && c.acompte_date_encaissement === todayStr;
    if (acompteAPayerAujourdhui || acompteEncaisseAujourdhui) {
      const ligne: Ligne = {
        client: c,
        libelle: "Acompte",
        montant: Number(c.acompte_montant) || 0,
        paye: !!c.acompte_paye,
        onTogglePaye: () =>
          onUpdateClient(
            c.id,
            c.acompte_paye
              ? { acompte_paye: false, acompte_date_encaissement: null }
              : { acompte_paye: true, acompte_date_encaissement: todayStr }
          ),
      };
      (c.acompte_paye ? encaisses : aPayer).push(ligne);
    }
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
        onClick={ligne.onTogglePaye}
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
    </div>
  );
}
