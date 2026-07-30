"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem, Client, Reservation, ReservationOption } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import {
  ActivitesStep,
  BilletAvionStep,
  ContactStep,
  PaiementsStep,
  SejourStep,
  SuiviStep,
} from "@/components/client-steps";

const STEPS = ["Contact", "Séjour", "Billet d'avion", "Activités", "Paiements", "Suivi"];

export default function ClientDetail({
  client,
  onChange,
  onDelete,
  catalogue,
}: {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
  onDelete: () => void;
  catalogue: CatalogueItem[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const confirm = useConfirm();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resaOptions, setResaOptions] = useState<Record<string, ReservationOption[]>>({});

  useEffect(() => {
    setStep(0);
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <input
          value={client.nom}
          onChange={(e) => onChange({ nom: e.target.value })}
          placeholder="Nom du client"
          className="font-heading w-full max-w-md rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold text-[#5C2A1D] hover:border-neutral-200 focus:border-[#0F5C56] focus:outline-none"
        />
        <button
          onClick={onDelete}
          className="whitespace-nowrap rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
        >
          Supprimer ce client
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              i === step
                ? "bg-[#0F5C56] text-white"
                : "bg-white text-[#5C2A1D] hover:bg-[#F2E6D2]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && <ContactStep client={client} onChange={onChange} />}
      {step === 1 && <SejourStep client={client} onChange={onChange} />}
      {step === 2 && (
        <BilletAvionStep client={client} onChange={onChange} reservations={reservations} />
      )}
      {step === 3 && (
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
        />
      )}
      {step === 4 && (
        <PaiementsStep
          client={client}
          onChange={onChange}
          reservations={reservations}
          resaOptions={resaOptions}
        />
      )}
      {step === 5 && (
        <SuiviStep client={client} onChange={onChange} reservations={reservations} />
      )}

      <div className="mt-8 flex items-center justify-between border-t border-[#8B4531]/10 pt-4">
        <button
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-md border border-[#8B4531]/30 px-3 py-1.5 text-sm text-[#5C2A1D] disabled:opacity-30"
        >
          ← Précédent
        </button>
        <span className="text-xs text-neutral-500">
          Étape {step + 1} / {STEPS.length}
        </span>
        <button
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          className="rounded-md border border-[#8B4531]/30 px-3 py-1.5 text-sm text-[#5C2A1D] disabled:opacity-30"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
