"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ActivityLogEntry,
  AssouanVerification,
  Avoir,
  BusEscalation,
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  ClientHotel,
  HotelReference,
  Remboursement,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxe,
  Verification,
} from "@/lib/types";
import {
  ASSIGNE_A_OPTIONS,
  CANAUX,
  MODES_PAIEMENT,
  RAISONS_REMBOURSEMENT,
  RELATIONS,
  STATUTS,
} from "@/lib/constants";
import { hossamBilletMessage, reservationsActives, resaTotalMontant } from "@/lib/resa";
import { infosManquantesAuto } from "@/lib/infosManquantes";
import { matchHotel, matchTransfertTaxe } from "@/lib/hotelHelp";
import { getEurToEgpRate } from "@/lib/exchangeRate";
import { todayStr } from "@/lib/dates";
import ItineraryView from "@/components/ItineraryView";
import { Field, PropertyRow } from "@/components/Field";
import AddActivityWizard from "@/components/AddActivityWizard";
import PassportPhotosUpload from "@/components/PassportPhotosUpload";
import RibScreenshotUpload from "@/components/RibScreenshotUpload";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

export function extractAges(text: string | null | undefined): string[] {
  return (text || "").match(/\d+/g) || [];
}
export function joinAnd(nums: string[]) {
  if (nums.length === 0) return "";
  if (nums.length === 1) return nums[0];
  return `${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;
}
export function buildPaxEnglish(client: Client) {
  const parts = [`${client.adultes || 0} adults`];
  if (client.enfants > 0) {
    const ages = extractAges(client.ages_enfants);
    parts.push(`${client.enfants} child's${ages.length ? ` (${joinAnd(ages)} yo)` : ""}`);
  }
  if (client.bebes > 0) {
    const ages = extractAges(client.ages_bebes);
    parts.push(`${client.bebes} baby${ages.length ? ` (${joinAnd(ages)} yo)` : ""}`);
  }
  return parts.join(" + ");
}

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function fmtDateDMY(dateStr: string | null) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

export { Field };

// Icônes minimalistes pour les PropertyRow de ContactStep/SejourStep —
// même style trait fin (viewBox 20, stroke 1.5) que le reste de l'appli.
const PROP_ICON_PATHS: Record<string, React.ReactNode> = {
  person: (
    <>
      <circle cx="10" cy="7" r="3" />
      <path d="M3.5 17c0-3 2.9-5.3 6.5-5.3s6.5 2.3 6.5 5.3" strokeLinecap="round" />
    </>
  ),
  flag: (
    <>
      <path d="M5 3v14" strokeLinecap="round" />
      <path d="M5 4h9l-2.2 3L14 10H5" strokeLinejoin="round" />
    </>
  ),
  phone: (
    <path d="M4.5 3.5h2.7l1 3.3-1.7 1.4a10 10 0 0 0 4.3 4.3l1.4-1.7 3.3 1v2.7c0 .8-.7 1.4-1.5 1.3C8.6 15.2 4.8 11.4 4 5.9c-.1-.8.5-1.4 1.3-1.4Z" strokeLinejoin="round" />
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M3 5.5l7 5.5 7-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  megaphone: (
    <path d="M3 8.5v3l2 .5 8 3v-10l-8 3-2 .5Z M13 8.5a2.5 2.5 0 0 1 0 3M16 6.5a5.5 5.5 0 0 1 0 7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M3 8h14M7 3v3M13 3v3" strokeLinecap="round" />
    </>
  ),
  hotel: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
    </>
  ),
  key: (
    <>
      <circle cx="7" cy="13" r="3" />
      <path d="M9.1 10.9 16 4" strokeLinecap="round" />
      <path d="M13 7l2 2M15.2 4.8l2 2" strokeLinecap="round" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="5.5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15" />
      <circle cx="14.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3 2.5 16h15L10 3Z" strokeLinejoin="round" />
      <path d="M10 8.5v3.2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  idcard: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M2.5 8h15" strokeLinecap="round" />
    </>
  ),
};
function PropIcon({ name }: { name: keyof typeof PROP_ICON_PATHS }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-full w-full">
      {PROP_ICON_PATHS[name]}
    </svg>
  );
}

