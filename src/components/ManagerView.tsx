"use client";

import {
  AssouanVerification,
  BusEscalation,
  CatalogueItem,
  Client,
  JourEscalation,
  Reservation,
} from "@/lib/types";
import { cleanActivityTitle, missingChampsFor } from "@/lib/resa";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "Date ?";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

type Autorisation = {
  id: string;
  created_at: string;
  icon: string;
  texte: string;
  clientId: string | null;
};

// Réservé à Sylvie et à la Direction — vue d'ensemble de tout ce qui
// attend une décision ou une action, éparpillé ailleurs dans l'app entre
// popups bloquantes (bus/jour/Assouan) et le tableau de bord (clients
// confirmés Kommo). Les demandes de modification de tarifs (catalogue/
// taxes de transfert) ne sont volontairement PAS reprises ici : elles
// concernent uniquement la Direction et restent dans l'onglet Direction.
// Ici c'est en lecture seule : les popups bloquantes restent le moyen de
// résoudre — cette page sert à voir d'un coup d'œil ce qui est en attente
// et pourquoi.
export default function ManagerView({
  clients,
  reservations,
  catalogue,
  onOpenClient,
  busEscalations,
  jourEscalations,
  assouanVerifications,
}: {
  clients: Client[];
  reservations: Reservation[];
  catalogue: CatalogueItem[];
  onOpenClient: (id: string) => void;
  busEscalations: BusEscalation[];
  jourEscalations: JourEscalation[];
  assouanVerifications: AssouanVerification[];
}) {
  const autorisations: Autorisation[] = [
    ...busEscalations.map((e) => ({
      id: e.id,
      created_at: e.created_at,
      icon: "🚌",
      texte: `${e.employe_nom} a indiqué que le client ${e.client_nom} ne souhaite pas la formule mini-bus pour ${e.nom_activite}.`,
      clientId: e.client_id,
    })),
    ...jourEscalations.map((e) => ({
      id: e.id,
      created_at: e.created_at,
      icon: "📅",
      texte: `${e.employe_nom} demande à confirmer ${e.nom_activite} le ${fmtDate(e.date_choisie)} (${e.jour_choisi}) pour ${e.client_nom}, alors que cette activité n'a normalement lieu que le ${e.jours_disponibles.join(", ")}.`,
      clientId: e.client_id,
    })),
    ...assouanVerifications.map((e) => ({
      id: e.id,
      created_at: e.created_at,
      icon: "🏨",
      texte: `${e.employe_nom} indique avoir informé ${e.client_nom} de vérifier la localisation de son hôtel à Assouan pour ${e.nom_activite}.`,
      clientId: e.client_id,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const clientsEnAttenteConfirmation = clients.filter((c) => c.confirmation_a_traiter);

  const activitesEnAttente = reservations
    .filter((r) => r.statut_resa === "Brouillon")
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Manager</h1>

      <div>
        <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
          Autorisations en attente
        </h2>
        {autorisations.length === 0 ? (
          <p className="text-sm text-neutral-400">Rien en attente.</p>
        ) : (
          <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
            {autorisations.map((a) => (
              <div
                key={a.id}
                onClick={a.clientId ? () => onOpenClient(a.clientId as string) : undefined}
                className={`px-4 py-3 ${a.clientId ? "cursor-pointer hover:bg-[#fafafa]" : ""}`}
              >
                <p className="text-sm text-[#171717]">
                  <span className="mr-1.5">{a.icon}</span>
                  {a.texte}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
          Clients confirmés en attente
        </h2>
        {clientsEnAttenteConfirmation.length === 0 ? (
          <p className="text-sm text-neutral-400">Rien en attente.</p>
        ) : (
          <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
            {clientsEnAttenteConfirmation.map((c) => (
              <div
                key={c.id}
                onClick={() => onOpenClient(c.id)}
                className="cursor-pointer px-4 py-3 hover:bg-[#fafafa]"
              >
                <p className="text-sm font-medium text-[#171717]">{c.nom || "Sans nom"}</p>
                <p className="text-xs text-[#666666]">
                  Confirmé automatiquement depuis Kommo — dossier à vérifier et compléter (hôtel, dates,
                  activités réelles).
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#0F5C56]">
                  {c.confirmation_assignee_a
                    ? `Renvoyé à ${c.confirmation_assignee_a}`
                    : "Pas encore pris en charge"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  <p className="mt-0.5 text-xs text-red-600">
                    {missing.length > 0
                      ? `Manque : ${missing.join(", ")}`
                      : "Pas encore validée par l'équipe"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
