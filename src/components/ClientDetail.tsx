"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueItem,
  CatalogueTarif,
  Client,
  HotelReference,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxe,
} from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { STATUT_COLORS } from "@/lib/constants";
import { generateClientDocument } from "@/lib/generateClientDocument";
import { matchHotel } from "@/lib/hotelHelp";
import { resaTotalMontant } from "@/lib/resa";
import {
  ActivitesStep,
  ContactStep,
  PaiementsStep,
  SejourStep,
  SuiviStep,
} from "@/components/client-steps";

const SECTIONS = ["Contact", "Séjour", "Activités", "Paiements", "Suivi"] as const;

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

function Section({
  title,
  titleExtra,
  open,
  onToggle,
  children,
}: {
  title: string;
  titleExtra?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[6px] border border-[#eaeaea] bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-heading text-sm font-semibold text-[#171717]">{title}</span>
          {titleExtra}
        </span>
        <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {open && <div className="border-t border-[#666666]/10 px-5 py-5">{children}</div>}
    </div>
  );
}

export default function ClientDetail({
  client,
  allClients,
  onChange,
  onDelete,
  onJumpToClient,
  onDuplicateAsNewStay,
  canDelete,
  canSeeMargins,
  catalogue,
  catalogueTarifs,
  onOpenHelp,
}: {
  client: Client;
  allClients: Client[];
  onChange: (patch: Partial<Client>) => void;
  onDelete: () => void;
  onJumpToClient: (id: string) => void;
  onDuplicateAsNewStay: (source: Client) => void;
  canDelete: boolean;
  canSeeMargins: boolean;
  catalogue: CatalogueItem[];
  catalogueTarifs: Record<string, CatalogueTarif[]>;
  onOpenHelp: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const toast = useToast();
  const CLOSED_SECTIONS: Record<(typeof SECTIONS)[number], boolean> = {
    Contact: false,
    Séjour: false,
    Activités: false,
    Paiements: false,
    Suivi: false,
  };
  const [open, setOpen] = useState<Record<(typeof SECTIONS)[number], boolean>>(CLOSED_SECTIONS);

  useEffect(() => {
    setOpen(CLOSED_SECTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resaOptions, setResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [resaTarifs, setResaTarifs] = useState<Record<string, ReservationTarif[]>>({});
  const [coutsMap, setCoutsMap] = useState<Record<string, number>>({});
  const [generatingDoc, setGeneratingDoc] = useState<"devis" | "facture" | null>(null);
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  const [taxesRef, setTaxesRef] = useState<TransfertTaxe[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: h }, { data: t }] = await Promise.all([
        supabase.from("hotels_reference").select("*"),
        supabase.from("transfert_taxes").select("*"),
      ]);
      setHotelsRef((h as HotelReference[]) || []);
      setTaxesRef((t as TransfertTaxe[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hotelMatch = matchHotel(client.hotel, hotelsRef);
  const hotelHorsHurghada = !!hotelMatch && !hotelMatch.sur_hurghada;

  useEffect(() => {
    (async () => {
      const { data: resas } = await supabase
        .from("reservations")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      const list = (resas as Reservation[]) || [];
      setReservations(list);

      if (list.length) {
        const [{ data: opts }, { data: tarifs }] = await Promise.all([
          supabase
            .from("reservation_options")
            .select("*")
            .in(
              "reservation_id",
              list.map((r) => r.id)
            ),
          supabase
            .from("reservation_tarifs")
            .select("*")
            .in(
              "reservation_id",
              list.map((r) => r.id)
            ),
        ]);
        const grouped: Record<string, ReservationOption[]> = {};
        ((opts as ReservationOption[]) || []).forEach((o) => {
          grouped[o.reservation_id] = [...(grouped[o.reservation_id] || []), o];
        });
        setResaOptions(grouped);
        const groupedTarifs: Record<string, ReservationTarif[]> = {};
        ((tarifs as ReservationTarif[]) || []).forEach((t) => {
          groupedTarifs[t.reservation_id] = [...(groupedTarifs[t.reservation_id] || []), t];
        });
        setResaTarifs(groupedTarifs);
      } else {
        setResaOptions({});
        setResaTarifs({});
      }

      // Coûts réels réservés à la Direction en base (table à part + RLS) —
      // on ne fetch même pas pour un compte équipe.
      if (canSeeMargins && list.length) {
        const { data: couts } = await supabase
          .from("reservation_couts")
          .select("*")
          .in(
            "reservation_id",
            list.map((r) => r.id)
          );
        const map: Record<string, number> = {};
        ((couts as { reservation_id: string; cout_reel: number }[]) || []).forEach((c) => {
          map[c.reservation_id] = c.cout_reel;
        });
        setCoutsMap(map);
      } else {
        setCoutsMap({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, canSeeMargins]);

  const updateCoutReel = async (reservationId: string, value: number) => {
    setCoutsMap((prev) => ({ ...prev, [reservationId]: value }));
    const { error } = await supabase
      .from("reservation_couts")
      .upsert({ reservation_id: reservationId, cout_reel: value });
    if (error) toast("Échec de l'enregistrement du coût.");
  };

  const addReservation = async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from("reservations")
      .insert({ client_id: client.id, transfert_inclus: !hotelHorsHurghada })
      .select()
      .single();
    if (!error && data) {
      setReservations((prev) => [...prev, data as Reservation]);
      return (data as Reservation).id;
    }
    toast("Impossible d'ajouter l'activité.");
    return null;
  };

  const updateReservation = async (id: string, patch: Partial<Reservation>) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteReservation = async (id: string) => {
    const ok = await confirm({
      title: "Retirer cette activité ?",
      message: "Ses options et son lien éventuel au solde seront aussi retirés. Cette action est irréversible.",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    setReservations((prev) => prev.filter((r) => r.id !== id));
    setResaOptions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setResaTarifs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) toast("Échec de la suppression.");
  };

  const addOption = async (resaId: string) => {
    const { data, error } = await supabase
      .from("reservation_options")
      .insert({ reservation_id: resaId, nom: "Guide francophone", prix: 0 })
      .select()
      .single();
    if (!error && data) {
      setResaOptions((prev) => ({
        ...prev,
        [resaId]: [...(prev[resaId] || []), data as ReservationOption],
      }));
    } else {
      toast("Impossible d'ajouter l'option.");
    }
  };

  const updateOption = async (
    resaId: string,
    optId: string,
    patch: Partial<ReservationOption>
  ) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((o) => (o.id === optId ? { ...o, ...patch } : o)),
    }));
    const { error } = await supabase.from("reservation_options").update(patch).eq("id", optId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteOption = async (resaId: string, optId: string) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((o) => o.id !== optId),
    }));
    const { error } = await supabase.from("reservation_options").delete().eq("id", optId);
    if (error) toast("Échec de la suppression.");
  };

  const addTarif = async (resaId: string, seed?: { label: string; pu: number }) => {
    const { data, error } = await supabase
      .from("reservation_tarifs")
      .insert({ reservation_id: resaId, label: seed?.label || "", pu: seed?.pu || 0, quantite: 0 })
      .select()
      .single();
    if (!error && data) {
      setResaTarifs((prev) => ({
        ...prev,
        [resaId]: [...(prev[resaId] || []), data as ReservationTarif],
      }));
    } else {
      toast("Impossible d'ajouter ce tarif.");
    }
  };

  const updateTarif = async (resaId: string, tarifId: string, patch: Partial<ReservationTarif>) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((t) => (t.id === tarifId ? { ...t, ...patch } : t)),
    }));
    const { error } = await supabase.from("reservation_tarifs").update(patch).eq("id", tarifId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteTarif = async (resaId: string, tarifId: string) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((t) => t.id !== tarifId),
    }));
    const { error } = await supabase.from("reservation_tarifs").delete().eq("id", tarifId);
    if (error) toast("Échec de la suppression.");
  };

  const autresSejours = allClients.filter(
    (c) => c.id !== client.id && client.telephone && c.telephone === client.telephone
  );

  const totalSejourHeader = reservations.reduce(
    (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
  const totalPersonnes = (Number(client.adultes) || 0) + (Number(client.enfants) || 0) + (Number(client.bebes) || 0);

  const acomptePayeMontant =
    client.paiement_type === "acompte" && client.acompte_paye ? Number(client.acompte_montant) || 0 : 0;
  const soldeRestantHeader = Math.max(totalSejourHeader - acomptePayeMontant, 0);
  const totalPayeHeader = acomptePayeMontant + (client.solde_paye ? soldeRestantHeader : 0);
  const paiementFullyPaid = totalSejourHeader > 0 && totalPayeHeader >= totalSejourHeader;

  const handleDownload = async (docType: "devis" | "facture") => {
    setGeneratingDoc(docType);
    try {
      generateClientDocument(docType, client, reservations, resaOptions, resaTarifs);
    } finally {
      setGeneratingDoc(null);
    }
  };

  const toggle = (s: (typeof SECTIONS)[number]) =>
    setOpen((prev) => ({ ...CLOSED_SECTIONS, [s]: !prev[s] }));
  const expandAll = () =>
    setOpen({
      Contact: true,
      Séjour: true,
      Activités: true,
      Paiements: true,
      Suivi: true,
    });
  const collapseAll = () =>
    setOpen({
      Contact: false,
      Séjour: false,
      Activités: false,
      Paiements: false,
      Suivi: false,
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-[6px] border border-[#eaeaea] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <input
            value={client.nom}
            onChange={(e) => onChange({ nom: e.target.value })}
            placeholder="Nom du client"
            className="font-heading min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold text-[#171717] hover:border-neutral-200 focus:border-[#171717] focus:outline-none"
          />
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => handleDownload("devis")}
              disabled={generatingDoc !== null}
              className="whitespace-nowrap rounded-md border border-[#666666]/30 px-3 py-1.5 text-sm text-[#171717] hover:bg-[#fafafa] disabled:opacity-50"
            >
              {generatingDoc === "devis" ? "Génération…" : "Devis (PDF)"}
            </button>
            <button
              onClick={() => handleDownload("facture")}
              disabled={generatingDoc !== null}
              className="whitespace-nowrap rounded-md border border-[#666666]/30 px-3 py-1.5 text-sm text-[#171717] hover:bg-[#fafafa] disabled:opacity-50"
            >
              {generatingDoc === "facture" ? "Génération…" : "Facture (PDF)"}
            </button>
            {canDelete && (
              <button
                onClick={onDelete}
                className="whitespace-nowrap rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Supprimer ce client
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className="rounded-full px-3 py-1 font-medium text-white"
            style={{ backgroundColor: STATUT_COLORS[client.statut] }}
          >
            {client.statut}
          </span>
          {client.hotel && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
              ⌂ {client.hotel}
            </span>
          )}
          {(client.date_debut || client.date_fin) && (
            <span className="font-amounts rounded-full bg-[#C9973E]/20 px-3 py-1 text-[#666666]">
              {fmtDate(client.date_debut)} → {fmtDate(client.date_fin)}
            </span>
          )}
        </div>
        {totalPersonnes > 0 && (
          <div className="mt-1.5 text-xs text-neutral-500">
            {[
              client.adultes ? `${client.adultes} adulte${client.adultes > 1 ? "s" : ""}` : "",
              client.enfants ? `${client.enfants} enfant${client.enfants > 1 ? "s" : ""}` : "",
              client.bebes ? `${client.bebes} bébé${client.bebes > 1 ? "s" : ""}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        <TagEditor tags={client.tags || []} onChange={(tags) => onChange({ tags })} />
      </div>

      {autresSejours.length > 0 && (
        <div className="rounded-lg border border-[#C9973E]/40 bg-[#C9973E]/10 p-4">
          <p className="text-sm text-[#666666]">
            🔁 Ce client est déjà venu — {autresSejours.length} autre(s) séjour(s) enregistré(s) :
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {autresSejours.map((c) => (
              <button
                key={c.id}
                onClick={() => onJumpToClient(c.id)}
                className="rounded-full bg-white px-3 py-1 text-xs text-[#171717] hover:bg-neutral-50"
              >
                {c.nom || "Sans nom"} — {fmtDate(c.date_debut)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs">
        <button
          onClick={() => onDuplicateAsNewStay(client)}
          className="text-[#171717] hover:underline"
        >
          + Nouveau séjour pour ce même client
        </button>
        <div className="flex gap-3">
          <button onClick={expandAll} className="text-[#171717] hover:underline">
            Tout déplier
          </button>
          <button onClick={collapseAll} className="text-neutral-400 hover:underline">
            Tout replier
          </button>
        </div>
      </div>

      <Section title="Contact" open={open.Contact} onToggle={() => toggle("Contact")}>
        <ContactStep client={client} onChange={onChange} />
      </Section>

      <Section title="Séjour" open={open.Séjour} onToggle={() => toggle("Séjour")}>
        <SejourStep
          client={client}
          onChange={onChange}
          hotelsRef={hotelsRef}
          taxesRef={taxesRef}
          onOpenHelp={onOpenHelp}
        />
      </Section>

      <Section title="Activités réservées" open={open.Activités} onToggle={() => toggle("Activités")}>
        <ActivitesStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          onAddReservation={addReservation}
          onUpdateReservation={updateReservation}
          onDeleteReservation={deleteReservation}
          onAddOption={addOption}
          onUpdateOption={updateOption}
          onDeleteOption={deleteOption}
          onAddTarif={addTarif}
          onUpdateTarif={updateTarif}
          onDeleteTarif={deleteTarif}
          catalogue={catalogue}
          catalogueTarifs={catalogueTarifs}
          canSeeMargins={canSeeMargins}
          hotelHorsHurghada={hotelHorsHurghada}
          coutsMap={coutsMap}
          onUpdateCoutReel={updateCoutReel}
        />
      </Section>

      <Section
        title="Paiements"
        titleExtra={
          <span className="flex items-center gap-1.5">
            <span className="font-amounts rounded-full bg-[#C9973E]/20 px-2 py-0.5 text-xs font-semibold text-[#666666]">
              {euros(totalSejourHeader)} €
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                paiementFullyPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {paiementFullyPaid ? "Payé" : "En attente"}
            </span>
          </span>
        }
        open={open.Paiements}
        onToggle={() => toggle("Paiements")}
      >
        <PaiementsStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
        />
      </Section>

      <Section title="Suivi" open={open.Suivi} onToggle={() => toggle("Suivi")}>
        <SuiviStep client={client} onChange={onChange} reservations={reservations} />
      </Section>
    </div>
  );
}

const TAG_SUGGESTIONS = ["VIP", "Récurrent", "Urgent"];

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean || tags.includes(clean)) return;
    onChange([...tags, clean]);
    setInput("");
  };
  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const availableSuggestions = TAG_SUGGESTIONS.filter((s) => !tags.includes(s));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-[#171717] px-2.5 py-1 text-xs text-white"
        >
          {tag}
          <button onClick={() => removeTag(tag)} className="text-white/70 hover:text-white">
            ✕
          </button>
        </span>
      ))}
      {availableSuggestions.map((s) => (
        <button
          key={s}
          onClick={() => addTag(s)}
          className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs text-neutral-400 hover:border-[#171717] hover:text-[#171717]"
        >
          + {s}
        </button>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
        }}
        placeholder="+ étiquette…"
        className="w-24 border-b border-transparent bg-transparent px-1 py-1 text-xs text-neutral-500 outline-none focus:border-neutral-300"
      />
    </div>
  );
}