// Les âges restent stockés dans le champ texte existant (ages_enfants,
// ages_bebes, ages_ados) pour ne rien casser ailleurs dans l'appli (Aperçu
// client, itinéraire, Suivis...) qui affichent directement cette chaîne —
// seule la saisie devient une liste de puces validées par tranche d'âge.
function parseAges(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function AgeChips({
  ages,
  min,
  max,
  onChange,
}: {
  ages: number[];
  min: number;
  max: number;
  onChange: (ages: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ages.map((a, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white pl-2 pr-1 py-0.5 text-xs text-neutral-600"
        >
          <input
            type="number"
            min={min}
            max={max}
            value={a}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const v = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
              const next = [...ages];
              next[i] = v;
              onChange(next);
            }}
            className="w-7 border-none bg-transparent text-xs focus:outline-none"
          />
          <span className="text-neutral-400">ans</span>
          <button
            type="button"
            onClick={() => onChange(ages.filter((_, idx) => idx !== i))}
            className="text-neutral-300 hover:text-red-600"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange([...ages, min])}
        className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
      >
        + âge
      </button>
    </div>
  );
}

type StepProps = {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
};

export function ContactStep({
  client,
  onChange,
  onNeedsField,
  reservations,
  totalSejour,
  hotelsRef,
  taxesRef,
  onOpenHelp,
}: StepProps & {
  onNeedsField: (message: string, focusId: string) => void;
  reservations: Reservation[];
  totalSejour?: number;
  hotelsRef: HotelReference[];
  taxesRef: TransfertTaxe[];
  onOpenHelp: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();
  const [infoOptions, setInfoOptions] = useState<string[]>([]);
  const [newInfoLabel, setNewInfoLabel] = useState("");
  const [infoManquanteOpen, setInfoManquanteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(!!client.email.trim());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("infos_manquantes_options")
        .select("label")
        .order("created_at", { ascending: true });
      if (error) {
        console.error("infos_manquantes_options", error);
        toast("Impossible de charger la liste — vérifie que la migration 0011 est bien passée.");
      }
      const fetched = ((data as { label: string }[]) || []).map((d) => d.label);
      setInfoOptions(
        fetched.length
          ? fetched
          : ["Complet", "Room number", "Date de RDV", "Numéro WhatsApp", "Billets d'avion", "Passeport", "Acompte PayPal", "Localisation", "Ticket de train"]
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Déduites des vraies données (hôtel/chambre/téléphone/acompte/billet/
  // passeport) plutôt que cochées à la main — toujours à jour, jamais
  // oubliées ni laissées cochées une fois l'info complétée.
  const autoTags = infosManquantesAuto(client, reservations);
  const manualTagsAffichees = client.infos_manquantes.filter((s) => !autoTags.includes(s));

  const toggleInfoManquante = (opt: string) => {
    const has = client.infos_manquantes.includes(opt);
    onChange({
      infos_manquantes: has
        ? client.infos_manquantes.filter((o) => o !== opt)
        : [...client.infos_manquantes, opt],
    });
  };

  const addCustomInfo = async () => {
    const clean = newInfoLabel.trim();
    if (!clean) return;
    if (!infoOptions.includes(clean)) {
      const { error } = await supabase.from("infos_manquantes_options").insert({ label: clean });
      if (error) {
        toast("Impossible d'ajouter cette option.");
        return;
      }
      setInfoOptions((prev) => [...prev, clean]);
    }
    if (!client.infos_manquantes.includes(clean)) {
      onChange({ infos_manquantes: [...client.infos_manquantes, clean] });
    }
    setNewInfoLabel("");
  };

  const hotelMatch = matchHotel(client.hotel, hotelsRef);
  // La taxe dépend de la tranche adultes/enfants (voir HELP > Taxes de
  // transfert) — jamais une seule ligne "ville → montant" comme avant.
  const taxeResultat = hotelMatch
    ? matchTransfertTaxe(taxesRef, hotelMatch.ville, client.adultes, client.enfants)
    : null;

  return (
    <div className="space-y-1.5">
      <PropertyRow label="Contact via" icon={<PropIcon name="phone" />}>
        <div className="flex items-center gap-4">
          <select
            value={client.canal}
            onChange={(e) => onChange({ canal: e.target.value })}
            className="input-flat w-32 flex-shrink-0"
          >
            {CANAUX.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {(client.canal === "Instagram" || client.canal === "TikTok") && (
            <div className="flex flex-1 items-center gap-1 text-neutral-400">
              <span>—</span>
              <span>@</span>
              <input
                value={client.pseudo_contact}
                onChange={(e) => onChange({ pseudo_contact: e.target.value })}
                placeholder="pseudo"
                className="input-flat flex-1 text-[#171717]"
              />
            </div>
          )}
          {client.canal === "Email" && (
            <div className="flex flex-1 items-center gap-1 text-neutral-400">
              <span>—</span>
              <input
                type="email"
                value={client.email}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="email"
                className="input-flat flex-1 text-[#171717]"
              />
            </div>
          )}
        </div>
      </PropertyRow>

      {client.canal === "Autre" && (
        <PropertyRow label="Préciser le canal">
          <input
            value={client.canal_autre}
            onChange={(e) => onChange({ canal_autre: e.target.value })}
            className="input-flat"
          />
        </PropertyRow>
      )}

      {typeof totalSejour === "number" && (
        <PropertyRow label="Total du séjour" icon={<PropIcon name="wallet" />}>
          <span className="font-heading text-sm font-semibold text-[#171717]">
            {totalSejour.toLocaleString("fr-FR")} €
          </span>
        </PropertyRow>
      )}

      {client.type_hebergement === "airbnb" ? (
        <>
          <PropertyRow label="Airbnb" icon={<PropIcon name="hotel" />}>
            <div className="flex items-center gap-2">
              <input
                value={client.hotel}
                onChange={(e) => onChange({ hotel: e.target.value })}
                placeholder="Nom / lien de l'Airbnb"
                className="input-flat flex-1 font-medium"
              />
              <button
                type="button"
                onClick={() => onChange({ type_hebergement: "hotel" })}
                className="flex-shrink-0 whitespace-nowrap text-xs text-neutral-400 hover:text-neutral-600"
              >
                Revenir à un hôtel
              </button>
            </div>
          </PropertyRow>
          <PropertyRow label="Adresse / GPS">
            <input
              value={client.airbnb_adresse}
              onChange={(e) => onChange({ airbnb_adresse: e.target.value })}
              placeholder="Adresse ou lien Google Maps"
              className="input-flat"
            />
          </PropertyRow>
          <PropertyRow label="Appart / Bâtiment">
            <div className="flex items-center gap-2">
              <input
                value={client.airbnb_appartement}
                onChange={(e) => onChange({ airbnb_appartement: e.target.value })}
                placeholder="N° appartement (si besoin)"
                className="input-flat flex-1"
              />
              <input
                value={client.airbnb_building}
                onChange={(e) => onChange({ airbnb_building: e.target.value })}
                placeholder="Bâtiment (si besoin)"
                className="input-flat flex-1"
              />
            </div>
          </PropertyRow>
        </>
      ) : (
        <>
          <PropertyRow label="Hôtel / Chambre" icon={<PropIcon name="hotel" />}>
            <div className="flex items-center gap-1.5">
              <input
                value={client.hotel}
                onChange={(e) => onChange({ hotel: e.target.value })}
                placeholder="Hôtel"
                size={Math.max(client.hotel.length, 8)}
                className="input-flat w-auto flex-shrink-0 font-medium"
              />
              {client.hotel.trim() && (
                <>
                  <span className="text-neutral-400">-</span>
                  <input
                    value={client.chambre}
                    onChange={(e) => onChange({ chambre: e.target.value })}
                    placeholder="N° chambre(s)"
                    className="input-flat min-w-0 flex-1"
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => onChange({ type_hebergement: "airbnb" })}
                className="flex-shrink-0 whitespace-nowrap text-xs text-neutral-400 hover:text-neutral-600"
              >
                Loger en Airbnb ?
              </button>
            </div>
          </PropertyRow>

          {client.hotel.trim() && (
            <div className="-mt-1 pl-[180px] text-xs">
              {hotelMatch ? (
                hotelMatch.sur_hurghada ? (
                  <span className="text-emerald-600">
                    ✓ Cet hôtel est bien sur Hurghada — pas de taxe de transfert.
                  </span>
                ) : (
                  <span className="text-orange-600">
                    ⚠ Cet hôtel n&apos;est pas sur Hurghada ({hotelMatch.ville}), il peut comporter une
                    taxe de transfert
                    {taxeResultat?.type === "montant" ? ` (${euros(taxeResultat.montant)} €)` : ""}
                    {taxeResultat?.type === "a_demander" ? ` (${taxeResultat.note})` : ""}.{" "}
                    <button type="button" onClick={onOpenHelp} className="underline hover:no-underline">
                      Vérifier le montant
                    </button>
                  </span>
                )
              ) : (
                <span className="text-neutral-400">
                  Hôtel non répertorié dans HELP.{" "}
                  <button type="button" onClick={onOpenHelp} className="underline hover:no-underline">
                    L&apos;ajouter
                  </button>
                </span>
              )}
            </div>
          )}
        </>
      )}

      <PropertyRow label="What's app" icon={<PropIcon name="phone" />}>
        <div className="flex items-center gap-2">
          <input
            value={client.telephone}
            onChange={(e) => onChange({ telephone: e.target.value })}
            size={Math.max(client.telephone.length, 10)}
            className="input-flat w-auto min-w-0 flex-shrink"
          />
          {client.canal !== "Email" &&
            (emailOpen ? (
              <>
                <span className="flex-shrink-0 text-neutral-300">·</span>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => onChange({ email: e.target.value })}
                  placeholder="Email"
                  size={Math.max(client.email.length, 10)}
                  className="input-flat w-auto min-w-0 flex-shrink"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEmailOpen(true)}
                className="flex-shrink-0 whitespace-nowrap text-xs text-neutral-400 hover:text-neutral-600"
              >
                + Ajouter un e-mail
              </button>
            ))}
        </div>
      </PropertyRow>

      <PropertyRow label="Passeports" icon={<PropIcon name="idcard" />}>
        <PassportPhotosUpload
          paths={client.passeport_photos || []}
          onChange={(passeport_photos) => onChange({ passeport_photos })}
        />
      </PropertyRow>

      <PropertyRow label="Relation grâce à" icon={<PropIcon name="megaphone" />}>
        <select
          value={client.relation_grace_a}
          onChange={(e) => onChange({ relation_grace_a: e.target.value })}
          className="input-flat"
        >
          {RELATIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </PropertyRow>
      {client.relation_grace_a === "Autre" && (
        <PropertyRow label="Préciser la relation">
          <input
            value={client.relation_autre}
            onChange={(e) => onChange({ relation_autre: e.target.value })}
            className="input-flat"
          />
        </PropertyRow>
      )}

      <PropertyRow label="Infos manquantes" icon={<PropIcon name="alert" />}>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {autoTags.map((s) => (
            <span
              key={`auto-${s}`}
              title="Détecté automatiquement depuis la fiche — se retire tout seul une fois complété"
              className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
            >
              🔒 {s}
            </span>
          ))}
          {manualTagsAffichees.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 rounded-full bg-[#C9973E]/15 px-2 py-0.5 text-xs text-[#666666]"
            >
              {s}
              <button
                type="button"
                onClick={() => toggleInfoManquante(s)}
                className="text-[#666666]/60 hover:text-[#666666]"
              >
                ✕
              </button>
            </span>
          ))}
          {autoTags.length === 0 && manualTagsAffichees.length === 0 && !infoManquanteOpen && (
            <span className="text-sm text-neutral-400">Aucune info manquante</span>
          )}
          <button
            type="button"
            onClick={() => setInfoManquanteOpen((o) => !o)}
            className="rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-[#fafafa]"
          >
            {infoManquanteOpen ? "Fermer" : "+ Modifier"}
          </button>
        </div>
      </PropertyRow>
        {infoManquanteOpen && (
          <div className="w-full rounded-md border border-neutral-300 bg-white p-2">
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {infoOptions.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[#fafafa]"
                >
                  <input
                    type="checkbox"
                    checked={client.infos_manquantes.includes(opt)}
                    onChange={() => toggleInfoManquante(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-1 border-t border-neutral-100 pt-2">
              <input
                value={newInfoLabel}
                onChange={(e) => setNewInfoLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomInfo();
                  }
                }}
                placeholder="+ Nouvelle option"
                className="input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={addCustomInfo}
                className="rounded-md bg-[#C9973E] px-2 text-sm text-white"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => setInfoManquanteOpen(false)}
              className="mt-2 w-full rounded-md bg-[#171717] py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Fermer
            </button>
          </div>
        )}
    </div>
  );
}

export function SejourStep({
  client,
  onChange,
  hotelsRef,
  taxesRef,
  onOpenHelp,
}: StepProps & {
  hotelsRef: HotelReference[];
  taxesRef: TransfertTaxe[];
  onOpenHelp: () => void;
}) {
  const supabase = createClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [clientHotels, setClientHotels] = useState<ClientHotel[]>([]);
  const [showCircuit, setShowCircuit] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("client_hotels")
        .select("*")
        .eq("client_id", client.id)
        .order("ordre", { ascending: true });
      setClientHotels((data as ClientHotel[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const addHotelStep = async () => {
    const { data, error } = await supabase
      .from("client_hotels")
      .insert({ client_id: client.id, ordre: clientHotels.length })
      .select()
      .single();
    if (!error && data) {
      setClientHotels((prev) => [...prev, data as ClientHotel]);
      setShowCircuit(true);
    } else {
      toast("Impossible d'ajouter cet hôtel.");
    }
  };

  const updateHotelStep = async (id: string, patch: Partial<ClientHotel>) => {
    setClientHotels((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    const { error } = await supabase.from("client_hotels").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteHotelStep = async (id: string) => {
    const ok = await confirm({
      message: "Retirer cet hôtel du circuit ?",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setClientHotels((prev) => prev.filter((h) => h.id !== id));
    const { error } = await supabase.from("client_hotels").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const moveHotelStep = (id: string, dir: -1 | 1) => {
    const idx = clientHotels.findIndex((h) => h.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= clientHotels.length) return;
    const next = [...clientHotels];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((h, i) => ({ ...h, ordre: i }));
    setClientHotels(reordered);
    reordered.forEach((h) => supabase.from("client_hotels").update({ ordre: h.ordre }).eq("id", h.id));
  };

  const copyBlock = `Name : ${client.nom || "—"}\n${buildPaxEnglish(client)}\nHotel : ${
    client.hotel || "—"
  }\nRoom Number : ${client.chambre || "—"}\nWhat's app : ${client.telephone || "—"}`;
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Dates du séjour, Hôtel/Chambre et le message Hurghada/taxe de
          transfert : se modifient/s'affichent désormais depuis Contact en
          haut de la fiche, plus ici. */}
      {clientHotels.length === 0 && !showCircuit ? (
        <button
          type="button"
          onClick={addHotelStep}
          className="text-sm text-[#171717] hover:underline"
        >
          + Ajouter d&apos;autres hôtels (circuit)
        </button>
      ) : (
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Autres hôtels du circuit (Caire, Louxor, Assouan, Marsa Alam, Siwa…)
          </p>
          {clientHotels.map((h, i) => (
            <div key={h.id} className="mb-3 flex items-end gap-2 border-b border-neutral-100 pb-3">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveHotelStep(h.id, -1)}
                  className="text-xs text-neutral-500 disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={i === clientHotels.length - 1}
                  onClick={() => moveHotelStep(h.id, 1)}
                  className="text-xs text-neutral-500 disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
              <Field label="Hôtel">
                <input
                  value={h.nom}
                  onChange={(e) => updateHotelStep(h.id, { nom: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Ville">
                <input
                  value={h.ville}
                  onChange={(e) => updateHotelStep(h.id, { ville: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Chambre">
                <input
                  value={h.chambre}
                  onChange={(e) => updateHotelStep(h.id, { chambre: e.target.value })}
                  className="input w-24"
                />
              </Field>
              <Field label="Arrivée">
                <input
                  type="date"
                  value={h.date_arrivee ?? ""}
                  onChange={(e) => updateHotelStep(h.id, { date_arrivee: e.target.value || null })}
                  className="input"
                />
              </Field>
              <Field label="Départ">
                <input
                  type="date"
                  value={h.date_depart ?? ""}
                  onChange={(e) => updateHotelStep(h.id, { date_depart: e.target.value || null })}
                  className="input"
                />
              </Field>
              <button
                type="button"
                onClick={() => deleteHotelStep(h.id)}
                className="pb-1.5 text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addHotelStep}
            className="text-xs text-[#171717] hover:underline"
          >
            + Ajouter un hôtel
          </button>
        </div>
      )}

      <PropertyRow label="Adultes" icon={<PropIcon name="person" />}>
        <input
          type="number"
          min={0}
          value={client.adultes}
          onChange={(e) => onChange({ adultes: Number(e.target.value) })}
          className="input-flat max-w-[140px]"
        />
      </PropertyRow>

      {client.enfants > 0 && (
        <PropertyRow label="Enfants (3-10 ans)" icon={<PropIcon name="person" />}>
          <AgeChips
            ages={parseAges(client.ages_enfants)}
            min={3}
            max={10}
            onChange={(ages) => onChange({ enfants: ages.length, ages_enfants: ages.join(", ") })}
          />
        </PropertyRow>
      )}
      {client.bebes > 0 && (
        <PropertyRow label="Bébés (0-2 ans)" icon={<PropIcon name="person" />}>
          <AgeChips
            ages={parseAges(client.ages_bebes)}
            min={0}
            max={2}
            onChange={(ages) => onChange({ bebes: ages.length, ages_bebes: ages.join(", ") })}
          />
        </PropertyRow>
      )}
      {client.ados_presents && (
        <PropertyRow label="Ados (11-17 ans)" icon={<PropIcon name="person" />}>
          <AgeChips
            ages={parseAges(client.ages_ados)}
            min={11}
            max={17}
            onChange={(ages) =>
              onChange({ ados_presents: ages.length > 0, ages_ados: ages.join(", ") })
            }
          />
        </PropertyRow>
      )}

      <div className="flex gap-3 pl-[26px] pt-0.5 text-xs text-neutral-400">
        {client.enfants === 0 && (
          <button
            type="button"
            onClick={() => onChange({ enfants: 1, ages_enfants: "3" })}
            className="hover:text-neutral-600"
          >
            + Enfant
          </button>
        )}
        {client.bebes === 0 && (
          <button
            type="button"
            onClick={() => onChange({ bebes: 1, ages_bebes: "0" })}
            className="hover:text-neutral-600"
          >
            + Bébé
          </button>
        )}
        {!client.ados_presents && (
          <button
            type="button"
            onClick={() => onChange({ ados_presents: true, ages_ados: "11" })}
            className="hover:text-neutral-600"
          >
            + Ado
          </button>
        )}
      </div>

      <div className="rounded-md border border-[#666666]/20 bg-white p-4">
        <h3 className="font-heading text-sm font-semibold text-[#171717]">
          Bloc pour l&apos;équipe Égypte
        </h3>
        <p dir="rtl" className="mt-1 text-xs text-neutral-500">
          يرجى التحقق من صحة جميع الحقول قبل الإرسال
        </p>
        <pre className="font-amounts mt-2 whitespace-pre-wrap rounded-md bg-[#fafafa] p-3 text-xs">
          {copyBlock}
        </pre>
        <button
          onClick={doCopy}
          className="mt-2 rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export function ActivitesStep({
  client,
  onChange,
  reservations,
  resaOptions,
  resaTarifs,
  onAddReservation,
  onUpdateReservation,
  onDeleteReservation,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onAddTarif,
  onUpdateTarif,
  onDeleteTarif,
  catalogue,
  catalogueTarifs,
  transfertTarifs,
  catalogueOptions,
  canSeeMargins,
  hotelHorsHurghada,
  coutsMap,
  onUpdateCoutReel,
  onRequestAdd,
  onBusEscalation,
  busEscalations,
  onJourEscalation,
  onAssouanVerification,
  assouanVerifications,
}: StepProps & {
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onAddReservation: () => Promise<string | null>;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onDeleteReservation: (id: string) => void;
  onAddOption: (resaId: string, seed?: { nom: string; prix: number }) => void;
  onUpdateOption: (resaId: string, optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (resaId: string, optId: string) => void;
  onAddTarif: (resaId: string, seed?: { label: string; pu: number }) => void;
  onUpdateTarif: (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => void;
  onDeleteTarif: (resaId: string, tarifId: string) => void;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  transfertTarifs: Record<string, CatalogueTransfertTarif[]>;
  catalogueOptions: Record<string, CatalogueOption[]>;
  canSeeMargins: boolean;
  hotelHorsHurghada?: boolean;
  coutsMap: Record<string, number>;
  onUpdateCoutReel: (id: string, value: number) => void;
  // Dans le dossier normal, ce bouton doit rouvrir la petite fenêtre
  // guidée plutôt que dérouler l'éditeur inline — mais le pas-à-pas de
  // création et la fenêtre guidée elle-même veulent garder le comportement
  // inline d'origine, d'où ce prop optionnel plutôt qu'un changement de
  // comportement global.
  onRequestAdd?: () => void;
  onBusEscalation: (nomActivite: string, reservationId: string) => Promise<void>;
  busEscalations: BusEscalation[];
  onJourEscalation: (
    nomActivite: string,
    reservationId: string,
    dateChoisie: string,
    jourChoisi: string,
    joursDisponibles: string[]
  ) => Promise<void>;
  onAssouanVerification: (nomActivite: string, reservationId: string) => Promise<void>;
  assouanVerifications: AssouanVerification[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  if (addingNew) {
    return (
      <AddActivityWizard
        client={client}
        catalogue={catalogue}
        catalogueTarifs={catalogueTarifs}
        transfertTarifs={transfertTarifs}
        catalogueOptions={catalogueOptions}
        hotelHorsHurghada={hotelHorsHurghada}
        onAddReservation={onAddReservation}
        onUpdateReservation={onUpdateReservation}
        onDeleteReservation={onDeleteReservation}
        onAddOption={onAddOption}
        onUpdateOption={onUpdateOption}
        onDeleteOption={onDeleteOption}
        onAddTarif={onAddTarif}
        onUpdateTarif={onUpdateTarif}
        onDeleteTarif={onDeleteTarif}
        reservations={reservations}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
        onFinish={() => setAddingNew(false)}
        onCancel={() => setAddingNew(false)}
        onBusEscalation={onBusEscalation}
        onJourEscalation={onJourEscalation}
        onAssouanVerification={onAssouanVerification}
      />
    );
  }

  const clientAnnule = client.statut === "Client annulé";

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {clientAnnule ? (
          <p className="text-xs text-neutral-400">Client annulé — impossible d&apos;ajouter une activité.</p>
        ) : (
          <button
            onClick={() => {
              if (onRequestAdd) {
                onRequestAdd();
                return;
              }
              setAddingNew(true);
            }}
            className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Ajouter une activité
          </button>
        )}
      </div>

      <ItineraryView
        client={client}
        reservations={reservations}
        resaOptions={resaOptions}
        resaTarifs={resaTarifs}
        expandedId={expandedId}
        onToggleExpand={setExpandedId}
        onSetPickup={(id, pickup_reel) => onUpdateReservation(id, { pickup_reel })}
        onUpdateReservation={onUpdateReservation}
        coutsMap={coutsMap}
        onUpdateCoutReel={onUpdateCoutReel}
        onDeleteReservation={(id) => {
          onDeleteReservation(id);
          setExpandedId((cur) => (cur === id ? null : cur));
        }}
        onAddOption={onAddOption}
        onUpdateOption={onUpdateOption}
        onDeleteOption={onDeleteOption}
        onAddTarif={onAddTarif}
        onUpdateTarif={onUpdateTarif}
        onDeleteTarif={onDeleteTarif}
        onUpdateClient={onChange}
        catalogue={catalogue}
        catalogueTarifs={catalogueTarifs}
        transfertTarifs={transfertTarifs}
        catalogueOptions={catalogueOptions}
        canSeeMargins={canSeeMargins}
        hotelHorsHurghada={hotelHorsHurghada}
        busEscalations={busEscalations}
        onJourEscalation={onJourEscalation}
        onAssouanVerification={onAssouanVerification}
        assouanVerifications={assouanVerifications}
      />
    </div>
  );
}

function EncaisseButton({
  paye,
  onMarquer,
  onAnnuler,
  marquerLabel = "Marquer encaissé",
}: {
  paye: boolean;
  onMarquer: () => void;
  onAnnuler: () => void;
  marquerLabel?: string;
}) {
  if (paye) {
    return (
      <button
        onClick={onAnnuler}
        className="whitespace-nowrap rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        Encaissé ✅
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] font-semibold text-yellow-700">En attente</span>
      <button
        onClick={onMarquer}
        className="whitespace-nowrap rounded-md bg-[#171717] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        {marquerLabel}
      </button>
    </div>
  );
}

const INTEGRAL_MODES = [
  { key: "rdv", label: "Rendez-vous paiement planifié", className: "border-blue-300 bg-blue-50 text-blue-700" },
  { key: "activite_eur", label: "Paiement à la première activité en €", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "activite_egp", label: "Paiement à la première activité en EGP", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "paypal", label: "Paiement via PayPal", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "virement", label: "Paiement par virement bancaire", className: "border-orange-300 bg-orange-50 text-orange-700" },
  { key: "cb", label: "Paiement par CB", className: "border-orange-300 bg-orange-50 text-orange-700" },
] as const;

const RDV_MODES = ["Carte bleue", "Espèces EUR", "Espèces EGP"] as const;

const INTEGRAL_MODE_SOLDE_MODE: Record<string, string> = {
  activite_eur: "Espèces EUR",
  activite_egp: "Espèces EGP",
  paypal: "PayPal",
  virement: "Virement bancaire",
  cb: "Carte bleue",
};

// Le flux de règlement (RDV planifié / à la première activité en €-EGP /
// PayPal / virement / CB) est identique qu'on règle le séjour en intégral
// ou seulement le reste après un acompte — seul le montant à couvrir change.
function PaiementResteFlow({
  client,
  onChange,
  reservations,
  montantACouvrir,
  confirm,
  toast,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  reservations: Reservation[];
  montantACouvrir: number;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
}) {
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [egpModal, setEgpModal] = useState<{ r: Reservation; rate: number } | null>(null);

  const assigneSelectValue = (ASSIGNE_A_OPTIONS as readonly string[]).includes(client.solde_assigne_a)
    ? client.solde_assigne_a
    : client.solde_assigne_a
      ? "Autre"
      : "";

  const validerRdv = () => {
    if (!client.solde_date || !client.solde_rdv_heure || !client.solde_assigne_a) {
      toast("Renseigne la date, l'heure et la personne assignée avant de valider.");
      return;
    }
    const mode = RDV_MODES.includes(client.solde_mode as (typeof RDV_MODES)[number])
      ? client.solde_mode
      : RDV_MODES[0];
    onChange({ solde_rdv_valide: true, solde_mode: mode });
  };

  const finaliserRdv = async () => {
    const ok = await confirm({
      title: "Rendez-vous finalisé ?",
      message:
        'Souhaitez-vous passer toutes les activités en "Payé - rendez-vous paiement finalisé" ?',
      confirmLabel: "Oui",
      cancelLabel: "Non, je m'en occupe manuellement",
    });
    if (ok) {
      onChange({ solde_paye: true, solde_rdv_finalise: true });
    }
  };

  const validerDatePaiement = () => {
    if (!client.solde_date) {
      toast("Renseigne la date de paiement avant de valider.");
      return;
    }
    onChange({ solde_rdv_valide: true, solde_mode: INTEGRAL_MODE_SOLDE_MODE[client.paiement_integral_mode] });
  };

  const marquerEncaisse = (mode: string) => {
    onChange({ solde_paye: true, solde_mode: mode, solde_rdv_finalise: false });
  };

  const supprimerCartePaiement = () => {
    onChange({
      solde_rdv_valide: false,
      solde_paye: false,
      solde_rdv_finalise: false,
      solde_rdv_heure: "",
      solde_activite_id: null,
      solde_mode: "Espèces EUR",
    });
  };

  const sortedByDate = [...reservations]
    .filter((r) => r.date_debut)
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  const confirmActivite = async (r: Reservation, key: string) => {
    const ok = await confirm({
      message: `Souhaitez-vous confirmer le paiement à "${r.nom_activite || "Activité sans nom"}" le ${fmtDateDMY(r.date_debut)} ?`,
      confirmLabel: "Oui, je confirme",
      cancelLabel: "Non, je sélectionne une activité",
    });
    if (!ok) {
      setShowActivityPicker(true);
      return;
    }
    setShowActivityPicker(false);
    if (key === "activite_egp") {
      const rate = (await getEurToEgpRate()) || client.egp_taux || 0;
      setEgpModal({ r, rate });
    } else {
      onChange({ solde_activite_id: r.id, solde_mode: "Espèces EUR", solde_rdv_valide: true });
    }
  };

  const selectActiviteMode = (key: string) => {
    onChange({ paiement_integral_mode: key });
    if (sortedByDate.length === 0) {
      toast("Aucune activité datée pour l'instant.");
      return;
    }
    confirmActivite(sortedByDate[0], key);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {INTEGRAL_MODES.filter(
          (m) => !client.paiement_integral_mode || client.paiement_integral_mode === m.key
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              if (client.paiement_integral_mode === m.key) {
                onChange({ paiement_integral_mode: "" });
                setShowActivityPicker(false);
                return;
              }
              if (m.key === "activite_eur" || m.key === "activite_egp") {
                selectActiviteMode(m.key);
              } else {
                onChange({ paiement_integral_mode: m.key });
              }
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              client.paiement_integral_mode === m.key
                ? m.className
                : "border-neutral-300 text-neutral-500"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {client.paiement_integral_mode === "rdv" && (
        <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
          {!client.solde_rdv_valide ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date du RDV paiement">
                  <input
                    type="date"
                    value={client.solde_date ?? ""}
                    onChange={(e) => onChange({ solde_date: e.target.value || null })}
                    className="input"
                  />
                </Field>
                <Field label="Heure">
                  <input
                    type="time"
                    value={client.solde_rdv_heure}
                    onChange={(e) => onChange({ solde_rdv_heure: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Mode de paiement">
                  <select
                    value={RDV_MODES.includes(client.solde_mode as (typeof RDV_MODES)[number]) ? client.solde_mode : RDV_MODES[0]}
                    onChange={(e) => onChange({ solde_mode: e.target.value })}
                    className="input"
                  >
                    {RDV_MODES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigné à">
                  <select
                    value={assigneSelectValue}
                    onChange={(e) =>
                      onChange({
                        solde_assigne_a: e.target.value === "Autre" ? "" : e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="">Choisir…</option>
                    {ASSIGNE_A_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Field>
                {assigneSelectValue === "Autre" && (
                  <Field label="Préciser le nom">
                    <input
                      value={client.solde_assigne_a}
                      onChange={(e) => onChange({ solde_assigne_a: e.target.value })}
                      className="input"
                    />
                  </Field>
                )}
              </div>
              <button
                onClick={validerRdv}
                className="mt-3 rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Valider
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-700">
                <p className="font-medium text-[#171717]">
                  RDV paiement — {fmtDateDMY(client.solde_date)} à {client.solde_rdv_heure}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-[#fafafa] px-2 py-0.5 text-xs text-[#171717]">
                    ⌂ {client.hotel || "—"}
                  </span>
                  <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs text-[#666666]">
                    👤 {client.solde_assigne_a}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {client.solde_mode}
                  </span>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <EncaisseButton
                  paye={client.solde_paye}
                  onMarquer={finaliserRdv}
                  onAnnuler={() => onChange({ solde_paye: false, solde_rdv_finalise: false })}
                  marquerLabel="Rendez-vous finalisé"
                />
                <button
                  onClick={supprimerCartePaiement}
                  title="Supprimer"
                  className="p-1 text-red-500 hover:text-red-600"
                >
                  🗑
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {client.paiement_integral_mode &&
        client.paiement_integral_mode !== "rdv" &&
        client.paiement_integral_mode !== "activite_eur" &&
        client.paiement_integral_mode !== "activite_egp" &&
        (() => {
          const modeInfo = INTEGRAL_MODES.find((m) => m.key === client.paiement_integral_mode)!;
          const soldeMode = INTEGRAL_MODE_SOLDE_MODE[client.paiement_integral_mode];
          return (
            <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3">
              {!client.solde_rdv_valide ? (
                <>
                  <Field label="Date de paiement">
                    <input
                      type="date"
                      value={client.solde_date ?? ""}
                      onChange={(e) => onChange({ solde_date: e.target.value || null })}
                      className="input max-w-[200px]"
                    />
                  </Field>
                  <button
                    onClick={validerDatePaiement}
                    className="mt-3 rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Valider
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-neutral-700">
                    <p className="font-medium text-[#171717]">
                      {modeInfo.label} — {fmtDateDMY(client.solde_date)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                        {soldeMode}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <EncaisseButton
                      paye={client.solde_paye}
                      onMarquer={() => marquerEncaisse(soldeMode)}
                      onAnnuler={() => onChange({ solde_paye: false })}
                    />
                    <button
                      onClick={supprimerCartePaiement}
                      title="Supprimer"
                      className="p-1 text-red-500 hover:text-red-600"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {(client.paiement_integral_mode === "activite_eur" ||
        client.paiement_integral_mode === "activite_egp") &&
        (() => {
          const modeInfo = INTEGRAL_MODES.find((m) => m.key === client.paiement_integral_mode)!;
          const soldeMode = client.paiement_integral_mode === "activite_egp" ? "Espèces EGP" : "Espèces EUR";
          const chosenResa = reservations.find((r) => r.id === client.solde_activite_id) || null;

          if (showActivityPicker || (!client.solde_rdv_valide && !chosenResa)) {
            return (
              <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3">
                <p className="mb-2 text-sm font-medium text-neutral-700">
                  Choisir l&apos;activité pour ce paiement
                </p>
                {sortedByDate.length === 0 && (
                  <p className="text-sm text-neutral-400">Aucune activité datée pour l&apos;instant.</p>
                )}
                <div className="space-y-1.5">
                  {sortedByDate.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => confirmActivite(r, client.paiement_integral_mode)}
                      className="flex w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-sm hover:border-[#171717]"
                    >
                      <span className="text-[#171717]">{r.nom_activite || "Activité sans nom"}</span>
                      <span className="font-amounts text-xs text-neutral-500">
                        {fmtDateDMY(r.date_debut)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (!chosenResa) return null;

          return (
            <div className="rounded-md border border-orange-200 bg-orange-50/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-neutral-700">
                  <p className="font-medium text-[#171717]">
                    {modeInfo.label} — {chosenResa.nom_activite || "Activité sans nom"} (
                    {fmtDateDMY(chosenResa.date_debut)})
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      {soldeMode}
                    </span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <EncaisseButton
                    paye={client.solde_paye}
                    onMarquer={() => marquerEncaisse(soldeMode)}
                    onAnnuler={() => onChange({ solde_paye: false })}
                  />
                  <button
                    onClick={supprimerCartePaiement}
                    title="Supprimer"
                    className="p-1 text-red-500 hover:text-red-600"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {egpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Confirmer le montant en EGP
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              Le taux aujourd&apos;hui est à 1€ = {egpModal.rate.toFixed(2)} EGP, soit pour le
              client un total de{" "}
              <strong>{Math.round(montantACouvrir * egpModal.rate).toLocaleString("fr-FR")} EGP</strong>.
              Souhaitez-vous confirmer ?
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Field label="Taux (1€ =)">
                <input
                  type="number"
                  step="0.01"
                  value={egpModal.rate}
                  onChange={(e) => setEgpModal({ ...egpModal, rate: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Montant total (EGP)">
                <input
                  type="number"
                  value={Math.round(montantACouvrir * egpModal.rate)}
                  onChange={(e) => {
                    const montant = Number(e.target.value);
                    setEgpModal({
                      ...egpModal,
                      rate: montantACouvrir > 0 ? montant / montantACouvrir : egpModal.rate,
                    });
                  }}
                  className="input"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  onChange({
                    solde_activite_id: egpModal.r.id,
                    solde_mode: "Espèces EGP",
                    solde_rdv_valide: true,
                    egp_taux: egpModal.rate,
                    egp_montant: Math.round(montantACouvrir * egpModal.rate),
                  });
                  setEgpModal(null);
                }}
                className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Oui, je valide
              </button>
              <button
                onClick={() => setEgpModal(null)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
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

export function PaiementsStep({
  client,
  onChange,
  reservations,
  resaOptions,
  resaTarifs,
  onUpdateReservation,
}: StepProps & {
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [acompteDateModal, setAcompteDateModal] = useState<{ step: "choix" | "date"; date: string } | null>(
    null
  );
  const [billetHossamReminder, setBilletHossamReminder] = useState<Reservation | null>(null);
  const [copiedHossamReminder, setCopiedHossamReminder] = useState(false);

  // Après avoir marqué l'acompte encaissé, si un billet d'avion attend
  // encore d'être signalé à Hossam, on le rappelle tout de suite — c'est
  // exactement le moment où l'équipe doit relancer Hossam pour qu'il
  // réserve, et l'endroit le plus fréquent où cet oubli se produit.
  const checkBilletHossamReminder = () => {
    const pending = reservations.find(
      (r) => r.billet_requis && (r.billet_etape === "attente_acompte" || r.billet_etape === "a_envoyer_hossam")
    );
    if (pending) setBilletHossamReminder(pending);
  };

  const totalSejour = reservationsActives(reservations).reduce(
    (sum, r) => sum + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
  const acomptePaye = client.paiement_type === "acompte" && client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  const avoirsUtilises = reservations.filter((r) => Number(r.avoir_utilise) > 0);
  const avoirUtilise = avoirsUtilises.reduce((s, r) => s + (Number(r.avoir_utilise) || 0), 0);
  // Le solde n'est plus un montant saisi à la main : c'est toujours le reste
  // du séjour une fois l'acompte et un éventuel avoir consommé déduits.
  const soldeRestant = Math.max(totalSejour - acomptePaye - avoirUtilise, 0);
  const totalPaye = acomptePaye + avoirUtilise + (client.solde_paye ? soldeRestant : 0);
  const reste = totalSejour - totalPaye;

  const validerAcompte = () => {
    if (!client.acompte_montant) {
      toast("Renseigne le montant de l'acompte avant de valider.");
      return;
    }
    onChange({ acompte_valide: true });
  };

  const supprimerAcompte = () => {
    onChange({ acompte_valide: false, acompte_paye: false, acompte_date_encaissement: null });
  };

  const clickMarquerAcompteEncaisse = () => {
    if (client.acompte_paye) {
      onChange({ acompte_paye: false, acompte_date_encaissement: null });
      return;
    }
    setAcompteDateModal({ step: "choix", date: todayStr() });
  };

  const resteApresAcompte = Math.max(
    totalSejour - (client.acompte_valide ? Number(client.acompte_montant) || 0 : 0) - avoirUtilise,
    0
  );

  return (
    <div className="space-y-1.5">

      <div className="rounded-md bg-white p-3 text-sm text-neutral-600">
        Total séjour : <strong>{euros(totalSejour)} €</strong>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
          Payé : {euros(totalPaye)} €
        </span>
        {avoirUtilise > 0 && (
          <span className="rounded-full bg-[#C9973E]/20 px-3 py-1.5 text-xs font-medium text-[#8B4531]">
            Dont avoir utilisé : {euros(avoirUtilise)} €
          </span>
        )}
        <span className="rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-medium text-yellow-700">
          Reste à payer : {euros(reste)} €
        </span>
      </div>

      {avoirsUtilises.length > 0 && (
        <div className="rounded-md border border-[#C9973E]/30 bg-[#C9973E]/10 p-3 text-sm">
          <h3 className="mb-1 text-sm font-semibold text-[#8B4531]">Avoirs déduits</h3>
          <div className="space-y-1">
            {avoirsUtilises.map((r) => (
              <div key={r.id} className="text-[#8B4531]">
                Avoir de <strong>{euros(r.avoir_utilise)} €</strong> déduit sur{" "}
                {r.nom_activite || "Activité sans nom"}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Type de paiement</h3>
        <select
          value={client.paiement_type}
          onChange={(e) => onChange({ paiement_type: e.target.value })}
          className="input"
        >
          <option value="">Choisir…</option>
          <option value="integral">Paiement intégral en une seule fois</option>
          <option value="acompte">Paiement acompte + règlement à l&apos;arrivée</option>
        </select>

        {client.paiement_type === "integral" && (
          <PaiementResteFlow
            client={client}
            onChange={onChange}
            reservations={reservations}
            montantACouvrir={totalSejour}
            confirm={confirm}
            toast={toast}
          />
        )}

        {client.paiement_type === "acompte" && (
          <div className="mt-3 space-y-3">
            <div className="rounded-md border border-neutral-200 bg-white p-3">
              {!client.acompte_valide ? (
                <>
                  <p className="mb-2 text-sm font-medium text-neutral-700">Acompte</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Montant de l'acompte (€)">
                      <input
                        type="number"
                        value={client.acompte_montant}
                        onChange={(e) => onChange({ acompte_montant: Number(e.target.value) })}
                        className="input"
                      />
                    </Field>
                    <Field label="Mode de paiement">
                      <select
                        value={client.acompte_mode}
                        onChange={(e) => onChange({ acompte_mode: e.target.value })}
                        className="input"
                      >
                        {MODES_PAIEMENT.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <button
                    onClick={validerAcompte}
                    className="mt-3 rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Valider
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-neutral-700">
                    <p className="font-medium text-[#171717]">
                      Acompte — {euros(client.acompte_montant)} € ({client.acompte_mode})
                      {client.acompte_paye && client.acompte_date_encaissement
                        ? ` — encaissé le ${fmtDateDMY(client.acompte_date_encaissement)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <EncaisseButton
                      paye={client.acompte_paye}
                      onMarquer={clickMarquerAcompteEncaisse}
                      onAnnuler={clickMarquerAcompteEncaisse}
                    />
                    <button
                      onClick={supprimerAcompte}
                      title="Supprimer"
                      className="p-1 text-red-500 hover:text-red-600"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-1 text-xs font-medium text-neutral-500">
                Reste à l&apos;arrivée : <strong>{euros(resteApresAcompte)} €</strong>
              </h4>
              <PaiementResteFlow
                client={client}
                onChange={onChange}
                reservations={reservations}
                montantACouvrir={resteApresAcompte}
                confirm={confirm}
                toast={toast}
              />
            </div>
          </div>
        )}
      </div>

      {acompteDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              Marquer l&apos;acompte encaissé
            </h2>
            {acompteDateModal.step === "choix" ? (
              <>
                <p className="mb-4 text-sm text-neutral-600">
                  Marquer l&apos;acompte encaissé à la date d&apos;aujourd&apos;hui ?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      onChange({
                        acompte_paye: true,
                        acompte_date_encaissement: todayStr(),
                      });
                      setAcompteDateModal(null);
                      checkBilletHossamReminder();
                    }}
                    className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Oui, encaissé aujourd&apos;hui
                  </button>
                  <button
                    onClick={() => setAcompteDateModal({ ...acompteDateModal, step: "date" })}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
                  >
                    Non, une autre date
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <Field label="Date d'encaissement">
                    <input
                      type="date"
                      value={acompteDateModal.date}
                      onChange={(e) => setAcompteDateModal({ ...acompteDateModal, date: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      onChange({ acompte_paye: true, acompte_date_encaissement: acompteDateModal.date });
                      setAcompteDateModal(null);
                      checkBilletHossamReminder();
                    }}
                    className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => setAcompteDateModal(null)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {billetHossamReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[6px] border border-[#eaeaea] bg-white p-6">
            <h2 className="font-heading mb-2 text-lg font-semibold text-[#171717]">
              ✈ Billet d&apos;avion à traiter
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              Ce client a un billet d&apos;avion : prévenez Hossam que l&apos;acompte a été payé
              et qu&apos;il peut réserver le billet d&apos;avion.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  const r = billetHossamReminder;
                  try {
                    await navigator.clipboard.writeText(hossamBilletMessage(r, client));
                    setCopiedHossamReminder(true);
                    setTimeout(() => setCopiedHossamReminder(false), 1500);
                  } catch {
                    // clipboard indisponible, ignorer
                  }
                  onUpdateReservation(r.id, {
                    billet_etape: "attente_hossam",
                    billet_demande_envoyee_le: r.billet_demande_envoyee_le || todayStr(),
                  });
                  setBilletHossamReminder(null);
                }}
                className="rounded-md bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {copiedHossamReminder ? "Copié ✓" : "Copier la demande pour Hossam"}
              </button>
              <button
                onClick={() => {
                  const r = billetHossamReminder;
                  onUpdateReservation(r.id, {
                    billet_etape: "attente_hossam",
                    billet_demande_envoyee_le: r.billet_demande_envoyee_le || todayStr(),
                  });
                  setBilletHossamReminder(null);
                }}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                C&apos;est déjà fait
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string) {
  return { insert: "a créé", update: "a modifié", delete: "a supprimé" }[action] || action;
}

function tableLabel(table: string) {
  return (
    {
      clients: "la fiche client",
      reservations: "une activité",
      paiements: "un acompte",
      remboursements: "un remboursement",
    }[table] || table
  );
}

const ACTION_STYLES: Record<string, string> = {
  insert: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
};
const ACTION_ICONS: Record<string, string> = {
  insert: "+",
  update: "✎",
  delete: "✕",
};

export function SuiviStep({
  client,
  reservations,
  avoirs,
  onAddAvoir,
  onUpdateAvoir,
  onDeleteAvoir,
}: StepProps & {
  reservations: Reservation[];
  avoirs: Avoir[];
  onAddAvoir: () => void;
  onUpdateAvoir: (id: string, patch: Partial<Avoir>) => void;
  onDeleteAvoir: (id: string) => void;
}) {
  const supabase = createClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verifNom, setVerifNom] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: rembs }, { data: verifs }, { data: log }] = await Promise.all([
        supabase
          .from("remboursements")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("verifications")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("activity_log")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      setRemboursements((rembs as Remboursement[]) || []);
      setVerifications((verifs as Verification[]) || []);
      setActivityLog((log as ActivityLogEntry[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const addRemboursement = async () => {
    const { data, error } = await supabase
      .from("remboursements")
      .insert({ client_id: client.id })
      .select()
      .single();
    if (!error && data) {
      setRemboursements((prev) => [...prev, data as Remboursement]);
    } else {
      toast("Impossible d'ajouter le remboursement.");
    }
  };

  const updateRemboursement = async (id: string, patch: Partial<Remboursement>) => {
    setRemboursements((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("remboursements").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteRemboursement = async (id: string) => {
    const ok = await confirm({
      message: "Retirer ce remboursement ? Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setRemboursements((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from("remboursements").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const addVerification = async () => {
    if (!verifNom.trim()) return;
    const today = todayStr();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("verifications")
      .insert({
        client_id: client.id,
        nom: verifNom.trim(),
        date: today,
        verifie_par_id: user?.id || null,
      })
      .select()
      .single();
    if (!error && data) {
      setVerifications((prev) => [...prev, data as Verification]);
    } else {
      toast("Impossible d'enregistrer la vérification.");
    }
  };

  return (
    <div className="space-y-1.5">

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#171717]">Remboursements</h3>
          <button
            onClick={addRemboursement}
            className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Ajouter un remboursement
          </button>
        </div>
        {remboursements.length === 0 && (
          <div className="text-sm text-neutral-400">Aucun remboursement.</div>
        )}
        <div className="space-y-4">
          {remboursements.map((r) => {
            const activiteLiee = reservations.find((res) => res.id === r.activite_id);
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
              >
                <div
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    r.statut === "Effectué" ? "bg-green-50" : "bg-[#f5a623]/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-xl font-semibold text-[#171717]">
                      {euros(r.montant)} €
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.statut === "Effectué"
                          ? "bg-green-100 text-green-700"
                          : "bg-[#f5a623]/20 text-[#8B4531]"
                      }`}
                    >
                      {r.statut}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-neutral-500">
                      {r.mode}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteRemboursement(r.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Retirer
                  </button>
                </div>

                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Montant (€)">
                      <input
                        type="number"
                        value={r.montant}
                        onChange={(e) =>
                          updateRemboursement(r.id, { montant: Number(e.target.value) })
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Statut">
                      <select
                        value={r.statut}
                        onChange={(e) =>
                          updateRemboursement(r.id, {
                            statut: e.target.value as Remboursement["statut"],
                          })
                        }
                        className="input"
                      >
                        <option>En attente</option>
                        <option>Effectué</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Raison">
                      <select
                        value={r.raison}
                        onChange={(e) => updateRemboursement(r.id, { raison: e.target.value })}
                        className="input"
                      >
                        {RAISONS_REMBOURSEMENT.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    {r.raison === "Autre" && (
                      <Field label="Préciser la raison">
                        <input
                          value={r.raison_autre}
                          onChange={(e) =>
                            updateRemboursement(r.id, { raison_autre: e.target.value })
                          }
                          className="input"
                        />
                      </Field>
                    )}
                  </div>

                  <Field label="Détails — pourquoi ce remboursement ?">
                    <textarea
                      value={r.details}
                      onChange={(e) => updateRemboursement(r.id, { details: e.target.value })}
                      placeholder="Explique en détail ce qui s'est passé et ce qui justifie le remboursement…"
                      rows={3}
                      className="input"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3 rounded-md bg-[#fafafa] p-3">
                    <Field label="Activité concernée">
                      <select
                        value={r.activite_id ?? ""}
                        onChange={(e) =>
                          updateRemboursement(r.id, { activite_id: e.target.value || null })
                        }
                        className="input"
                      >
                        <option value="">Non liée</option>
                        {reservations.map((res) => (
                          <option key={res.id} value={res.id}>
                            {res.nom_activite || "Activité sans nom"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date de l'activité">
                      <div className="input flex items-center bg-neutral-100 text-neutral-500">
                        {activiteLiee?.date_debut ? fmtDate(activiteLiee.date_debut) : "—"}
                      </div>
                    </Field>
                    <Field label="Date de l'annulation">
                      <input
                        type="date"
                        value={r.date_probleme ?? ""}
                        onChange={(e) =>
                          updateRemboursement(r.id, { date_probleme: e.target.value || null })
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Date du remboursement">
                      <input
                        type="date"
                        value={r.date_remboursement ?? ""}
                        onChange={(e) =>
                          updateRemboursement(r.id, { date_remboursement: e.target.value || null })
                        }
                        className="input"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mode de remboursement">
                      <select
                        value={r.mode}
                        onChange={(e) => updateRemboursement(r.id, { mode: e.target.value })}
                        className="input"
                      >
                        {MODES_PAIEMENT.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Fait par">
                      <input
                        value={r.par}
                        onChange={(e) => updateRemboursement(r.id, { par: e.target.value })}
                        className="input"
                      />
                    </Field>
                    {r.mode === "PayPal" && (
                      <Field label="Adresse PayPal du client">
                        <input
                          value={r.paypal_email}
                          onChange={(e) =>
                            updateRemboursement(r.id, { paypal_email: e.target.value })
                          }
                          placeholder="prenom.nom@email.com"
                          className="input"
                        />
                      </Field>
                    )}
                    {r.mode === "Virement bancaire" && (
                      <Field label="RIB">
                        <RibScreenshotUpload
                          path={r.rib_photo_path}
                          onChange={(path) => updateRemboursement(r.id, { rib_photo_path: path })}
                        />
                      </Field>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#171717]">
            Avoirs <span className="font-normal text-neutral-500">— à utiliser pendant le séjour</span>
          </h3>
          <button
            onClick={onAddAvoir}
            className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Ajouter un avoir
          </button>
        </div>
        {avoirs.length === 0 && <div className="text-sm text-neutral-400">Aucun avoir.</div>}
        <div className="space-y-3">
          {avoirs.map((a) => (
            <div key={a.id} className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-[#C9973E]/20 px-2 py-0.5 font-medium text-[#8B4531]">
                  Restant : {euros(a.montant_restant)} € / {euros(a.montant)} €
                </span>
                <span className="text-neutral-500">
                  À utiliser jusqu&apos;au {client.date_fin ? fmtDate(client.date_fin) : "—"} (date de fin de séjour)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant de l'avoir (€)">
                  <input
                    type="number"
                    value={a.montant}
                    onChange={(e) => {
                      const montant = Number(e.target.value) || 0;
                      const consomme = a.montant - a.montant_restant;
                      onUpdateAvoir(a.id, { montant, montant_restant: Math.max(montant - consomme, 0) });
                    }}
                    className="input"
                  />
                </Field>
                <Field label="Raison">
                  <select
                    value={a.raison}
                    onChange={(e) => onUpdateAvoir(a.id, { raison: e.target.value })}
                    className="input"
                  >
                    {RAISONS_REMBOURSEMENT.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                {a.raison === "Autre" && (
                  <Field label="Préciser la raison">
                    <input
                      value={a.raison_autre}
                      onChange={(e) => onUpdateAvoir(a.id, { raison_autre: e.target.value })}
                      className="input"
                    />
                  </Field>
                )}
                <Field label="Activité liée">
                  <select
                    value={a.activite_id ?? ""}
                    onChange={(e) => onUpdateAvoir(a.id, { activite_id: e.target.value || null })}
                    className="input"
                  >
                    <option value="">Non liée</option>
                    {reservations.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.nom_activite || "Activité sans nom"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date du problème">
                  <input
                    type="date"
                    value={a.date_probleme ?? ""}
                    onChange={(e) => onUpdateAvoir(a.id, { date_probleme: e.target.value || null })}
                    className="input"
                  />
                </Field>
              </div>
              <button
                onClick={() => onDeleteAvoir(a.id)}
                className="mt-2 text-xs text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#171717]">Vérification du dossier</h3>
        <div className="flex gap-2">
          <input
            value={verifNom}
            onChange={(e) => setVerifNom(e.target.value)}
            placeholder="Votre prénom"
            className="input"
          />
          <button
            onClick={addVerification}
            className="whitespace-nowrap rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Marquer vérifié aujourd&apos;hui
          </button>
        </div>
        {verifications.length === 0 && (
          <div className="mt-2 text-sm text-neutral-400">Pas encore vérifié.</div>
        )}
        <div className="mt-2 space-y-1">
          {verifications.map((v) => (
            <div key={v.id} className="text-sm text-neutral-600">
              ✓ Vérifié par <strong>{v.nom}</strong> le {fmtDate(v.date)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <details className="group w-fit max-w-full text-right">
          <summary className="cursor-pointer list-none text-xs text-neutral-400 hover:text-neutral-600">
            <span className="inline-flex items-center gap-1">
              Historique des modifications
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3 w-3 transition-transform group-open:rotate-180"
              >
                <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <div className="mt-2 max-h-64 w-72 overflow-y-auto rounded-md border border-[#eaeaea] bg-white text-left">
            {activityLog.length === 0 ? (
              <div className="p-3 text-sm text-neutral-400">Aucune activité enregistrée.</div>
            ) : (
              activityLog.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-2 px-3 py-2 text-xs ${
                    i > 0 ? "border-t border-neutral-100" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] ${ACTION_STYLES[entry.action]}`}
                  >
                    {ACTION_ICONS[entry.action]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-neutral-700">
                      <span className="font-medium text-[#171717]">
                        {entry.actor_email ? entry.actor_email.split("@")[0] : "quelqu'un"}
                      </span>{" "}
                      {actionLabel(entry.action)} {tableLabel(entry.table_name)}
                    </p>
                    <p className="text-[10px] text-neutral-400">{fmtDateTime(entry.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      </div>

      <div className="rounded-md bg-[#fafafa]/50 p-3 text-sm text-neutral-600">
        {client.prochain_appel_date ? (
          <>
            📞 Prochain appel — {fmtDate(client.prochain_appel_date)}
            {client.prochain_appel_heure ? ` à ${client.prochain_appel_heure}` : ""}
          </>
        ) : (
          "Aucun appel programmé."
        )}
        <span className="ml-1 text-xs text-neutral-400">(géré depuis Suivis → Appels)</span>
      </div>
    </div>
  );
}
