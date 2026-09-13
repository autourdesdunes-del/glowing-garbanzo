"use client";

import { useState } from "react";
import {
  Client,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { avoirUtiliseTotal, reservationsActives, resaTotalMontant, soldeInclutAcompteImpaye } from "@/lib/resa";
import { todayStr } from "@/lib/dates";
import { useConfirm } from "@/components/ConfirmProvider";
import { MODES_PAIEMENT } from "@/lib/constants";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Prénom seul (premier mot du nom complet) — utilisé pour le message Bodé,
// qui doit rester court et direct.
function prenom(nomComplet: string) {
  return (nomComplet || "").trim().split(/\s+/)[0] || "Client";
}

// Premier mot du libellé d'activité (une fois le préfixe interne "Solde à
// l'activité — "/"Reprise à l'activité — " retiré) : le catalogue nomme la
// plupart des activités par leur mot-clé en premier ("Speedboat privé...",
// "Buggy Sunset", "Parachute ascensionnel"...), ce qui suffit à identifier
// l'activité dans un message Bodé sans le recopier en entier. Le message
// reste à copier/coller, donc ajustable à la main si ce raccourci tombe mal.
function activiteMot(libelle: string) {
  const nom = libelle
    .replace(/^Solde à l'activité — /, "")
    .replace(/^Reprise à l'activité — /, "")
    .replace(/^RDV solde$/, "RDV");
  return nom.trim().split(/\s+/)[0] || "";
}

// Montant à afficher dans la devise réellement prévue pour l'encaissement —
// pas toujours des euros. Un solde réglé "à la première activité en EGP"
// (ou en mixte €+EGP) a son montant EGP déjà calculé au taux du jour dans
// egp_montant/solde_mixte_egp (voir PaiementResteFlow) : avant ce
// correctif, "Paiements du jour" affichait toujours l'équivalent en euros
// avec un "€" figé, ce qui ne dit rien du montant EGP réellement à
// récupérer sur place.
function montantAffiche(ligne: Ligne) {
  const c = ligne.client;
  if (c.solde_mode === "Espèces EGP" && c.egp_montant > 0) {
    return `${c.egp_montant.toLocaleString("fr-FR")} EGP`;
  }
  if (c.solde_mode === "Modes différents" && c.solde_mixte_egp > 0) {
    return `${euros(c.solde_mixte_eur)} € + ${c.solde_mixte_egp.toLocaleString("fr-FR")} EGP`;
  }
  return `${euros(ligne.montant)} €`;
}

// Message type envoyé à Bodé (équipe Égypte, en anglais — voir
// feedback_anglais_voulu_equipe_egypte) pour lui faire confirmer les
// paiements du jour un par un plutôt que de les lui décrire un par un à la
// main. Même format de montant que montantAffiche, condensé sans espace
// avant "€" (ex. "180€") et avec "egp" en minuscules (ex. "3600 egp"),
// repris tel quel de l'exemple donné par Mélanie le 13/09.
export function bodePaiementsMessage(aPayer: Ligne[]) {
  const lignes = aPayer.map((l) => {
    const montant = montantAffiche(l).replace(/ €$/, "€").replace(/ EGP$/, " egp").replace(" € + ", "€ + ");
    return `- ${prenom(l.client.nom)} ${activiteMot(l.libelle)} ${montant}`.trim();
  });
  return `Can you confirm payments of the day ?\n${lignes.join("\n")}`;
}

// Même calcul que soldeRestantFor (SuivisView) : total du séjour moins
// l'acompte déjà encaissé, les règlements intermédiaires et les avoirs
// consommés — c'est aussi le montant du solde une fois qu'il est marqué payé
// (rien dans ce calcul ne dépend de solde_paye), donc réutilisable pour
// l'afficher avant ET après.
function totalSejourDe(
  c: Client,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>
) {
  return reservationsActives(reservations.filter((r) => r.client_id === c.id)).reduce(
    (sum, r) => sum + resaTotalMontant(r, c, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
}

function soldeDe(
  c: Client,
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  paiementsEtapes: PaiementEtape[]
) {
  const acomptePaye = c.acompte_paye ? Number(c.acompte_montant) || 0 : 0;
  const totalSejour = totalSejourDe(c, reservations, resaOptions, resaTarifs);
  const avoirUtilise = avoirUtiliseTotal(
    reservationsActives(reservations.filter((r) => r.client_id === c.id))
  );
  const etapesSum = paiementsEtapes
    .filter((e) => e.client_id === c.id)
    .reduce((s, e) => s + (Number(e.montant) || 0), 0);
  return Math.max(totalSejour - acomptePaye - etapesSum - avoirUtilise, 0);
}

// Proposé quand la ligne est un solde rattaché à une activité précise
// (c.solde_activite_id) et qu'une prochaine activité existe pour y
// reporter le reste — permet de ne régler que l'activité du jour sans
// obliger à tout encaisser d'un coup.
type ReporterReste = {
  activiteNom: string;
  montantDefaut: number;
  candidats: { id: string; nom: string; date: string }[];
};

type Ligne = {
  client: Client;
  libelle: string;
  montant: number;
  paye: boolean;
  // Marquer payé demande la date réelle du paiement (pas toujours
  // aujourd'hui — on rattrape parfois un règlement d'un jour précédent) ;
  // annuler n'a pas besoin de date. Le mode est optionnel : demandé
  // uniquement pour un solde (voir dateModal), ignoré par la reprise qui a
  // déjà le sien.
  onMarquerPaye: (date: string, mode?: string) => void;
  onAnnulerPaye: () => void;
  reporterReste?: ReporterReste | null;
  onReporterReste?: (p: { montant: number; montantEgp: number; mode: string; date: string; prochaineActiviteId: string }) => void;
};

export function computePaiementsDuJour(
  clients: Client[],
  reservations: Reservation[],
  resaOptions: Record<string, ReservationOption[]>,
  resaTarifs: Record<string, ReservationTarif[]>,
  paiementsEtapes: PaiementEtape[],
  todayStr: string,
  onUpdateClient: (id: string, patch: Partial<Client>) => void,
  onMarquerRepriseReglee: (clientId: string, date: string) => void,
  onReporterReste: (
    clientId: string,
    p: { montant: number; montantEgp: number; mode: string; date: string; activiteNom: string; prochaineActiviteId: string }
  ) => void
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

      // Reporter le reste : seulement possible pour un solde rattaché à une
      // activité précise (pas un RDV), et seulement s'il existe une future
      // activité active à qui rattacher ce qui reste dû.
      let reporterReste: ReporterReste | null = null;
      if (activiteLiee) {
        const candidats = reservationsActives(reservations.filter((r) => r.client_id === c.id))
          .filter((r) => r.id !== activiteLiee.id && r.date_debut && r.date_debut > todayStr)
          .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));
        if (candidats.length > 0) {
          reporterReste = {
            activiteNom: activiteLiee.nom_activite || "activité",
            montantDefaut: resaTotalMontant(activiteLiee, c, resaOptions[activiteLiee.id] || [], resaTarifs[activiteLiee.id] || []),
            candidats: candidats.map((r) => ({ id: r.id, nom: r.nom_activite || "Activité sans nom", date: r.date_debut || "" })),
          };
        }
      }

      const ligne: Ligne = {
        client: c,
        libelle: c.solde_activite_id
          ? `Solde à l'activité — ${activiteLiee?.nom_activite || "activité"}`
          : "RDV solde",
        montant,
        paye: !!c.solde_paye,
        onMarquerPaye: (date, mode) =>
          onUpdateClient(c.id, {
            solde_paye: true,
            solde_date: date,
            ...(mode ? { solde_mode: mode } : null),
            // Figer le total séjour au moment du règlement — sinon une
            // activité ajoutée plus tard peut se retrouver absorbée en
            // silence dans un "Payé" qui ne l'a jamais couverte (voir
            // paiementProgress dans resa.ts).
            solde_montant: totalSejourDe(c, reservations, resaOptions, resaTarifs),
          }),
        onAnnulerPaye: () => onUpdateClient(c.id, { solde_paye: false, solde_date: null }),
        reporterReste,
        onReporterReste: reporterReste
          ? (p) => onReporterReste(c.id, { ...p, activiteNom: reporterReste!.activiteNom })
          : undefined,
      };
      (c.solde_paye ? encaisses : aPayer).push(ligne);
    }

    // Reprise (nouvelle activité ajoutée après un solde déjà clôturé) —
    // même principe que la branche Solde ci-dessus, mais manquait
    // entièrement : une reprise à encaisser aujourd'hui même, à une
    // activité précise, était invisible ici (l'équipe pouvait simplement
    // oublier de la réclamer). Contrairement au solde, une reprise réglée
    // à distance (PayPal/Virement) n'a pas de date propre (pas de
    // "reprise_date") — seul le cas "réglée à une activité précise,
    // aujourd'hui" est détectable ici.
    const activiteRepriseLiee = c.reprise_activite_id
      ? reservations.find((r) => r.id === c.reprise_activite_id) || null
      : null;
    if (
      Number(c.reprise_montant) > 0 &&
      activiteRepriseLiee &&
      activiteRepriseLiee.statut_resa !== "Annulée" &&
      activiteRepriseLiee.date_debut === todayStr
    ) {
      aPayer.push({
        client: c,
        libelle: `Reprise à l'activité — ${activiteRepriseLiee.nom_activite || "activité"}`,
        montant: Number(c.reprise_montant) || 0,
        paye: false,
        onMarquerPaye: (date) => onMarquerRepriseReglee(c.id, date),
        // Pas de "marquer non payé" symétrique ici : contrairement au
        // solde (simple flag solde_paye), régler une reprise insère une
        // vraie étape de paiement — l'annuler doit passer par le bandeau
        // dédié de la fiche client (⚠️ En attente de règlement), qui sait
        // distinguer "jamais payé" de "payé puis annulé".
        onAnnulerPaye: () => {},
      });
    }
    // Volontairement pas d'acompte ici (PayPal ou autre) — cette popup ne
    // couvre que le solde et la reprise réglés à une activité précise.
  }

  return { encaisses, aPayer };
}

export default function PaiementsDuJourModal({
  encaisses,
  aPayer,
  onOpenClient,
  onOpenClientForPaiements,
  onClose,
}: {
  encaisses: Ligne[];
  aPayer: Ligne[];
  onOpenClient: (id: string) => void;
  onOpenClientForPaiements: (id: string) => void;
  onClose: () => void;
}) {
  const [dateModal, setDateModal] = useState<{ ligne: Ligne; date: string; mode: string } | null>(null);
  const [reporterModal, setReporterModal] = useState<{
    ligne: Ligne;
    montant: string;
    montantEgp: string;
    mode: string;
    date: string;
    prochaineActiviteId: string;
  } | null>(null);
  const [copiedBode, setCopiedBode] = useState(false);
  const confirm = useConfirm();

  const Row = ({ ligne }: { ligne: Ligne }) => (
    <div className="border-b border-neutral-100 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpenClient(ligne.client.id)}
            className="text-sm font-medium text-[#171717] hover:underline"
          >
            {ligne.client.nom || "Sans nom"}
          </button>
          <p className="text-xs text-neutral-500">{ligne.libelle}</p>
        </div>
        <span className="font-amounts flex-shrink-0 text-sm text-[#171717]">{montantAffiche(ligne)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
        <button
          onClick={() => onOpenClientForPaiements(ligne.client.id)}
          className="flex-shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-[#171717] hover:text-[#171717]"
        >
          Paiements
        </button>
        {!ligne.paye && ligne.reporterReste && (
          <button
            onClick={() =>
              setReporterModal({
                ligne,
                montant: String(ligne.reporterReste!.montantDefaut),
                montantEgp: "",
                mode: ligne.client.solde_mode || MODES_PAIEMENT[0],
                date: todayStr(),
                prochaineActiviteId: ligne.reporterReste!.candidats[0].id,
              })
            }
            className="flex-shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-[#171717] hover:text-[#171717]"
          >
            Cette activité seulement
          </button>
        )}
        <button
          onClick={async () => {
            if (ligne.paye) {
              ligne.onAnnulerPaye();
              return;
            }
            // Même garde-fou que partout ailleurs où on marque le solde payé
            // (ItineraryView, ActivityDetailModal, PaiementResteFlow) : un
            // acompte validé mais jamais réellement encaissé ne doit pas se
            // retrouver compté comme payé sans confirmation.
            if (soldeInclutAcompteImpaye(ligne.client)) {
              const ok = await confirm({
                title: "L'acompte n'a pas encore été marqué encaissé",
                message: `L'acompte de ${euros(ligne.client.acompte_montant)} € (${ligne.client.acompte_mode}) est toujours "en attente". En continuant, tout le séjour — acompte compris — sera considéré comme payé partout dans le dossier. Le montant collecté couvre-t-il bien aussi cet acompte ?`,
                confirmLabel: "Oui, l'acompte est inclus",
                cancelLabel: "Non, annuler",
              });
              if (!ok) return;
            }
            setDateModal({ ligne, date: todayStr(), mode: ligne.client.solde_mode || MODES_PAIEMENT[0] });
          }}
          className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${
            ligne.paye
              ? "border-neutral-300 text-neutral-600 hover:border-red-400 hover:text-red-600"
              : "border-[#171717] bg-[#171717] text-white hover:opacity-90"
          }`}
        >
          {ligne.paye ? "Marquer non payé" : "Tout régler"}
        </button>
      </div>
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

        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-neutral-700">
            À payer aujourd&apos;hui {aPayer.length > 0 && `(${aPayer.length})`}
          </h4>
          {aPayer.length > 0 && (
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(bodePaiementsMessage(aPayer));
                setCopiedBode(true);
                setTimeout(() => setCopiedBode(false), 2000);
              }}
              className="flex-shrink-0 rounded-md border border-[#171717]/20 px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#fafafa]"
            >
              {copiedBode ? "Copié ✓" : "Copier le message pour Bodé"}
            </button>
          )}
        </div>
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
              Renseigne la date et le mode réels du règlement — pas forcément
              aujourd&apos;hui ou le mode prévu si tu rattrapes un paiement déjà reçu autrement.
            </p>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Date</label>
            <input
              type="date"
              value={dateModal.date}
              onChange={(e) => setDateModal({ ...dateModal, date: e.target.value })}
              className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-xs font-medium text-neutral-500">Mode de règlement</label>
            <select
              value={dateModal.mode}
              onChange={(e) => setDateModal({ ...dateModal, mode: e.target.value })}
              className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {MODES_PAIEMENT.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  dateModal.ligne.onMarquerPaye(dateModal.date || todayStr(), dateModal.mode);
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

      {reporterModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h3 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Régler seulement cette activité
            </h3>
            <p className="mb-4 text-sm text-neutral-600">
              Le reste du solde sera reporté à l&apos;activité choisie ci-dessous — il
              réapparaîtra ici ce jour-là.
            </p>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Montant réglé aujourd&apos;hui (€)</label>
            <input
              type="number"
              min={0}
              value={reporterModal.montant}
              onChange={(e) => setReporterModal({ ...reporterModal, montant: e.target.value })}
              className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-xs font-medium text-neutral-500">Mode de règlement</label>
            <select
              value={reporterModal.mode}
              onChange={(e) => setReporterModal({ ...reporterModal, mode: e.target.value })}
              className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {MODES_PAIEMENT.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {reporterModal.mode === "Espèces EGP" && (
              <>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Montant remis en EGP</label>
                <input
                  type="number"
                  min={0}
                  value={reporterModal.montantEgp}
                  onChange={(e) => setReporterModal({ ...reporterModal, montantEgp: e.target.value })}
                  className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              </>
            )}
            <label className="mb-1 block text-xs font-medium text-neutral-500">Date du règlement</label>
            <input
              type="date"
              value={reporterModal.date}
              onChange={(e) => setReporterModal({ ...reporterModal, date: e.target.value })}
              className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Reporter le reste à cette activité
            </label>
            <select
              value={reporterModal.prochaineActiviteId}
              onChange={(e) => setReporterModal({ ...reporterModal, prochaineActiviteId: e.target.value })}
              className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {reporterModal.ligne.reporterReste?.candidats.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom} — {r.date}
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  reporterModal.ligne.onReporterReste?.({
                    montant: Number(reporterModal.montant) || 0,
                    montantEgp: Number(reporterModal.montantEgp) || 0,
                    mode: reporterModal.mode,
                    date: reporterModal.date || todayStr(),
                    prochaineActiviteId: reporterModal.prochaineActiviteId,
                  });
                  setReporterModal(null);
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Valider
              </button>
              <button
                onClick={() => setReporterModal(null)}
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
