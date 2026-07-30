"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client, Reservation, ReservationOption } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import { STATUT_COLORS } from "@/lib/constants";
import {
  ActivitesStep,
  BilletAvionStep,
  ContactStep,
  PaiementsStep,
  SejourStep,
  SuiviStep,
} from "@/components/client-steps";

const SECTIONS = [
  "Contact",
  "Séjour",
  "Billet d'avion",
  "Activités",
  "Paiements",
  "Suivi",
] as const;

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#8B4531]/15 bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="font-heading text-sm font-semibold text-[#5C2A1D]">{title}</span>
        <span className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {open && <div className="border-t border-[#8B4531]/10 px-5 py-5">{children}</div>}
    </div>
  );
}

export default function ClientDetail({
  client,
  onChange,
  onDelete,
  canDelete,
  canSeeMargins,
  catalogue,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  onDelete: () => void;
  canDelete: boolean;
  canSeeMargins: boolean;
  catalogue: CatalogueItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState<Record<(typeof SECTIONS)[number], boolean>>({
    Contact: true,
    Séjour: true,
    "Billet d'avion": false,
    Activités: false,
    Paiements: false,
    Suivi: false,
  });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resaOptions, setResaOptions] = useState<Record<string, ReservationOption[]>>({});

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
        const { data: opts } = await supabase
          .from("reservation_options")
          .select("*")
          .in(
            "reservation_id",
            list.map((r) => r.id)
          );
        const grouped: Record<string, ReservationOption[]> = {};
        ((opts as ReservationOption[]) || []).forEach((o) => {
          grouped[o.reservation_id] = [...(grouped[o.reservation_id] || []), o];
        });
        setResaOptions(grouped);
      } else {
        setResaOptions({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const addReservation = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .insert({ client_id: client.id })
      .select()
      .single();
    if (!error && data) {
      setReservations((prev) => [...prev, data as Reservation]);
    } else {
      toast("Impossible d'ajouter l'activité.");
    }
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

  const toggle = (s: (typeof SECTIONS)[number]) =>
    setOpen((prev) => ({ ...prev, [s]: !prev[s] }));
  const expandAll = () =>
    setOpen({
      Contact: true,
      Séjour: true,
      "Billet d'avion": true,
      Activités: true,
      Paiements: true,
      Suivi: true,
    });
  const collapseAll = () =>
    setOpen({
      Contact: false,
      Séjour: false,
      "Billet d'avion": false,
      Activités: false,
      Paiements: false,
      Suivi: false,
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border border-[#8B4531]/15 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <input
            value={client.nom}
            onChange={(e) => onChange({ nom: e.target.value })}
            placeholder="Nom du client"
            className="font-heading min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold text-[#5C2A1D] hover:border-neutral-200 focus:border-[#5C2A1D] focus:outline-none"
          />
          {canDelete && (
            <button
              onClick={onDelete}
              className="whitespace-nowrap rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Supprimer ce client
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className="rounded-full px-2.5 py-1 font-medium text-white"
            style={{ backgroundColor: STATUT_COLORS[client.statut] }}
          >
            {client.statut}
          </span>
          {client.telephone && (
            <span className="rounded-full bg-[#F2E6D2] px-2.5 py-1 text-[#5C2A1D]">
              ☎ {client.telephone}
            </span>
          )}
          {client.hotel && (
            <span className="rounded-full bg-[#F2E6D2] px-2.5 py-1 text-[#5C2A1D]">
              ⌂ {client.hotel}
            </span>
          )}
          {(client.date_debut || client.date_fin) && (
            <span className="font-amounts rounded-full bg-[#F2E6D2] px-2.5 py-1 text-[#5C2A1D]">
              {fmtDate(client.date_debut)} → {fmtDate(client.date_fin)}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 text-xs">
        <button onClick={expandAll} className="text-[#5C2A1D] hover:underline">
          Tout déplier
        </button>
        <button onClick={collapseAll} className="text-neutral-400 hover:underline">
          Tout replier
        </button>
      </div>

      <Section title="Contact" open={open.Contact} onToggle={() => toggle("Contact")}>
        <ContactStep client={client} onChange={onChange} />
      </Section>

      <Section title="Séjour" open={open.Séjour} onToggle={() => toggle("Séjour")}>
        <SejourStep client={client} onChange={onChange} />
      </Section>

      <Section
        title="Billet d'avion"
        open={open["Billet d'avion"]}
        onToggle={() => toggle("Billet d'avion")}
      >
        <BilletAvionStep client={client} onChange={onChange} reservations={reservations} />
      </Section>

      <Section title="Activités réservées" open={open.Activités} onToggle={() => toggle("Activités")}>
        <ActivitesStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          resaOptions={resaOptions}
          onAddReservation={addReservation}
          onUpdateReservation={updateReservation}
          onDeleteReservation={deleteReservation}
          onAddOption={addOption}
          onUpdateOption={updateOption}
          onDeleteOption={deleteOption}
          catalogue={catalogue}
          canSeeMargins={canSeeMargins}
        />
      </Section>

      <Section title="Paiements" open={open.Paiements} onToggle={() => toggle("Paiements")}>
        <PaiementsStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          resaOptions={resaOptions}
        />
      </Section>

      <Section title="Suivi" open={open.Suivi} onToggle={() => toggle("Suivi")}>
        <SuiviStep client={client} onChange={onChange} reservations={reservations} />
      </Section>
    </div>
  );
}
