"use client";

import { Client, PaiementEtape, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { paiementBadge, reservationsActives } from "@/lib/resa";
import { euros } from "@/lib/contactStepFormat";

// Étape de confirmation partagée, à afficher avant tout changement qui
// marque le solde (ou une reprise) "payé" — un seul solde par client, donc
// ce genre d'action change le badge de TOUTES les activités du dossier d'un
// coup, jamais une seule. Sans cette étape, un simple clic changeait tout en
// silence et pouvait effacer une reprise encore due sur une autre activité
// (vécu sur Carine LELOIR, demande de Mélanie le 14/09 : "le crm ne doit
// jamais changer un badge de paiement sans demander l'accord via un pop up").
export default function SoldePayeConfirmModal({
  client,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes,
  newLabel,
  title,
  onConfirm,
  onCancel,
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes: PaiementEtape[];
  newLabel: string;
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const activites = reservationsActives(reservations);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
        <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
          {title || `Confirmer "${newLabel}"`}
        </h2>
        <p className="mb-3 text-sm text-neutral-600">
          Ce changement s&apos;applique au séjour entier (un seul solde par client) — voici ce qui va
          changer pour chaque activité :
        </p>
        <div className="mb-3 flex flex-col gap-1.5 rounded-md border border-neutral-200 p-2">
          {activites.map((r) => {
            const avant = paiementBadge(client, r, reservations, resaOptions, resaTarifs, paiementsEtapes) || {
              label: "En attente",
              className: "bg-yellow-100 text-yellow-700",
            };
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[#171717]">{r.nom_activite}</span>
                <span className="flex items-center gap-1 whitespace-nowrap text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${avant.className}`}>{avant.label}</span>
                  <span className="text-neutral-400">→</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                    {newLabel}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        {Number(client.reprise_montant) > 0 && (
          <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            ⚠️ Un règlement de {euros(client.reprise_montant)} € ({client.reprise_mode || "mode non précisé"}) est
            encore en attente sur ce dossier — en validant, il sera considéré comme réglé et disparaîtra du résumé
            des paiements.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
