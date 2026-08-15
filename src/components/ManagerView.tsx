"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AssouanVerification,
  BusEscalation,
  CatalogueItem,
  Client,
  JourEscalation,
  Profile,
  RemarqueEmployee,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import {
  activiteEnAttenteRaisons,
  cleanActivityTitle,
  isFamilySafariBedouin,
  resaTotalMontant,
} from "@/lib/resa";
import { todayStr } from "@/lib/dates";
import { PROSPECT_STATUTS } from "@/lib/constants";

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "Date ?";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function euros(n: number) {
  return n.toLocaleString("fr-FR");
}

// "Dernière activité" du rapport Manager > Gestion équipe — basé sur le
// heartbeat de présence posé par AppShell, pas sur une vraie dernière
// action précise.
function derniereActiviteLabel(iso: string | null) {
  if (!iso) return "Jamais connectée";
  const jours = daysSince(iso);
  if (jours <= 0) return "Aujourd'hui";
  if (jours === 1) return "Hier";
  return `Il y a ${jours} jours`;
}

// Même seuil que "Relances prospects" ailleurs dans l'app (Actions rapides
// du tableau de bord) : un prospect qui arrive bientôt se relance plus
// vite qu'un prospect dont le séjour est encore loin.
function joursAvantArrivee(dateStr: string) {
  return Math.round((Date.parse(dateStr) - Date.parse(todayStr())) / 86400000);
}
function estProspectStagnant(c: Client) {
  if (!PROSPECT_STATUTS.includes(c.statut)) return false;
  if (!c.date_debut || c.date_debut < todayStr()) return false;
  const avant = joursAvantArrivee(c.date_debut);
  const seuilRelance = avant <= 7 ? 2 : avant <= 30 ? 5 : 10;
  return daysSince(c.dernier_contact_date || c.created_at) >= seuilRelance;
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
// Doit rester synchronisé avec MANAGER_SUBS dans AppShell.tsx (même
// convention que PlanningSub/PlanningView : la liste des clés vit côté
// AppShell pour le sous-menu, redéclarée ici pour typer la prop).
type ManagerSub = "attente" | "equipe" | "suivi";

export default function ManagerView({
  sub,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  catalogue,
  onOpenClient,
  busEscalations,
  jourEscalations,
  assouanVerifications,
  profiles,
  currentUserId,
  remarquesEmploye,
  onRemarqueSent,
}: {
  sub: ManagerSub;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  catalogue: CatalogueItem[];
  onOpenClient: (id: string) => void;
  busEscalations: BusEscalation[];
  jourEscalations: JourEscalation[];
  assouanVerifications: AssouanVerification[];
  profiles: Profile[];
  currentUserId: string;
  remarquesEmploye: RemarqueEmployee[];
  onRemarqueSent: (remarque: RemarqueEmployee) => void;
}) {
  const supabase = createClient();
  const myProfile = profiles.find((p) => p.id === currentUserId);
  // Sylvie/Direction uniquement (déjà garanti par AppShell pour tout
  // ManagerView, mais on exclut la personne elle-même de la liste des
  // destinataires — pas de remarque à soi-même).
  const employeesEligibles = profiles.filter((p) => p.id !== currentUserId);
  const [remarqueEmployeId, setRemarqueEmployeId] = useState("");
  const [remarqueMessage, setRemarqueMessage] = useState("");
  const [sendingRemarque, setSendingRemarque] = useState(false);

  const envoyerRemarque = async () => {
    const cible = profiles.find((p) => p.id === remarqueEmployeId);
    const message = remarqueMessage.trim();
    if (!cible || !message) return;
    setSendingRemarque(true);
    const { data, error } = await supabase
      .from("remarques_employe")
      .insert({
        employe_id: cible.id,
        employe_nom: cible.prenom || cible.email,
        auteur_id: currentUserId,
        auteur_nom: myProfile?.prenom || "",
        message,
      })
      .select()
      .single();
    setSendingRemarque(false);
    if (!error && data) {
      onRemarqueSent(data as RemarqueEmployee);
      setRemarqueEmployeId("");
      setRemarqueMessage("");
    }
  };
  const autorisations: Autorisation[] = [
    // Même table pour deux cas distincts (voir AddActivityWizard.tsx) :
    // refus du mini-bus, ou insistance pour le Grand Safari Bédouin malgré
    // un groupe 100% adultes — distingués par le nom de l'activité.
    ...busEscalations.map((e) => ({
      id: e.id,
      created_at: e.created_at,
      icon: isFamilySafariBedouin(e.nom_activite) ? "🐪" : "🚌",
      texte: isFamilySafariBedouin(e.nom_activite)
        ? `${e.employe_nom} indique que le client ${e.client_nom} préfère quand même le ${e.nom_activite} malgré un groupe 100% adultes (formule pensée pour les familles).`
        : `${e.employe_nom} a indiqué que le client ${e.client_nom} ne souhaite pas la formule mini-bus pour ${e.nom_activite}.`,
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

  const doublonsNonTraites = clients.filter((c) => c.doublon_possible_id && !c.doublon_traite);

  const prospectsStagnants = clients
    .filter(estProspectStagnant)
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  // Comptage à partir de la mise en place de cree_par_id/cree_par_nom
  // (migration 0080) et de remarques_employe — pas de reprise rétroactive,
  // voir le commentaire sur ces colonnes dans types.ts.
  const rapportsParEmploye = employeesEligibles.map((p) => {
    const resasCreeesParElle = reservations.filter((r) => r.cree_par_id === p.id);
    // Annulées exclues : ça ne représente pas une vente réelle.
    const ventes = resasCreeesParElle.filter((r) => r.statut_resa !== "Annulée");
    const panierMoyen =
      ventes.length === 0
        ? null
        : Math.round(
            ventes.reduce((sum, r) => {
              const client = clients.find((c) => c.id === r.client_id);
              if (!client) return sum;
              return sum + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
            }, 0) / ventes.length
          );
    return {
      profile: p,
      resasCreees: resasCreeesParElle.length,
      remarquesRecues: remarquesEmploye.filter((r) => r.employe_id === p.id).length,
      panierMoyen,
      derniereActivite: p.derniere_activite_le,
    };
  });

  const remarquesRecentes = [...remarquesEmploye]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="font-heading text-[26px] font-semibold text-[#171717]">Manager</h1>

      {sub === "attente" && (
        <>
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
                      Confirmé automatiquement depuis Kommo — dossier à vérifier et compléter (hôtel,
                      dates, activités réelles).
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
                  const raisons = activiteEnAttenteRaisons(r, catalogueItem);
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
                      <p className="text-xs text-[#666666]">
                        {cleanActivityTitle(r.nom_activite) || "Activité"}
                      </p>
                      <p className="mt-0.5 text-xs text-red-600">
                        {raisons.length > 0
                          ? `Manque : ${raisons.join(", ")}`
                          : "Rien de manquant détecté — juste pas encore cliqué sur Valider"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        Ajoutée il y a {daysSince(r.created_at)} jour{daysSince(r.created_at) > 1 ? "s" : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {sub === "suivi" && (
        <>
          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
              Doublons clients non traités
            </h2>
            {doublonsNonTraites.length === 0 ? (
              <p className="text-sm text-neutral-400">Rien en attente.</p>
            ) : (
              <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
                {doublonsNonTraites.map((c) => {
                  const autre = clients.find((cl) => cl.id === c.doublon_possible_id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => onOpenClient(c.id)}
                      className="cursor-pointer px-4 py-3 hover:bg-[#fafafa]"
                    >
                      <p className="text-sm font-medium text-[#171717]">{c.nom || "Sans nom"}</p>
                      <p className="text-xs text-[#666666]">
                        Pourrait être le même client que{" "}
                        <span className="font-medium text-[#171717]">
                          {autre?.nom || "un autre dossier"}
                        </span>
                        .
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
              Prospects qui stagnent
            </h2>
            {prospectsStagnants.length === 0 ? (
              <p className="text-sm text-neutral-400">Rien en attente.</p>
            ) : (
              <div className="divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
                {prospectsStagnants.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onOpenClient(c.id)}
                    className="cursor-pointer px-4 py-3 hover:bg-[#fafafa]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#171717]">{c.nom || "Sans nom"}</p>
                      <span className="whitespace-nowrap text-xs text-[#666666]">
                        Arrivée {fmtDate(c.date_debut)}
                      </span>
                    </div>
                    <p className="text-xs text-[#666666]">{c.statut}</p>
                    <p className="mt-0.5 text-xs text-red-600">
                      Pas de contact depuis {daysSince(c.dernier_contact_date || c.created_at)} jour
                      {daysSince(c.dernier_contact_date || c.created_at) > 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {sub === "equipe" && (
        <>
          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
              Faire une remarque à une employée
            </h2>
            <p className="mb-3 text-xs text-[#666666]">
              Reste privé : seule l&apos;employée choisie verra ce message, à sa prochaine connexion.
            </p>
            <div className="rounded-[6px] border border-[#eaeaea] bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={remarqueEmployeId}
                  onChange={(e) => setRemarqueEmployeId(e.target.value)}
                  className="input sm:w-48"
                >
                  <option value="">Choisir une employée</option>
                  {employeesEligibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom || p.email}
                    </option>
                  ))}
                </select>
                <textarea
                  value={remarqueMessage}
                  onChange={(e) => setRemarqueMessage(e.target.value)}
                  placeholder="Ex. : Ces derniers jours vous avez envoyé plus de 10 flyers. Préférez un vocal et un vrai échange avec le client plutôt que de « balancer » des flyers."
                  rows={2}
                  className="input flex-1"
                />
              </div>
              <button
                type="button"
                disabled={!remarqueEmployeId || !remarqueMessage.trim() || sendingRemarque}
                onClick={envoyerRemarque}
                className="mt-2 rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Envoyer la remarque
              </button>
            </div>
            {remarquesRecentes.length > 0 && (
              <div className="mt-3 divide-y divide-[#eaeaea] overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
                {remarquesRecentes.map((r) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#171717]">{r.employe_nom}</p>
                      <span
                        className={`whitespace-nowrap text-xs ${r.lu ? "text-[#0F5C56]" : "text-[#666666]"}`}
                      >
                        {r.lu ? "Vue" : "Pas encore vue"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#666666]">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#171717]">
              Rapports par employée
            </h2>
            <p className="mb-3 text-xs text-[#666666]">
              Comptage à partir de maintenant seulement — l&apos;historique avant la mise en place de ce
              suivi n&apos;est pas repris.
            </p>
            <div className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eaeaea] text-xs text-[#666666]">
                    <th className="px-4 py-2 font-medium">Employée</th>
                    <th className="px-4 py-2 font-medium">Réservations créées</th>
                    <th className="px-4 py-2 font-medium">Panier moyen</th>
                    <th className="px-4 py-2 font-medium">Remarques reçues</th>
                    <th className="px-4 py-2 font-medium">Dernière activité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eaeaea]">
                  {rapportsParEmploye.map(({ profile, resasCreees, remarquesRecues, panierMoyen, derniereActivite }) => (
                    <tr key={profile.id}>
                      <td className="px-4 py-2 font-medium text-[#171717]">
                        {profile.prenom || profile.email}
                      </td>
                      <td className="px-4 py-2 text-[#171717]">{resasCreees}</td>
                      <td className="px-4 py-2 text-[#171717]">
                        {panierMoyen === null ? "—" : `${euros(panierMoyen)} €`}
                      </td>
                      <td className="px-4 py-2 text-[#171717]">{remarquesRecues}</td>
                      <td className="px-4 py-2 text-[#171717]">{derniereActiviteLabel(derniereActivite)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
