"use client";

import { useEffect, useState } from "react";
import {
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  Pack,
  Remboursement,
  Reservation,
} from "@/lib/types";
import { checklistVisibleFor, DossierChecklistCategorie } from "@/lib/dossierChecklistGenerale";
import { createClient } from "@/lib/supabase/client";
import ClientDetail from "@/components/ClientDetail";

// Une catégorie de la checklist générale pointe vers la section de la
// fiche la plus utile pour la vérifier — cocher un item y saute
// directement plutôt que de laisser rouvrir toute la fiche au hasard.
function sectionPour(categorie: DossierChecklistCategorie): "Activités" | "Suivi" | "Paiements" | undefined {
  if (categorie === "Paiements") return "Paiements";
  if (categorie === "Activités" || categorie === "Info manquantes") return "Activités";
  if (categorie === "Suivi") return "Suivi";
  return undefined;
}

const CATEGORIES_ORDRE: DossierChecklistCategorie[] = [
  "Contact",
  "Séjour",
  "Activités",
  "Info manquantes",
  "Paiements",
  "Documents",
  "Suivi",
];

// Panneau large ouvert par-dessus Suivis > Vérification de dossier : une
// vraie checklist générale à cocher à gauche (fixe, la même pour tous les
// dossiers — pas des points détectés par le CRM, demande explicite de
// Mélanie, 2026-10-16) et la vraie fiche client à droite, pour cocher les
// points en regardant les données réelles, sans quitter l'écran de
// vérification.
export default function VerifDossierDrawer({
  client,
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
  reservations,
  remboursements,
}: {
  client: Client;
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
  // Pour les items de checklist sous condition (ex. pointure seulement si
  // Tortues à Marsa Alam dans les activités de CE client) — demande de
  // Mélanie, 2026-10-29.
  reservations: Reservation[];
  remboursements: Remboursement[];
}) {
  const supabase = createClient();
  const [autoOpenSection, setAutoOpenSection] = useState<"Activités" | "Suivi" | "Paiements" | undefined>(
    undefined
  );
  // clientId de côté pour savoir si "coches" correspond bien au client
  // affiché (évite un setState synchrone au tout début de l'effet — on ne
  // met à jour l'état qu'une fois la requête revenue).
  const [checklistState, setChecklistState] = useState<{ clientId: string; coches: Set<string> } | null>(null);
  const loaded = checklistState?.clientId === client.id;
  const coches = loaded ? checklistState!.coches : new Set<string>();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("dossier_checklist_coches")
      .select("item_code")
      .eq("client_id", client.id)
      .then(({ data }) => {
        if (cancelled) return;
        setChecklistState({ clientId: client.id, coches: new Set((data || []).map((r) => r.item_code)) });
      });
    return () => {
      cancelled = true;
    };
  }, [client.id, supabase]);

  const toggle = async (itemCode: string, categorie: DossierChecklistCategorie) => {
    const dejaCoche = coches.has(itemCode);
    setChecklistState((prev) => {
      const next = new Set(prev?.coches || []);
      if (dejaCoche) next.delete(itemCode);
      else next.add(itemCode);
      return { clientId: client.id, coches: next };
    });
    if (dejaCoche) {
      await supabase.from("dossier_checklist_coches").delete().eq("client_id", client.id).eq("item_code", itemCode);
    } else {
      setAutoOpenSection(sectionPour(categorie));
      const { data: session } = await supabase.auth.getSession();
      await supabase.from("dossier_checklist_coches").upsert(
        {
          client_id: client.id,
          item_code: itemCode,
          coche_par_nom: monPrenom,
          coche_par_id: session?.session?.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,item_code" }
      );
    }
  };

  // Items sous condition (ex. "Pointure si Tortues") retirés s'ils ne
  // concernent pas ce dossier précis, à partir de SES réservations/
  // remboursements.
  const clientReservations = reservations.filter((r) => r.client_id === client.id);
  const clientRemboursements = remboursements.filter((r) => r.client_id === client.id);
  const checklistVisible = checklistVisibleFor({
    reservations: clientReservations,
    catalogue,
    remboursements: clientRemboursements,
    client,
  });

  const nbCoches = coches.size;
  const nbTotal = checklistVisible.length;
  // Tant qu'il manque une case, signer effacerait du travail déjà fait pour
  // rien (ex. il ne manque que la pointure, en attente de réponse du
  // client) — la signature ne doit être possible qu'une fois tout coché,
  // sinon ce qui est déjà vérifié doit rester tel quel pour la prochaine
  // fois (demande de Mélanie, 2026-10-29).
  const complet = loaded && nbTotal > 0 && nbCoches === nbTotal;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/30">
      <div className="ml-auto flex h-full w-full max-w-6xl bg-white shadow-xl">
        <div className="flex w-80 flex-shrink-0 flex-col border-r border-[#eaeaea] bg-[#fafafa] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-heading text-sm font-semibold text-[#171717]">
              À vérifier ({nbCoches}/{nbTotal})
            </p>
            <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
            {CATEGORIES_ORDRE.map((categorie) => {
              const items = checklistVisible.filter((it) => it.categorie === categorie);
              if (items.length === 0) return null;
              return (
                <div key={categorie}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    {categorie}
                  </p>
                  <div className="space-y-1">
                    {items.map((it) => {
                      const coche = coches.has(it.code);
                      return (
                        <label
                          key={it.code}
                          className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-1.5 text-xs text-[#171717] hover:border-neutral-200 hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={coche}
                            disabled={!loaded}
                            onChange={() => toggle(it.code, it.categorie)}
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[#171717]"
                          />
                          <span className={coche ? "text-neutral-400 line-through" : ""}>{it.texte}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!complet}
            onClick={() => {
              // onValider (SuivisView.validerVerification) efface déjà les
              // cases cochées en même temps que la signature — pas la peine
              // de le refaire ici.
              if (complet) onValider(client);
            }}
            className={
              complet
                ? "mt-3 rounded-full bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                : "mt-3 cursor-not-allowed rounded-full bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-400"
            }
          >
            {complet
              ? `Vérifié — signer ${monPrenom}`
              : `Il reste ${nbTotal - nbCoches} case${nbTotal - nbCoches > 1 ? "s" : ""} à cocher`}
          </button>
          {!complet && (
            <p className="mt-1.5 text-[11px] text-neutral-400">
              Ce qui est déjà coché reste enregistré — ferme (✕) et reviens plus tard, rien n&apos;est perdu.
            </p>
          )}
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
