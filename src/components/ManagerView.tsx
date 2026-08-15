"use client";

import { CatalogueItem, Client, Reservation } from "@/lib/types";
import { cleanActivityTitle, missingChampsFor } from "@/lib/resa";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "Date ?";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Réservé à Sylvie et à la Direction — pour l'instant uniquement les
// activités encore en Brouillon à valider, complétée au fil de l'eau selon
// ce dont Sylvie a besoin pour son suivi.
export default function ManagerView({
  clients,
  reservations,
  catalogue,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  catalogue: CatalogueItem[];
  onOpenClient: (id: string) => void;
}) {
  const activitesEnAttente = reservations
    .filter((r) => r.statut_resa === "Brouillon")
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Manager</h1>

      <div>
        <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
          Activités en attente de validation
        </h2>
        {activitesEnAttente.length === 0 ? (
          <p className="text-sm text-neutral-400">Rien en attente.</p>
        ) : (
          <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
            {activitesEnAttente.map((r) => {
              const c = clients.find((cl) => cl.id === r.client_id);
              const catalogueItem = catalogue.find((a) => a.id === r.catalogue_item_id);
              const missing = missingChampsFor(r, catalogueItem);
              return (
                <div
                  key={r.id}
                  onClick={() => onOpenClient(r.client_id)}
                  className="cursor-pointer px-4 py-3 hover:bg-[#fafafa]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#171717]">{c?.nom || "Sans nom"}</p>
                    <span className="whitespace-nowrap text-xs text-[#666666]">
                      {fmtDate(r.date_debut)}
                    </span>
                  </div>
                  <p className="text-xs text-[#666666]">{cleanActivityTitle(r.nom_activite) || "Activité"}</p>
                  {missing.length > 0 && (
                    <p className="mt-0.5 text-xs text-red-600">Manque : {missing.join(", ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
