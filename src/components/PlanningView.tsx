"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueItem,
  Client,
  HotelReference,
  PaiementEtape,
  Reservation,
  ReservationOption,
  ReservationTarif,
} from "@/lib/types";
import { matchHotel, hotelDisplayForEgypt } from "@/lib/hotelHelp";
import {
  acompteWaitingWarning,
  activitePaiementWarning,
  avoirUtiliseTotal,
  chevalChameauBadge,
  cleanActivityTitle,
  fmtEncaisseLe,
  isDeuxiemeIleOption,
  momentBadge,
  optionsBadge,
  enCoursBadge,
  reductionBadge,
  paiementBadge,
  paiementStatutKey,
  participantsFor,
  paxLine,
  pointureBadge,
  resaBreakdown,
  resaTotalMontant,
  reservationsActives,
  STATUT_PAIEMENT_OPTIONS,
  packBadge,
  volBadge,
} from "@/lib/resa";
import { localDateStr } from "@/lib/dates";
import { buildPaxEnglish } from "@/components/client-steps";
import { infosManquantesToutes } from "@/lib/infosManquantes";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtDateLong(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function toStr(d: Date) {
  return localDateStr(d);
}
function fmtDDMM(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
// Traduction "au mieux" du vocabulaire métier récurrent (bloc équipe Égypte,
// anglophone) — pas un moteur de traduction, juste les mots qui reviennent
// tout le temps dans les noms d'activités/options. Le reste (noms propres,
// lieux) reste tel quel.
const FR_EN_DICT: [RegExp, string][] = [
  [/déjà sur place/gi, "already on-site"],
  [/aller[- ]retour/gi, "round trip"],
  [/au coucher du soleil/gi, "at sunset"],
  [/au coucher de soleil/gi, "at sunset"],
  [/coucher du soleil/gi, "sunset"],
  [/coucher de soleil/gi, "sunset"],
  [/demi[- ]journée/gi, "half day"],
  [/journée complète/gi, "full day"],
  [/journée/gi, "day"],
  [/jours/gi, "days"],
  [/jour/gi, "day"],
  [/nuits/gi, "nights"],
  [/nuit/gi, "night"],
  [/semi-privé/gi, "semi-private"],
  [/privatif/gi, "private"],
  [/privée?/gi, "private"],
  [/après-midi/gi, "afternoon"],
  [/matin/gi, "morning"],
  [/chevaux/gi, "horses"],
  [/cheval/gi, "horse"],
  [/chameaux/gi, "camels"],
  [/chameau/gi, "camel"],
  [/plongée sous-marine/gi, "scuba diving"],
  [/plongée/gi, "diving"],
  [/randonnée/gi, "hike"],
  [/désert/gi, "desert"],
  [/île/gi, "island"],
  [/maison des dauphins/gi, "dolphin house"],
  [/dauphins/gi, "dolphins"],
  [/nage avec/gi, "swim with"],
  [/bassin/gi, "pool"],
  [/tortues/gi, "turtles"],
  [/visites/gi, "visits"],
  [/balade à/gi, "ride to"],
  [/balade/gi, "ride"],
  [/dîner spectacle/gi, "dinner show"],
  [/dîner/gi, "dinner"],
  [/spectacle/gi, "show"],
  [/bédouin/gi, "bedouin"],
  [/montgolfière/gi, "hot air balloon"],
  [/transfert/gi, "transfer"],
  [/aéroport/gi, "airport"],
  [/aléatoire/gi, "random"],
  [/arrêts/gi, "stops"],
  [/voiture/gi, "car"],
  [/avion/gi, "plane"],
  [/mer rouge/gi, "Red Sea"],
  [/\bmer\b/gi, "sea"],
  [/le caire/gi, "Cairo"],
  [/louxor/gi, "Luxor"],
  [/assouan/gi, "Aswan"],
  [/égypte/gi, "Egypt"],
  [/guide francophone/gi, "French-speaking guide"],
  [/guide anglophone/gi, "English-speaking guide"],
  [/\bvol\b/gi, "flight"],
  [/ avec /gi, " with "],
  [/ et /gi, " and "],
  // Filet de sécurité final : les petits mots de liaison français (articles,
  // prépositions) qui traînent encore une fois tout le reste traduit — sans
  // ça un "de"/"des"/"en" isolé restait visible au milieu d'une phrase
  // sinon entièrement en anglais.
  [/\bd'/gi, ""],
  [/\bl'/gi, ""],
  [/\bdes\b/gi, ""],
  [/\bdu\b/gi, ""],
  [/\bde\b/gi, ""],
  [/\ble\b/gi, "the"],
  [/\bla\b/gi, "the"],
  [/\bles\b/gi, "the"],
  [/\ben\b/gi, "in"],
  [/\bau\b/gi, "at"],
  [/\baux\b/gi, "to the"],
  [/\bsur\b/gi, "on"],
  [/\bune\b/gi, "a"],
  [/\bun\b/gi, "a"],
  [/\s{2,}/g, " "],
];
function translateFr(text: string) {
  let out = text;
  FR_EN_DICT.forEach(([re, repl]) => {
    // Garde la casse du mot d'origine (ex. "Transfert" en début de titre ne
    // doit pas devenir "transfer" en minuscule, ce qui casserait la casse
    // du titre entier).
    out = out.replace(re, (match) =>
      match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()
        ? repl.charAt(0).toUpperCase() + repl.slice(1)
        : repl
    );
  });
  return out;
}
// Le titre stocké peut porter un suffixe " — ..." (île / moment / créneau,
// posé par l'assistant d'ajout) — on ne veut que le nom de base ici, le
// moment/créneau est déjà ajouté séparément par momentBadge.
function baseActivityName(nom: string) {
  const idx = nom.indexOf(" — ");
  return idx === -1 ? nom : nom.slice(0, idx);
}
const PAYMENT_MODE_EN: Record<string, string> = {
  "Espèces EUR": "cash",
  "Espèces EGP": "cash",
  "Carte bleue": "card",
  "Virement bancaire": "bank transfer",
  PayPal: "PayPal",
};
function dateRangeIncludes(r: Reservation, dateStr: string) {
  if (!r.date_debut) return false;
  const end = r.date_fin || r.date_debut;
  return dateStr >= r.date_debut && dateStr <= end;
}
function resaActiveOn(r: Reservation, dateStr: string) {
  if (r.statut_resa === "Annulée") return false;
  return dateRangeIncludes(r, dateStr);
}
function rangesOverlap(rStart: string | null, rEnd: string | null, fStart: string, fEnd: string) {
  if (!rStart) return false;
  const end = rEnd || rStart;
  return rStart <= fEnd && end >= fStart;
}

const FILTERS = [
  { key: "hier", label: "Hier" },
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "demain", label: "Demain" },
  { key: "prochainement", label: "Prochainement" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois_choisi", label: "Choisir un mois" },
] as const;

const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function monthStartOf(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
function monthEndOf(monthStartStr: string) {
  const d = new Date(monthStartStr + "T00:00:00");
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
// Grille complète semaine par semaine (lundi → dimanche), en débordant sur
// le mois précédent/suivant pour ne jamais avoir de semaine incomplète.
function buildMonthGrid(monthStartStr: string): string[] {
  const d = new Date(monthStartStr + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + endOffset);
  const days: string[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(toStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

type Row = { client: Client; r: Reservation };

function ReservationSummaryCard({
  client,
  r,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  onClick,
  onOpenClient,
  size = "full",
}: {
  client: Client;
  r: Reservation;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  onClick: () => void;
  onOpenClient: (clientId: string) => void;
  size?: "full" | "medium" | "compact";
}) {
  const options = resaOptions[r.id] || [];
  const total = resaTotalMontant(r, client, options, resaTarifs[r.id] || []);
  const { nbAd, nbEnf } = participantsFor(r, client);
  // Le calcul du montant restant a besoin des réservations (et étapes de
  // paiement) de CE client uniquement — jamais du tableau global toutes
  // activités confondues, sous peine de sommer les montants de plusieurs
  // clients (bug déjà rencontré).
  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
  const clientEtapes = paiementsEtapes.filter((e) => e.client_id === client.id);
  const badge = paiementBadge(client, r, clientReservations, resaOptions, resaTarifs, clientEtapes);
  const paiementWarning = activitePaiementWarning(
    client,
    r,
    clientReservations,
    resaOptions,
    resaTarifs,
    clientEtapes
  );
  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);
  const infosManquantes = infosManquantesToutes(client, reservations);
  const infoComplet = infosManquantes.length === 0;
  const infoStatut = infoComplet ? null : infosManquantes[0];

  if (size === "medium") {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-3"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium leading-snug text-[#171717]">
            {cleanActivityTitle(r.nom_activite) || "Activité"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
          </p>
          {r.info_importante.trim() && (
            <span
              title={r.info_importante}
              className="max-w-[180px] truncate whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
            >
              ⚠ {r.info_importante}
            </span>
          )}
          {acompteWarning && (
            <span className="whitespace-nowrap text-[10px] font-medium text-yellow-700">
              ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
            </span>
          )}
          {momentBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              {momentBadge(r)}
            </span>
          )}
          {reductionBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {reductionBadge(r)}
            </span>
          )}
          {enCoursBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              {enCoursBadge(r)}
            </span>
          )}
          {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom))) && (
            <span className="whitespace-nowrap rounded-full bg-[#0F5C56] px-1.5 py-0.5 text-[10px] font-medium text-white">
              {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)))}
            </span>
          )}
          {volBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
            </span>
          )}
          {packBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              {packBadge(r)}
            </span>
          )}
          {pointureBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {pointureBadge(r)}
            </span>
          )}
          {chevalChameauBadge(r, client) && (
            <span className="whitespace-nowrap rounded-full bg-[#8B4531] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {chevalChameauBadge(r, client)}
            </span>
          )}
        </div>
        {r.pickup_reel && (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#0F5C56]">
            🚐 Pick-up {r.pickup_reel}
          </p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClient(client.id);
          }}
          className="mt-1 text-xs font-medium text-[#171717] hover:underline"
        >
          {client.nom || "Sans nom"}
        </button>
        <p className="mt-1 text-xs text-neutral-500">{paxLine(r, client)}</p>
        <div className="mt-2 flex items-start justify-between gap-2">
          <span
            className={`min-w-0 flex-1 rounded-full px-1.5 py-0.5 text-xs font-medium leading-tight ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-[#171717]">
            {euros(total)} €
          </span>
        </div>
        {(paiementWarning || (!infoComplet && infoStatut)) && (
          <p className="mt-1.5 text-xs font-medium leading-tight text-red-600">
            {paiementWarning
              ? `⚠️ ${euros(paiementWarning.amount)} ${paiementWarning.devise} to pay`
              : `⚠️ ${infoStatut}`}
          </p>
        )}
      </div>
    );
  }

  if (size === "compact") {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-2"
      >
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-xs font-medium leading-tight text-[#171717]">
            {cleanActivityTitle(r.nom_activite) || "Activité"}
            {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
          </p>
          {volBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {volBadge(r)}
              {r.photo_vol_path ? " 📷" : ""}
            </span>
          )}
          {packBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-[#C9973E]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#8B4531]">
              {packBadge(r)}
            </span>
          )}
          {pointureBadge(r) && (
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {pointureBadge(r)}
            </span>
          )}
          {chevalChameauBadge(r, client) && (
            <span className="rounded-full bg-[#8B4531] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {chevalChameauBadge(r, client)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClient(client.id);
          }}
          className="mt-0.5 text-xs font-medium text-[#171717] hover:underline"
        >
          {client.nom || "Sans nom"}
        </button>
        <p className="mt-0.5 text-[10px] text-neutral-500">{paxLine(r, client)}</p>
        <div className="mt-1 flex items-start justify-between gap-1">
          <span
            className={`min-w-0 flex-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-[#171717]">
            {euros(total)} €
          </span>
        </div>
        {(paiementWarning || (!infoComplet && infoStatut)) && (
          <p className="mt-1 text-[10px] font-medium text-red-600">
            {paiementWarning
              ? `⚠️ ${euros(paiementWarning.amount)} ${paiementWarning.devise}`
              : `⚠️ ${infoStatut}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-md border border-[#666666]/20 bg-white p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-[#171717]">
          {cleanActivityTitle(r.nom_activite) || "Activité"}
          {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
        </p>
        {r.info_importante.trim() && (
          <span
            title={r.info_importante}
            className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
          >
            ⚠ {r.info_importante}
          </span>
        )}
        {acompteWarning && (
          <span className="text-xs font-medium text-yellow-700">
            ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
          </span>
        )}
        {momentBadge(r) && (
          <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
            {momentBadge(r)}
          </span>
        )}
        {reductionBadge(r) && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {reductionBadge(r)}
          </span>
        )}
        {enCoursBadge(r) && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {enCoursBadge(r)}
          </span>
        )}
        {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom))) && (
          <span className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-xs font-medium text-white">
            {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)))}
          </span>
        )}
        {volBadge(r) && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {volBadge(r)}
            {r.photo_vol_path ? " 📷" : ""}
          </span>
        )}
        {packBadge(r) && (
          <span className="rounded-full bg-[#C9973E]/15 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
            {packBadge(r)}
          </span>
        )}
        {pointureBadge(r) && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {pointureBadge(r)}
          </span>
        )}
        {chevalChameauBadge(r, client) && (
          <span className="rounded-full bg-[#8B4531] px-2 py-0.5 text-xs font-semibold text-white">
            {chevalChameauBadge(r, client)}
          </span>
        )}
        {paiementWarning && (
          <span className="text-xs font-medium text-red-600">
            ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {fmtDate(r.date_debut as string)}
        {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
      </p>
      {r.pickup_reel && (
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#0F5C56]">
          🚐 Pick-up {r.pickup_reel}
        </p>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenClient(client.id);
        }}
        className="text-sm font-medium text-[#171717] hover:underline"
      >
        {client.nom || "Sans nom"}
      </button>
      <p className="mt-1 text-xs text-neutral-500">{paxLine(r, client)}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-base font-semibold text-[#171717]">{euros(total)} €</span>
      </div>
      {infoComplet ? (
        <p className="mt-2 text-[10px] text-neutral-400">dossier complet ✔️</p>
      ) : (
        <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
          {infoStatut}
        </span>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-[#171717]">{children}</span>
    </div>
  );
}

function ActivityDetailModal({
  client,
  r,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  onOpenClient,
  onOpenActivity,
  onOpenRdvPaiement,
  hotelsRef,
  onClose,
  onBack,
}: {
  client: Client;
  r: Reservation;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  onOpenClient: (clientId: string) => void;
  onOpenActivity: (r: Reservation) => void;
  onOpenRdvPaiement: (clientId: string) => void;
  hotelsRef: HotelReference[];
  onClose: () => void;
  onBack?: () => void;
}) {
  const supabase = createClient();
  const [showSoldeDetail, setShowSoldeDetail] = useState(false);
  const [copiedEgypt, setCopiedEgypt] = useState(false);
  const [photoVolUrl, setPhotoVolUrl] = useState("");
  // Le client vient d'une liste tenue par le parent (rafraîchie par polling)
  // — sans état local, changer le statut de paiement ici mettrait à jour la
  // base mais l'affichage resterait sur l'ancien statut jusqu'au prochain
  // rafraîchissement.
  const [soldeOverride, setSoldeOverride] = useState<Partial<Client> | null>(null);
  const effectiveClient = soldeOverride ? { ...client, ...soldeOverride } : client;
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      if (!r.photo_vol_path) {
        setPhotoVolUrl("");
        return;
      }
      const { data } = await supabase.storage.from("photos-vol").createSignedUrl(r.photo_vol_path, 3600);
      setPhotoVolUrl(data?.signedUrl ?? "");
    })();
  }, [r.photo_vol_path]);
  const options = resaOptions[r.id] || [];
  const tarifs = resaTarifs[r.id] || [];
  const total = resaTotalMontant(r, client, options, tarifs);
  const breakdown = resaBreakdown(r, client, options, tarifs, reservations, matchHotel(client.hotel, hotelsRef)?.ville);
  const { nbAd, nbEnf } = participantsFor(r, client);
  const soldeIci = client.solde_activite_id === r.id;
  // Le calcul du restant à payer a besoin des réservations de CE client
  // uniquement — jamais du tableau global toutes activités confondues.
  const clientReservations = reservations.filter((rr) => rr.client_id === client.id);
  const clientEtapes = paiementsEtapes.filter((e) => e.client_id === client.id);
  const badge = paiementBadge(effectiveClient, r, clientReservations, resaOptions, resaTarifs, clientEtapes);
  // Le solde peut être en attente de règlement sur une AUTRE activité déjà
  // identifiée (solde_activite_id pointe ailleurs) — dans ce cas on
  // renseigne où et quand, plutôt que de ne rien dire du tout.
  const soldeActiviteAilleurs =
    !soldeIci && !client.solde_paye && client.solde_activite_id
      ? clientReservations.find((rr) => rr.id === client.solde_activite_id) || null
      : null;
  // Un RDV paiement déjà planifié (à l'hôtel) est un cas normal, pas un trou
  // dans le suivi — le solde n'est simplement pas rattaché à une activité
  // puisqu'il se règle ailleurs. Ne jamais le confondre avec un solde
  // vraiment orphelin (aucune activité ET aucun RDV).
  const rdvPlanifie =
    !soldeIci &&
    !client.solde_paye &&
    !client.solde_activite_id &&
    !!(client.solde_rdv_heure || client.solde_rdv_lieu);
  // Solde en attente sans aucune activité de collecte NI RDV planifié — un
  // vrai trou dans le suivi qui doit se voir, sous peine de finir sans
  // jamais être encaissé.
  const soldeSansActivite =
    !soldeIci && !client.solde_paye && !client.solde_activite_id && !rdvPlanifie;
  const [showSoldeSansActiviteAlert, setShowSoldeSansActiviteAlert] = useState(soldeSansActivite);
  const totalSejourClient = reservationsActives(clientReservations).reduce(
    (s, rr) => s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
    0
  );
  const acompteClient =
    client.paiement_type === "acompte" && client.acompte_valide ? Number(client.acompte_montant) || 0 : 0;
  const etapesSumClient = clientEtapes.reduce((s, e) => s + (Number(e.montant) || 0), 0);
  const montantRdv = Math.max(
    totalSejourClient - acompteClient - etapesSumClient - avoirUtiliseTotal(clientReservations),
    0
  );
  const paiementWarning = activitePaiementWarning(
    client,
    r,
    clientReservations,
    resaOptions,
    resaTarifs,
    clientEtapes
  );
  const acompteWarning = acompteWaitingWarning(client, r, clientReservations);

  // Bloc équipe Égypte : la traduction reste "au mieux" (dictionnaire de
  // vocabulaire métier récurrent), pas un vrai moteur de traduction.
  const activiteLines: string[] = [fmtDDMM(r.date_debut || ""), translateFr(baseActivityName(r.nom_activite))];
  // La "2ème île" n'est jamais listée comme option ici — elle est déjà dans
  // le titre (ex. "avec Paradise + Hula Hula"), la répéter en dessous ferait
  // doublon. Format volontairement sans "participants" (tournure française
  // "N participants X") — juste la quantité et le nom, à l'anglaise.
  options
    .filter((o) => !isDeuxiemeIleOption(o.nom))
    .forEach((o) => {
      const qty = Number(o.quantite) || 1;
      const label = translateFr(o.nom);
      activiteLines.push(qty > 1 ? `${qty} ${label}` : label);
    });
  const momentEn = momentBadge(r);
  if (momentEn) activiteLines.push(translateFr(momentEn));
  if (r.horaire_souhaite) activiteLines.push(`Time : ${r.horaire_souhaite}`);
  const chevalBadge = chevalChameauBadge(r, client);
  if (chevalBadge) activiteLines.push(chevalBadge);
  if (r.nb_conducteurs != null) activiteLines.push(`Drivers : ${r.nb_conducteurs}`);
  if (r.nb_passagers != null) activiteLines.push(`Passengers : ${r.nb_passagers}`);
  if (r.pointure) activiteLines.push(`Shoe size : ${r.pointure}`);

  const paymentLine = paiementWarning
    ? `Payment : ${euros(paiementWarning.amount)} ${paiementWarning.devise === "EGP" ? "EGP" : "euros"} ${
        PAYMENT_MODE_EN[client.solde_mode] || client.solde_mode
      } ⚠️⚠️`
    : "";

  const hotelMatch = matchHotel(client.hotel, hotelsRef);
  const egyptBlock = `${activiteLines.join("\n")}\n\nName : ${client.nom || "—"}\n\n${buildPaxEnglish(
    client
  )}\n\nHotel : ${hotelDisplayForEgypt(client.hotel, hotelMatch?.ville)}\nRoom Number : ${
    client.chambre || "—"
  }\n\nWhat's app : ${client.telephone || "—"}${paymentLine ? `\n\n${paymentLine}` : ""}`;

  const copyEgyptBlock = async () => {
    try {
      await navigator.clipboard.writeText(egyptBlock);
      setCopiedEgypt(true);
      setTimeout(() => setCopiedEgypt(false), 1500);
    } catch {
      // clipboard indisponible, ignorer
    }
  };

  return (
    <>
      {showSoldeSansActiviteAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-300 bg-white p-5 shadow-xl">
            <p className="text-sm font-medium text-red-700">
              ⚠️ Solde du séjour en attente — pas encore rattaché à une activité de collecte, à
              surveiller. Souhaitez-vous définir un paiement pour cette activité/ce client ?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenClient(client.id);
                  onClose();
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Oui, définir un paiement
              </button>
              <button
                type="button"
                onClick={() => setShowSoldeSansActiviteAlert(false)}
                className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:underline"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 flex items-center gap-1 text-xs font-medium text-[#0F5C56] hover:underline"
            >
              ← Retour au billet
            </button>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-lg font-semibold text-[#171717]">
                {cleanActivityTitle(r.nom_activite) || "Activité sans nom"}
                {r.horaire_souhaite ? ` (${r.horaire_souhaite})` : ""}
            </h3>
            {r.info_importante.trim() && (
              <span
                title={r.info_importante}
                className="max-w-[220px] truncate rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
              >
                ⚠ {r.info_importante}
              </span>
            )}
            {momentBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {momentBadge(r)}
              </span>
            )}
            {reductionBadge(r) && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {reductionBadge(r)}
              </span>
            )}
            {enCoursBadge(r) && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {enCoursBadge(r)}
              </span>
            )}
            {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom))) && (
              <span className="rounded-full bg-[#0F5C56] px-2 py-0.5 text-xs font-medium text-white">
                {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)))}
              </span>
            )}
            {volBadge(r) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {volBadge(r)}
                {r.photo_vol_path ? " 📷" : ""}
              </span>
            )}
            {packBadge(r) && (
              <span className="rounded-full bg-[#C9973E]/15 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                {packBadge(r)}
              </span>
            )}
            {pointureBadge(r) && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {pointureBadge(r)}
              </span>
            )}
            {chevalChameauBadge(r, client) && (
              <span className="rounded-full bg-[#8B4531] px-2 py-0.5 text-xs font-semibold text-white">
                {chevalChameauBadge(r, client)}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        {(paiementWarning || acompteWarning) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {acompteWarning && (
              <span className="text-xs font-medium text-yellow-700">
                ⚠️waiting {euros(acompteWarning.montant)}€ {acompteWarning.mode}
              </span>
            )}
            {paiementWarning && (
              <span className="text-xs font-medium text-red-600">
                ⚠️ {euros(paiementWarning.amount)} {paiementWarning.devise} to pay to activity
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <DetailRow label="Client">
            <button
              type="button"
              onClick={() => {
                onOpenClient(client.id);
                onClose();
              }}
              className="text-[#171717] underline hover:no-underline"
            >
              {client.nom || "Sans nom"}
            </button>
          </DetailRow>
          <DetailRow label="Date">
            {fmtDate(r.date_debut || "")}
            {r.date_fin && r.date_fin !== r.date_debut ? ` → ${fmtDate(r.date_fin)}` : ""}
          </DetailRow>
          {r.pickup_reel && (
            <DetailRow label="Pick-up">
              <span className="text-[#0F5C56]">🚐 {r.pickup_reel}</span>
            </DetailRow>
          )}
          {(r.numero_vol.trim() || r.horaire_vol.trim() || r.photo_vol_path) && (
            <DetailRow label="Vol du client">
              <div className="flex flex-col items-end gap-0.5">
                <span>{[r.numero_vol.trim(), r.horaire_vol.trim()].filter(Boolean).join(" · ") || "—"}</span>
                {r.photo_vol_path && photoVolUrl && (
                  <a
                    href={photoVolUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-normal text-[#0F5C56] underline"
                  >
                    Voir la photo du vol
                  </a>
                )}
              </div>
            </DetailRow>
          )}
          <DetailRow label="PAX">{paxLine(r, client)}</DetailRow>
          <DetailRow label="Paiement">
            <select
              value={paiementStatutKey(effectiveClient, r)}
              onChange={async (e) => {
                const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.key === e.target.value);
                if (!opt) return;
                const patch = opt.patch(r);
                setSoldeOverride((prev) => ({ ...prev, ...patch }));
                await supabase.from("clients").update(patch).eq("id", client.id);
              }}
              className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {STATUT_PAIEMENT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </DetailRow>
          <DetailRow label="Total">{euros(total)} €</DetailRow>
        </div>

        {breakdown.length > 0 && (
          <div className="mt-1 space-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
            {breakdown.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span>{line.label}</span>
                <span>= {euros(line.amount)} €</span>
              </div>
            ))}
          </div>
        )}

        {(soldeIci || soldeActiviteAilleurs) && (
          <div className="mt-3 rounded-md bg-[#C9973E]/10 p-3 text-sm">
            <div className="flex w-full items-center justify-between gap-2 font-medium text-[#8B4531]">
              <button
                type="button"
                onClick={() => setShowSoldeDetail((v) => !v)}
                className="flex-1 text-left"
              >
                {soldeIci ? (
                  `💰 Solde du séjour collecté ici — ${client.solde_paye ? "Payé" : "À régler"}`
                ) : (
                  <>
                    💰 Solde du séjour collecté ultérieurement —{" "}
                    <span
                      role="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenActivity(soldeActiviteAilleurs!);
                      }}
                      className="underline hover:no-underline"
                    >
                      {cleanActivityTitle(soldeActiviteAilleurs!.nom_activite) || "Activité"}
                      {soldeActiviteAilleurs!.date_debut
                        ? ` (${fmtDate(soldeActiviteAilleurs!.date_debut)})`
                        : ""}
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSoldeDetail((v) => !v)}
                className="shrink-0 text-xs"
              >
                {showSoldeDetail ? "▲" : "▼"}
              </button>
            </div>
            {showSoldeDetail && (
              <div className="mt-2 space-y-1 border-t border-[#C9973E]/30 pt-2 text-xs text-[#8B4531]">
                {client.paiement_type === "acompte" && client.acompte_valide && (
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      Acompte — {client.acompte_mode}
                      {client.acompte_paye && client.acompte_date_encaissement
                        ? ` (encaissé le ${fmtEncaisseLe(client.acompte_date_encaissement, client.acompte_encaisse_ts)})`
                        : client.acompte_paye
                        ? " (encaissé)"
                        : " (à encaisser)"}
                    </span>
                    <span>{euros(client.acompte_montant)} €</span>
                  </div>
                )}
                {clientReservations.map((rr) => (
                  <button
                    type="button"
                    key={rr.id}
                    onClick={() => onOpenActivity(rr)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span>
                      {cleanActivityTitle(rr.nom_activite) || "Activité"}
                      {rr.date_debut ? ` (${fmtDate(rr.date_debut)})` : ""}
                    </span>
                    <span>
                      {euros(resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []))} €
                    </span>
                  </button>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-[#C9973E]/30 pt-1 font-semibold">
                  <span>Total séjour</span>
                  <span>
                    {euros(
                      reservationsActives(clientReservations).reduce(
                        (s, rr) =>
                          s + resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []),
                        0
                      )
                    )}{" "}
                    €
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {soldeSansActivite && (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700">
            ⚠️ Solde du séjour en attente — pas encore rattaché à une activité de collecte, à surveiller.
          </div>
        )}

        {rdvPlanifie && (
          <div className="mt-3 overflow-hidden rounded-md border border-blue-300 bg-blue-50 text-blue-700">
            <button
              type="button"
              onClick={() => {
                onOpenRdvPaiement(client.id);
                onClose();
              }}
              className="w-full p-3 text-left hover:bg-blue-100"
            >
              <p className="text-sm font-medium">📅 RDV paiement planifié</p>
              <p className="mt-1 text-xs">
                {client.solde_date ? fmtDate(client.solde_date) : "Date à définir"}
                {client.solde_rdv_heure ? ` — ${client.solde_rdv_heure}` : ""}
                {client.solde_rdv_lieu ? ` — ${client.solde_rdv_lieu}` : ""}
              </p>
              <p className="mt-1 whitespace-nowrap text-xs font-semibold">
                Montant : {euros(montantRdv)} €
              </p>
            </button>
            {clientReservations.length > 0 && (
              <div className="space-y-1 border-t border-blue-200 px-3 py-2 text-xs">
                {clientReservations.map((rr) => (
                  <button
                    type="button"
                    key={rr.id}
                    onClick={() => onOpenActivity(rr)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:underline"
                  >
                    <span>
                      {cleanActivityTitle(rr.nom_activite) || "Activité"}
                      {rr.date_debut ? ` (${fmtDate(rr.date_debut)})` : ""}
                    </span>
                    <span className="whitespace-nowrap">
                      {euros(resaTotalMontant(rr, client, resaOptions[rr.id] || [], resaTarifs[rr.id] || []))} €
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {r.info_importante && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ {r.info_importante}
          </div>
        )}

        {reductionBadge(r) && (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {reductionBadge(r)}
            {r.reduction_motif ? ` — ${r.reduction_motif}` : ""}
          </div>
        )}

        {enCoursBadge(r) && (
          <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">{enCoursBadge(r)}</div>
        )}

        {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom))) && (
          <div className="mt-3 rounded-md bg-[#0F5C56]/10 px-3 py-2 text-xs text-[#171717]">
            {optionsBadge(options.filter((o) => !isDeuxiemeIleOption(o.nom)))}
          </div>
        )}

        <div className="mt-3 rounded-md border border-[#666666]/20 bg-white p-4">
          <h3 className="font-heading text-sm font-semibold text-[#171717]">
            Bloc pour l&apos;équipe Égypte
          </h3>
          <p dir="rtl" className="mt-1 text-xs text-neutral-500">
            يرجى التحقق من صحة جميع الحقول قبل الإرسال
          </p>
          <pre className="font-amounts mt-2 whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 text-xs">
            {egyptBlock}
          </pre>
          <button
            onClick={copyEgyptBlock}
            className="mt-2 rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {copiedEgypt ? "Copié ✓" : "Copier"}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}

function CalendarMonthView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  onOpenActivity,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  onOpenActivity: (row: Row) => void;
  onOpenClient: (clientId: string) => void;
}) {
  const todayStr = toStr(new Date());
  const [monthCursor, setMonthCursor] = useState(() => monthStartOf(todayStr));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAnnulees, setShowAnnulees] = useState(false);

  const clientById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const gridDays = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    gridDays.forEach((day) => {
      const rows: Row[] = [];
      reservations.forEach((r) => {
        if (!resaActiveOn(r, day)) return;
        const client = clientById.get(r.client_id);
        if (!client) return;
        rows.push({ client, r });
      });
      rows.sort((a, b) => (a.r.moment || "").localeCompare(b.r.moment || ""));
      map.set(day, rows);
    });
    return map;
  }, [gridDays, reservations, clientById]);

  // Les activités annulées n'apparaissent plus sur la pastille du jour, mais
  // restent consultables au clic — repliées par défaut, pour retrouver une
  // annulation sans polluer la vue du jour au quotidien.
  const byDateAnnulees = useMemo(() => {
    const map = new Map<string, Row[]>();
    gridDays.forEach((day) => {
      const rows: Row[] = [];
      reservations.forEach((r) => {
        if (r.statut_resa !== "Annulée") return;
        if (!dateRangeIncludes(r, day)) return;
        const client = clientById.get(r.client_id);
        if (!client) return;
        rows.push({ client, r });
      });
      rows.sort((a, b) => (a.r.moment || "").localeCompare(b.r.moment || ""));
      map.set(day, rows);
    });
    return map;
  }, [gridDays, reservations, clientById]);

  const currentMonthIndex = new Date(monthCursor + "T00:00:00").getMonth();
  const selectedRows = selectedDay ? byDate.get(selectedDay) || [] : [];
  const selectedRowsAnnulees = selectedDay ? byDateAnnulees.get(selectedDay) || [] : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold capitalize text-[#171717]">
          {monthLabel(monthCursor)}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthCursor((m) => addMonths(m, -1))}
            className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setMonthCursor(monthStartOf(todayStr))}
            className="rounded-md border border-neutral-200 px-3 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="bg-[#fafafa] py-1.5 text-xs font-medium text-neutral-500">
            {w}
          </div>
        ))}
        {gridDays.map((day) => {
          const d = new Date(day + "T00:00:00");
          const inMonth = d.getMonth() === currentMonthIndex;
          const isToday = day === todayStr;
          const count = (byDate.get(day) || []).length;
          const countAnnulees = (byDateAnnulees.get(day) || []).length;
          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                setSelectedDay(day);
                setShowAnnulees(false);
              }}
              className={`flex min-h-[60px] flex-col items-center gap-1 bg-white py-2 hover:bg-[#fafafa] ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday ? "bg-[#5C2A1D] text-white" : "text-[#171717]"
                }`}
              >
                {d.getDate()}
              </span>
              {(count > 0 || countAnnulees > 0) && (
                <span className="flex items-center gap-1">
                  {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#C9973E]" />}
                  {countAnnulees > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-300" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-base font-semibold capitalize text-[#171717]">
                {fmtDateLong(selectedDay)}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-neutral-400 hover:text-[#171717]"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {selectedRows.length === 0 && (
                <div className="text-sm text-neutral-400">Aucune activité ce jour-là.</div>
              )}
              {selectedRows.map((row) => (
                <ReservationSummaryCard
                  key={row.r.id}
                  client={row.client}
                  r={row.r}
                  reservations={reservations}
                  resaOptions={resaOptions}
                  resaTarifs={resaTarifs}
                  paiementsEtapes={paiementsEtapes}
                  onClick={() => onOpenActivity(row)}
                  onOpenClient={onOpenClient}
                />
              ))}

              {selectedRowsAnnulees.length > 0 && (
                <div className="border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAnnulees((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-medium text-neutral-500 hover:text-[#171717]"
                  >
                    <span>
                      {selectedRowsAnnulees.length} activité{selectedRowsAnnulees.length > 1 ? "s" : ""} annulée
                      {selectedRowsAnnulees.length > 1 ? "s" : ""} ce jour-là
                    </span>
                    <span className="text-neutral-400">{showAnnulees ? "▲" : "▼"}</span>
                  </button>
                  {showAnnulees && (
                    <div className="mt-2 space-y-2">
                      {selectedRowsAnnulees.map((row) => (
                        <div
                          key={row.r.id}
                          onClick={() => onOpenActivity(row)}
                          className="cursor-pointer rounded-md border border-red-100 bg-red-50/40 p-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate font-medium text-[#171717] line-through decoration-red-400">
                              {cleanActivityTitle(row.r.nom_activite) || "Activité"}
                            </p>
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                              Annulée
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenClient(row.client.id);
                            }}
                            className="mt-0.5 text-xs font-medium text-[#171717] hover:underline"
                          >
                            {row.client.nom || "Sans nom"}
                          </button>
                          {row.r.annulation_raison && (
                            <p className="mt-0.5 text-xs text-neutral-500">{row.r.annulation_raison}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Regroupe toutes les activités à venir par catégorie (ex. tous les "Louxor
// en mini-bus", toutes les "Tortues"...) puis par date — pour repérer d'un
// coup d'œil les jours où grouper plusieurs clients sur la même sortie.
function ByActivityView({
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  catalogue,
  onOpenActivity,
  onOpenClient,
}: {
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  catalogue: CatalogueItem[];
  onOpenActivity: (row: Row) => void;
  onOpenClient: (clientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const todayStr = toStr(new Date());
  const [monthFilter, setMonthFilter] = useState<string>("a_venir");

  const monthOptions = useMemo(() => {
    const base = monthStartOf(todayStr);
    const opts: { value: string; label: string }[] = [];
    for (let i = -3; i <= 12; i++) {
      const m = addMonths(base, i);
      opts.push({ value: m, label: monthLabel(m) });
    }
    return opts;
  }, [todayStr]);

  const categoryLabel = (r: Reservation) => {
    if (r.catalogue_item_id) {
      const item = catalogue.find((c) => c.id === r.catalogue_item_id);
      if (item) return item.nom;
    }
    return baseActivityName(r.nom_activite) || "Sans nom";
  };

  const categories = useMemo(() => {
    const monthEnd = monthFilter !== "a_venir" ? monthEndOf(monthFilter) : "";
    const byCategory = new Map<string, { label: string; byDate: Map<string, Row[]> }>();
    reservations.forEach((r) => {
      if (!r.date_debut) return;
      if (monthFilter === "a_venir") {
        if (r.date_debut < todayStr) return;
      } else if (r.date_debut < monthFilter || r.date_debut > monthEnd) {
        return;
      }
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;
      const label = categoryLabel(r);
      const key = r.catalogue_item_id || `custom:${label}`;
      if (!byCategory.has(key)) byCategory.set(key, { label, byDate: new Map() });
      const cat = byCategory.get(key)!;
      cat.byDate.set(r.date_debut, [...(cat.byDate.get(r.date_debut) || []), { client, r }]);
    });
    return Array.from(byCategory.values())
      .map((cat) => ({
        label: cat.label,
        total: Array.from(cat.byDate.values()).reduce((s, rows) => s + rows.length, 0),
        dates: Array.from(cat.byDate.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      }))
      .filter((cat) => cat.label.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, reservations, catalogue, query, todayStr, monthFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer par activité (ex. Louxor, Tortues, dauphins…)"
          className="input flex-1"
        />
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="input w-auto capitalize"
        >
          <option value="a_venir">À venir</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value} className="capitalize">
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {categories.length === 0 && (
        <div className="text-sm text-neutral-400">
          {monthFilter === "a_venir" ? "Aucune activité à venir." : "Aucune activité ce mois-ci."}
        </div>
      )}

      {categories.map((cat) => {
        const isOpen = !!openCategories[cat.label];
        return (
          <div key={cat.label} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenCategories((prev) => ({ ...prev, [cat.label]: !prev[cat.label] }))}
              className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[#fafafa]"
            >
              <span className="font-heading text-sm font-semibold text-[#171717]">{cat.label}</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-medium text-[#8B4531]">
                  {cat.total} à venir
                </span>
                <span className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ⌄
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="space-y-4 border-t border-neutral-100 p-4">
                {cat.dates.map(([date, rows]) => {
                  const pax = rows.reduce((s, row) => {
                    const { nbAd, nbEnf } = participantsFor(row.r, row.client);
                    return s + nbAd + nbEnf;
                  }, 0);
                  return (
                    <div key={date}>
                      <h4 className="mb-2 text-xs font-semibold text-neutral-500">
                        {fmtDate(date)}
                        {date === todayStr ? " — aujourd'hui" : ""} · {rows.length} réservation
                        {rows.length > 1 ? "s" : ""}, {pax} pers.
                      </h4>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {rows.map((row) => (
                          <ReservationSummaryCard
                            key={row.r.id}
                            client={row.client}
                            r={row.r}
                            reservations={reservations}
                            resaOptions={resaOptions}
                            resaTarifs={resaTarifs}
                            paiementsEtapes={paiementsEtapes}
                            onClick={() => onOpenActivity(row)}
                            onOpenClient={onOpenClient}
                            size="compact"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type PlanningSub = "aujourdhui" | "demain" | "calendrier" | "par_activite";

function subToVue(sub: PlanningSub): "liste" | "calendrier" | "par_activite" {
  if (sub === "calendrier") return "calendrier";
  if (sub === "par_activite") return "par_activite";
  return "liste";
}

export default function PlanningView({
  sub,
  clients,
  reservations,
  resaOptions,
  resaTarifs,
  paiementsEtapes = [],
  catalogue,
  onOpenClient,
  onOpenRdvPaiement,
  focusReservationId,
  onBackToBillet,
}: {
  sub: PlanningSub;
  clients: Client[];
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  paiementsEtapes?: PaiementEtape[];
  catalogue: CatalogueItem[];
  onOpenClient: (clientId: string) => void;
  onOpenRdvPaiement: (clientId: string) => void;
  focusReservationId?: string | null;
  onBackToBillet?: () => void;
}) {
  const [vue, setVue] = useState<"liste" | "calendrier" | "par_activite">(subToVue(sub));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>(
    sub === "demain" ? "demain" : "aujourdhui"
  );
  const [activeActivity, setActiveActivity] = useState<Row | null>(null);
  const [moisChoisi, setMoisChoisi] = useState(() => monthStartOf(toStr(new Date())));
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from("hotels_reference").select("*");
      setHotelsRef((data as HotelReference[]) || []);
    })();
  }, []);

  // Sync depuis le sous-menu de gauche : comparaison en render (pas de
  // useEffect) pour éviter react-hooks/set-state-in-effect, cf. pattern déjà
  // utilisé pour lastConsumedRdvId dans SuivisView.tsx.
  const [lastSub, setLastSub] = useState(sub);
  if (sub !== lastSub) {
    setLastSub(sub);
    setVue(subToVue(sub));
    if (sub === "aujourdhui" || sub === "demain") setFilter(sub);
  }

  // Ouvre directement l'activité visée depuis "Voir l'activité" (fiche
  // détail d'un billet dans Suivis) — même pattern de synchronisation.
  const [lastFocusId, setLastFocusId] = useState<string | null | undefined>(undefined);
  if (focusReservationId && focusReservationId !== lastFocusId) {
    setLastFocusId(focusReservationId);
    const r = reservations.find((rr) => rr.id === focusReservationId);
    const client = r && clients.find((c) => c.id === r.client_id);
    if (r && client) setActiveActivity({ client, r });
  }

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toStr(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const prochainStart = new Date(today);
    prochainStart.setDate(today.getDate() + 2);
    const prochainEnd = new Date(today);
    prochainEnd.setDate(today.getDate() + 8);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const moisChoisiDebut = new Date(moisChoisi + "T00:00:00");
    const moisChoisiFin = new Date(moisChoisiDebut.getFullYear(), moisChoisiDebut.getMonth() + 1, 0);

    const rows: Row[] = [];
    reservations.forEach((r) => {
      if (!r.date_debut) return;
      const client = clients.find((c) => c.id === r.client_id);
      if (!client) return;

      let include = true;
      if (filter === "hier") include = resaActiveOn(r, toStr(yesterday));
      else if (filter === "aujourdhui") include = resaActiveOn(r, todayStr);
      else if (filter === "demain") include = resaActiveOn(r, toStr(tomorrow));
      else if (filter === "prochainement")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(prochainStart), toStr(prochainEnd));
      else if (filter === "mois")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(monthStart), toStr(monthEnd));
      else if (filter === "mois_choisi")
        include = rangesOverlap(r.date_debut, r.date_fin, toStr(moisChoisiDebut), toStr(moisChoisiFin));
      if (!include) return;

      rows.push({ client, r });
    });

    rows.sort((a, b) => (a.r.date_debut || "").localeCompare(b.r.date_debut || ""));

    // "Hier"/"Aujourd'hui"/"Demain" ne montrent qu'un seul jour à la fois —
    // regrouper par date_debut de chaque activité y affichait la date de
    // DÉBUT d'une activité sur plusieurs jours (ex. "31 août" pour une
    // croisière en cours) au lieu du jour réellement consulté, ce qui
    // donnait l'impression d'être resté sur un autre jour. Un seul groupe,
    // sous le jour du filtre, pour ces trois vues.
    const filterDateSingle =
      filter === "hier" ? toStr(yesterday) : filter === "aujourdhui" ? todayStr : filter === "demain" ? toStr(tomorrow) : null;

    const byDate: Record<string, Row[]> = {};
    rows.forEach((row) => {
      const key = filterDateSingle || (row.r.date_debut as string);
      byDate[key] = [...(byDate[key] || []), row];
    });
    return { byDate, todayStr };
  }, [clients, reservations, filter, moisChoisi]);

  const dateKeys = Object.keys(grouped.byDate).sort();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      {vue === "calendrier" ? (
        <CalendarMonthView
          clients={clients}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          onOpenActivity={setActiveActivity}
          onOpenClient={onOpenClient}
        />
      ) : vue === "par_activite" ? (
        <ByActivityView
          clients={clients}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          catalogue={catalogue}
          onOpenActivity={setActiveActivity}
          onOpenClient={onOpenClient}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  filter === f.key
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 bg-white text-neutral-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filter === "mois_choisi" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMoisChoisi((m) => addMonths(m, -1))}
                className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
              >
                ‹
              </button>
              <span className="font-heading text-sm font-semibold capitalize text-[#171717]">
                {monthLabel(moisChoisi)}
              </span>
              <button
                type="button"
                onClick={() => setMoisChoisi((m) => addMonths(m, 1))}
                className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-[#666666] hover:bg-[#fafafa]"
              >
                ›
              </button>
            </div>
          )}

          {dateKeys.length === 0 && (
            <div className="text-sm text-neutral-400">Aucune activité sur cette période.</div>
          )}

          {dateKeys.map((date) => (
            <div key={date}>
              <h3 className="font-heading mb-2 text-sm font-semibold text-[#171717]">
                {fmtDate(date)}
                {date === grouped.todayStr ? " — aujourd'hui" : ""}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.byDate[date].map((row) => (
                  <ReservationSummaryCard
                    key={row.r.id}
                    client={row.client}
                    r={row.r}
                    reservations={reservations}
                    resaOptions={resaOptions}
                    resaTarifs={resaTarifs}
                    paiementsEtapes={paiementsEtapes}
                    onClick={() => setActiveActivity(row)}
                    onOpenClient={onOpenClient}
                    size="medium"
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {activeActivity && (
        <ActivityDetailModal
          key={activeActivity.r.id}
          client={activeActivity.client}
          r={activeActivity.r}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          paiementsEtapes={paiementsEtapes}
          onOpenClient={onOpenClient}
          onOpenActivity={(rr) => setActiveActivity({ client: activeActivity.client, r: rr })}
          onOpenRdvPaiement={onOpenRdvPaiement}
          hotelsRef={hotelsRef}
          onClose={() => setActiveActivity(null)}
          onBack={activeActivity.r.id === focusReservationId ? onBackToBillet : undefined}
        />
      )}
    </div>
  );
}
