"use client";

import { useState } from "react";
import {
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  Pack,
} from "@/lib/types";
import { DossierCheckItem } from "@/lib/dossierChecklist";
import ClientDetail from "@/components/ClientDetail";

// Une rubrique de la checklist pointe vers la section de la fiche la plus
// utile pour la vérifier — cliquer dessus y saute directement plutôt que de
// laisser rouvrir toute la fiche au hasard.
function sectionPour(categorie: DossierCheckItem["categorie"]): "Activités" | "Suivi" | "Paiements" | undefined {
  if (categorie === "Paiement") return "Paiements";
  if (categorie === "Programme" || categorie === "Documents") return "Activités";
  if (categorie === "Remboursement") return "Suivi";
  return undefined;
}

const CATEGORIE_STYLE: Record<string, string> = {
  Paiement: "border-blue-100 bg-blue-50 text-blue-800",
  Programme: "border-amber-100 bg-amber-50 text-amber-800",
  Documents: "border-purple-100 bg-purple-50 text-purple-800",
  Remboursement: "border-teal-100 bg-teal-50 text-teal-800",
  Doublon: "border-pink-100 bg-pink-50 text-pink-800",
};

// Panneau large ouvert par-dessus Suivis > Vérification de dossier : la
// checklist à gauche, la vraie fiche client à droite — pour cocher les
// points en regardant les données réelles, sans quitter l'écran de
// vérification (demande de Mélanie, 2026-10-16).
export default function VerifDossierDrawer({
  client,
  points,
  monPrenom,
  onValider,
  onClose,
  onJumpToClient,
  allClients,
  onChangeClient,
  onDeleteClient,
  onDuplicateAsNewStay,
  canSeeMargins,
  catalogue,
  catalogueTarifs,
  transfertTarifs,
  catalogueOptions,
  packs,
  onOpenHelp,
}: {
  client: Client;
  points: DossierCheckItem[];
  monPrenom: string;
  onValider: (c: Client) => void;
  onClose: () => void;
  onJumpToClient: (id: string) => void;
  allClients: Client[];
  onChangeClient: (id: string, patch: Partial<Client>) => void;
  onDeleteClient: (id: string) => Promise<boolean> | void;
  onDuplicateAsNewStay: (source: Client) => void;
  canSeeMargins: boolean;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  transfertTarifs: Record<string, CatalogueTransfertTarif[]>;
  catalogueOptions: Record<string, CatalogueOption[]>;
  packs: Pack[];
  onOpenHelp: () => void;
}) {
  const [autoOpenSection, setAutoOpenSection] = useState<"Activités" | "Suivi" | "Paiements" | undefined>(
    undefined
  );

  return (
    <div className="fixed inset-0 z-50 flex bg-black/30">
      <div className="ml-auto flex h-full w-full max-w-6xl bg-white shadow-xl">
        <div className="flex w-80 flex-shrink-0 flex-col border-r border-[#eaeaea] bg-[#fafafa] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-heading text-sm font-semibold text-[#171717]">À vérifier</p>
            <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {points.length === 0 && <p className="text-xs text-neutral-400">Aucune erreur détectée.</p>}
            {points.map((p, i) => (
              <button
                key={`${p.code}_${i}`}
                type="button"
                onClick={() => setAutoOpenSection(sectionPour(p.categorie))}
                className={`block w-full rounded-md border p-2 text-left text-xs hover:brightness-95 ${CATEGORIE_STYLE[p.categorie]}`}
              >
                <span className="mr-1 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {p.categorie}
                </span>
                {p.message}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onValider(client)}
            className="mt-3 rounded-full bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Vérifié — signer {monPrenom}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <ClientDetail
            key={client.id}
            client={client}
            allClients={allClients}
            onChange={(patch) => onChangeClient(client.id, patch)}
            onDelete={() => {
              onDeleteClient(client.id);
              onClose();
            }}
            onJumpToClient={onJumpToClient}
            onDuplicateAsNewStay={onDuplicateAsNewStay}
            onDeleteClientById={onDeleteClient}
            canSeeMargins={canSeeMargins}
            catalogue={catalogue}
            catalogueTarifs={catalogueTarifs}
            transfertTarifs={transfertTarifs}
            catalogueOptions={catalogueOptions}
            packs={packs}
            onOpenHelp={onOpenHelp}
            autoOpenSection={autoOpenSection}
            onAutoOpenSectionHandled={() => setAutoOpenSection(undefined)}
          />
        </div>
      </div>
    </div>
  );
}
