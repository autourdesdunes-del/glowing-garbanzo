"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { ActivitesStep, Field, PaiementsStep } from "@/components/client-steps";
import PassportPhotosUpload from "@/components/PassportPhotosUpload";
import DuplicateClientModal from "@/components/DuplicateClientModal";
import { CANAUX, RELATIONS } from "@/lib/constants";
import {
  CatalogueItem,
  CatalogueOption,
  CatalogueTarif,
  CatalogueTransfertTarif,
  Client,
  HotelReference,
  Reservation,
  ReservationOption,
  ReservationTarif,
  TransfertTaxe,
} from "@/lib/types";
import { matchHotel } from "@/lib/hotelHelp";
import { DuplicateMatch, findDuplicateClients } from "@/lib/duplicates";

type StepId =
  | "nom"
  | "statut"
  | "canal"
  | "canal_autre"
  | "pseudo"
  | "relation"
  | "relation_autre"
  | "telephone"
  | "email"
  | "passeport"
  | "infos_manquantes"
  | "date_debut"
  | "date_fin"
  | "hotel"
  | "chambre"
  | "adultes"
  | "enfants"
  | "ages_enfants"
  | "bebes"
  | "ages_bebes"
  | "ados"
  | "activites"
  | "paiements"
  | "done";

// Contact puis Séjour, un champ à la fois — beaucoup de champs à remplir
// dans un dossier, on les fait défiler un par un plutôt qu'un long
// formulaire. Les étapes conditionnelles (canal_autre, pseudo…) ne
// s'insèrent que si la réponse précédente les rend pertinentes.
// Activités et Paiements sont trop imbriqués (éditeur de réservation,
// règle du solde unique) pour être redécoupés sans risque — on réutilise
// les écrans existants du dossier tels quels, comme deux étapes de plus.
function buildSteps(a: Partial<Client>): StepId[] {
  const steps: StepId[] = ["nom", "statut", "canal"];
  if (a.canal === "Autre") steps.push("canal_autre");
  if (a.canal === "Instagram" || a.canal === "TikTok") steps.push("pseudo");
  steps.push("relation");
  if (a.relation_grace_a === "Autre") steps.push("relation_autre");
  steps.push("telephone", "email", "passeport", "infos_manquantes");
  steps.push("date_debut", "date_fin", "hotel", "chambre", "adultes", "enfants");
  if ((a.enfants ?? 0) > 0) steps.push("ages_enfants");
  steps.push("bebes");
  if ((a.bebes ?? 0) > 0) steps.push("ages_bebes");
  steps.push("ados", "activites", "paiements", "done");
  return steps;
}

const CONTACT_STEPS: StepId[] = [
  "nom",
  "statut",
  "canal",
  "canal_autre",
  "pseudo",
  "relation",
  "relation_autre",
  "telephone",
  "email",
  "passeport",
  "infos_manquantes",
];

const WIDE_STEPS: StepId[] = ["activites", "paiements"];

function sectionLabel(step: StepId): string {
  if (CONTACT_STEPS.includes(step)) return "Contact";
  if (step === "activites") return "Activités";
  if (step === "paiements") return "Paiements";
  return "Séjour";
}

export default function QuickAddClient({
  onCreate,
  onUpdateClient,
  clients = [],
  onDeleteClient,
  onOpenClient,
  defaultStatut = "Prospect",
}: {
  onCreate: (fields: {
    nom: string;
    telephone: string;
    canal: string;
    statut: "Prospect" | "Client confirmé";
  }) => Promise<Client | null>;
  onUpdateClient: (id: string, patch: Partial<Client>) => void;
  clients?: Client[];
  onDeleteClient?: (id: string) => Promise<boolean> | void;
  onOpenClient?: (id: string) => void;
  defaultStatut?: "Prospect" | "Client confirmé";
}) {
  const supabase = createClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [nomDraft, setNomDraft] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Partial<Client>>({});
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([]);
  const [infoOptions, setInfoOptions] = useState<string[]>([]);
  const [newInfoLabel, setNewInfoLabel] = useState("");
  const [hotelsRef, setHotelsRef] = useState<HotelReference[]>([]);
  const [taxesRef, setTaxesRef] = useState<TransfertTaxe[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueTarifs, setCatalogueTarifs] = useState<Record<string, CatalogueTarif[]>>({});
  const [transfertTarifs, setTransfertTarifs] = useState<Record<string, CatalogueTransfertTarif[]>>(
    {}
  );
  const [catalogueOptions, setCatalogueOptions] = useState<Record<string, CatalogueOption[]>>({});
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resaOptions, setResaOptions] = useState<Record<string, ReservationOption[]>>({});
  const [resaTarifs, setResaTarifs] = useState<Record<string, ReservationTarif[]>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [
        { data: h },
        { data: t },
        { data: opts },
        { data: cat },
        { data: catTarifs },
        { data: transfertTarifsData },
        { data: catOptions },
      ] = await Promise.all([
        supabase.from("hotels_reference").select("*"),
        supabase.from("transfert_taxes").select("*"),
        supabase.from("infos_manquantes_options").select("label").order("created_at", { ascending: true }),
        supabase.from("catalogue_activites").select("*").order("created_at", { ascending: false }),
        supabase.from("catalogue_tarifs").select("*"),
        supabase.from("transfert_tarifs").select("*").order("ordre", { ascending: true }),
        supabase.from("catalogue_options").select("*"),
      ]);
      setHotelsRef((h as HotelReference[]) || []);
      setTaxesRef((t as TransfertTaxe[]) || []);
      const fetched = ((opts as { label: string }[]) || []).map((o) => o.label);
      setInfoOptions(
        fetched.length
          ? fetched
          : ["Complet", "Room number", "Date de RDV", "Numéro WhatsApp", "Billets d'avion", "Passeport", "Acompte PayPal", "Localisation", "Ticket de train"]
      );
      setCatalogue((cat as CatalogueItem[]) || []);
      const groupedCatTarifs: Record<string, CatalogueTarif[]> = {};
      ((catTarifs as CatalogueTarif[]) || []).forEach((t2) => {
        groupedCatTarifs[t2.catalogue_item_id] = [...(groupedCatTarifs[t2.catalogue_item_id] || []), t2];
      });
      setCatalogueTarifs(groupedCatTarifs);
      const groupedTransfertTarifs: Record<string, CatalogueTransfertTarif[]> = {};
      ((transfertTarifsData as CatalogueTransfertTarif[]) || []).forEach((t3) => {
        groupedTransfertTarifs[t3.catalogue_item_id] = [
          ...(groupedTransfertTarifs[t3.catalogue_item_id] || []),
          t3,
        ];
      });
      setTransfertTarifs(groupedTransfertTarifs);
      const groupedCatOptions: Record<string, CatalogueOption[]> = {};
      ((catOptions as CatalogueOption[]) || []).forEach((o2) => {
        groupedCatOptions[o2.catalogue_item_id] = [...(groupedCatOptions[o2.catalogue_item_id] || []), o2];
      });
      setCatalogueOptions(groupedCatOptions);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setOpen(false);
    setStepIdx(0);
    setNomDraft("");
    setClientId(null);
    setAnswers({});
    setNewInfoLabel("");
    setReservations([]);
    setResaOptions({});
    setResaTarifs({});
    setDupMatches([]);
  };

  const patch = (fields: Partial<Client>) => {
    setAnswers((prev) => ({ ...prev, ...fields }));
    if (clientId) onUpdateClient(clientId, fields);
  };

  const handleBusEscalation = async (nomActivite: string, reservationId: string) => {
    if (!clientId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    await supabase.from("bus_escalations").insert({
      client_id: clientId,
      client_nom: answers.nom || "",
      reservation_id: reservationId,
      nom_activite: nomActivite,
      employe_id: user.id,
      employe_nom: employeNom,
    });
  };

  const handleAssouanVerification = async (nomActivite: string, reservationId: string) => {
    if (!clientId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    await supabase.from("assouan_verifications").insert({
      client_id: clientId,
      client_nom: answers.nom || "",
      reservation_id: reservationId,
      nom_activite: nomActivite,
      employe_id: user.id,
      employe_nom: employeNom,
    });
  };

  const handleJourEscalation = async (
    nomActivite: string,
    reservationId: string,
    dateChoisie: string,
    jourChoisi: string,
    joursDisponibles: string[]
  ) => {
    if (!clientId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, email")
      .eq("id", user.id)
      .single();
    const employeNom = prof?.prenom || (prof?.email || "").split("@")[0] || "Quelqu'un de l'équipe";
    await supabase.from("jour_escalations").insert({
      client_id: clientId,
      client_nom: answers.nom || "",
      reservation_id: reservationId,
      nom_activite: nomActivite,
      date_choisie: dateChoisie,
      jour_choisi: jourChoisi,
      jours_disponibles: joursDisponibles,
      employe_id: user.id,
      employe_nom: employeNom,
    });
  };

  const steps = buildSteps(answers);
  const step = steps[stepIdx];

  const goNext = async () => {
    if (step === "nom") {
      if (!nomDraft.trim()) return;
      setCreating(true);
      try {
        const created = await onCreate({
          nom: nomDraft.trim(),
          telephone: "",
          canal: "WhatsApp",
          statut: defaultStatut,
        });
        if (!created) return;
        setClientId(created.id);
        setAnswers(created);
        setDupMatches(findDuplicateClients({ nom: created.nom }, clients, created.id));
        setStepIdx(1);
      } catch {
        toast("Impossible de créer le client — réessaie.");
      } finally {
        setCreating(false);
      }
      return;
    }
    if (step === "telephone" && (answers.telephone || "").trim()) {
      setDupMatches(findDuplicateClients({ telephone: answers.telephone }, clients, clientId));
    }
    if (step === "pseudo" && (answers.pseudo_contact || "").trim()) {
      setDupMatches(findDuplicateClients({ pseudo_contact: answers.pseudo_contact }, clients, clientId));
    }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const handleDeleteDuplicate = async (id: string) => {
    if (!onDeleteClient) return;
    const deleted = await onDeleteClient(id);
    if (deleted === false) return;
    setDupMatches([]);
    if (id === clientId) reset();
  };

  const toggleInfoManquante = (opt: string) => {
    const has = (answers.infos_manquantes || []).includes(opt);
    patch({
      infos_manquantes: has
        ? (answers.infos_manquantes || []).filter((o) => o !== opt)
        : [...(answers.infos_manquantes || []), opt],
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
    if (!(answers.infos_manquantes || []).includes(clean)) {
      patch({ infos_manquantes: [...(answers.infos_manquantes || []), clean] });
    }
    setNewInfoLabel("");
  };

  const hotelMatch = matchHotel(answers.hotel || "", hotelsRef);
  const taxeMatch = hotelMatch
    ? taxesRef.find((t) => t.ville.trim().toLowerCase() === hotelMatch.ville.trim().toLowerCase())
    : null;
  const hotelHorsHurghada = !!hotelMatch && !hotelMatch.sur_hurghada;

  const addReservation = async (): Promise<string | null> => {
    if (!clientId) return null;
    const { data, error } = await supabase
      .from("reservations")
      .insert({ client_id: clientId, transfert_inclus: !hotelHorsHurghada })
      .select()
      .single();
    if (!error && data) {
      setReservations((prev) => [...prev, data as Reservation]);
      return (data as Reservation).id;
    }
    toast("Impossible d'ajouter l'activité.");
    return null;
  };

  const updateReservation = async (id: string, resaPatch: Partial<Reservation>) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...resaPatch } : r)));
    const { error } = await supabase.from("reservations").update(resaPatch).eq("id", id);
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

  const addResaOption = async (resaId: string, seed?: { nom: string; prix: number }) => {
    const { data, error } = await supabase
      .from("reservation_options")
      .insert({ reservation_id: resaId, nom: seed?.nom || "Guide francophone", prix: seed?.prix || 0 })
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

  const updateResaOption = async (resaId: string, optId: string, optPatch: Partial<ReservationOption>) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((o) => (o.id === optId ? { ...o, ...optPatch } : o)),
    }));
    const { error } = await supabase.from("reservation_options").update(optPatch).eq("id", optId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteResaOption = async (resaId: string, optId: string) => {
    setResaOptions((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((o) => o.id !== optId),
    }));
    const { error } = await supabase.from("reservation_options").delete().eq("id", optId);
    if (error) toast("Échec de la suppression.");
  };

  const addResaTarif = async (resaId: string, seed?: { label: string; pu: number }) => {
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

  const updateResaTarif = async (resaId: string, tarifId: string, tarifPatch: Partial<ReservationTarif>) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).map((t) => (t.id === tarifId ? { ...t, ...tarifPatch } : t)),
    }));
    const { error } = await supabase.from("reservation_tarifs").update(tarifPatch).eq("id", tarifId);
    if (error) toast("Échec de l'enregistrement.");
  };

  const deleteResaTarif = async (resaId: string, tarifId: string) => {
    setResaTarifs((prev) => ({
      ...prev,
      [resaId]: (prev[resaId] || []).filter((t) => t.id !== tarifId),
    }));
    const { error } = await supabase.from("reservation_tarifs").delete().eq("id", tarifId);
    if (error) toast("Échec de la suppression.");
  };

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="whitespace-nowrap rounded-[6px] bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        + Nouveau
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div
            className={`w-full max-h-[90vh] overflow-y-auto rounded-[6px] border border-[#eaeaea] bg-white p-6 ${
              WIDE_STEPS.includes(step) ? "max-w-2xl" : "max-w-md"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[#171717]">
                  {step === "done"
                    ? "Dossier créé"
                    : defaultStatut === "Prospect"
                      ? "Nouveau prospect"
                      : "Nouveau client"}
                </h2>
                {step !== "nom" && step !== "done" && (
                  <p className="mt-0.5 text-xs text-[#666666]">
                    {sectionLabel(step)} — étape {stepIdx + 1}/{steps.length - 1}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-[#666666] hover:text-[#171717]"
              >
                ✕
              </button>
            </div>

            {step !== "nom" && step !== "done" && (
              <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-[#fafafa]">
                <div
                  className="h-full rounded-full bg-[#C9973E] transition-all"
                  style={{ width: `${(stepIdx / (steps.length - 1)) * 100}%` }}
                />
              </div>
            )}

            <div>
              {step === "nom" && (
                <Field label="Nom du client">
                  <input
                    autoFocus
                    required
                    value={nomDraft}
                    onChange={(e) => setNomDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        goNext();
                      }
                    }}
                    className="input"
                  />
                </Field>
              )}

              {step === "statut" && (
                <Field label="Statut">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => patch({ statut: "Prospect" })}
                      className={`flex-1 rounded-[6px] border px-3 py-1.5 text-sm font-medium ${
                        (answers.statut ?? defaultStatut) === "Prospect"
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-[#eaeaea] text-[#666666]"
                      }`}
                    >
                      Prospect
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ statut: "Client confirmé" })}
                      className={`flex-1 rounded-[6px] border px-3 py-1.5 text-sm font-medium ${
                        (answers.statut ?? defaultStatut) === "Client confirmé"
                          ? "border-[#171717] bg-[#171717] text-white"
                          : "border-[#eaeaea] text-[#666666]"
                      }`}
                    >
                      Client confirmé
                    </button>
                  </div>
                </Field>
              )}

              {step === "canal" && (
                <Field label="Contact via">
                  <select
                    autoFocus
                    value={answers.canal}
                    onChange={(e) => patch({ canal: e.target.value })}
                    className="input"
                  >
                    {CANAUX.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              )}

              {step === "canal_autre" && (
                <Field label="Préciser le canal">
                  <input
                    autoFocus
                    value={answers.canal_autre || ""}
                    onChange={(e) => patch({ canal_autre: e.target.value })}
                    className="input"
                  />
                </Field>
              )}

              {step === "pseudo" && (
                <Field label={`Pseudo ${answers.canal}`}>
                  <input
                    autoFocus
                    value={answers.pseudo_contact || ""}
                    onChange={(e) => patch({ pseudo_contact: e.target.value })}
                    className="input"
                  />
                </Field>
              )}

              {step === "relation" && (
                <Field label="Relation grâce à">
                  <select
                    autoFocus
                    value={answers.relation_grace_a}
                    onChange={(e) => patch({ relation_grace_a: e.target.value })}
                    className="input"
                  >
                    {RELATIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              )}

              {step === "relation_autre" && (
                <Field label="Préciser la relation">
                  <input
                    autoFocus
                    value={answers.relation_autre || ""}
                    onChange={(e) => patch({ relation_autre: e.target.value })}
                    className="input"
                  />
                </Field>
              )}

              {step === "telephone" && (
                <Field label="Téléphone / WhatsApp">
                  <input
                    autoFocus
                    value={answers.telephone || ""}
                    onChange={(e) => patch({ telephone: e.target.value })}
                    className="input"
                  />
                </Field>
              )}

              {step === "email" && (
                <Field label="Email">
                  <input
                    autoFocus
                    type="email"
                    value={answers.email || ""}
                    onChange={(e) => patch({ email: e.target.value })}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-[#666666]">
                    Obligatoire pour passer le dossier en &quot;Client confirmé&quot;.
                  </p>
                </Field>
              )}

              {step === "passeport" && (
                <PassportPhotosUpload
                  paths={answers.passeport_photos || []}
                  onChange={(passeport_photos) => patch({ passeport_photos })}
                />
              )}

              {step === "infos_manquantes" && (
                <div>
                  <span className="mb-1 block text-sm font-medium text-neutral-700">
                    Infos manquantes
                  </span>
                  <div className="rounded-md border border-neutral-300 bg-white p-2">
                    <div className="max-h-48 space-y-0.5 overflow-y-auto">
                      {infoOptions.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[#fafafa]"
                        >
                          <input
                            type="checkbox"
                            checked={(answers.infos_manquantes || []).includes(opt)}
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
                  </div>
                </div>
              )}

              {step === "date_debut" && (
                <Field label="Date début séjour">
                  <input
                    autoFocus
                    type="date"
                    value={answers.date_debut ?? ""}
                    onChange={(e) => patch({ date_debut: e.target.value || null })}
                    className="input"
                  />
                </Field>
              )}

              {step === "date_fin" && (
                <Field label="Date fin séjour">
                  <input
                    autoFocus
                    type="date"
                    value={answers.date_fin ?? ""}
                    onChange={(e) => patch({ date_fin: e.target.value || null })}
                    className="input"
                  />
                </Field>
              )}

              {step === "hotel" && (
                <>
                  <Field label="Hôtel">
                    <input
                      autoFocus
                      value={answers.hotel || ""}
                      onChange={(e) => patch({ hotel: e.target.value })}
                      className="input"
                    />
                  </Field>
                  {(answers.hotel || "").trim() &&
                    (hotelMatch ? (
                      hotelMatch.sur_hurghada ? (
                        <div className="mt-2 rounded-md bg-[#171717]/10 px-3 py-2 text-xs text-[#171717]">
                          ✓ Cet hôtel est bien sur Hurghada — pas de taxe de transfert.
                        </div>
                      ) : (
                        <div className="mt-2 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-700">
                          ⚠ Attention, cet hôtel n&apos;est pas sur Hurghada ({hotelMatch.ville}), il peut
                          comporter une taxe de transfert
                          {taxeMatch ? ` (${taxeMatch.montant} €)` : ""}.
                        </div>
                      )
                    ) : (
                      <div className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
                        Hôtel non répertorié dans HELP.
                      </div>
                    ))}
                </>
              )}

              {step === "chambre" && (
                <Field label="N° de chambre">
                  <input
                    autoFocus
                    value={answers.chambre || ""}
                    onChange={(e) => patch({ chambre: e.target.value })}
                    className="input"
                  />
                </Field>
              )}

              {step === "adultes" && (
                <Field label="Adultes">
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    value={answers.adultes ?? 0}
                    onChange={(e) => patch({ adultes: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
              )}

              {step === "enfants" && (
                <Field label="Enfants">
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    value={answers.enfants ?? 0}
                    onChange={(e) => patch({ enfants: Number(e.target.value) })}
                    className="input"
                  />
                </Field>
              )}

              {step === "ages_enfants" && (
                <Field label="Âge des enfants (4 à 10 ans)">
                  <input
                    autoFocus
                    value={answers.ages_enfants || ""}
                    onChange={(e) => patch({ ages_enfants: e.target.value })}
                    placeholder="ex. 7 et 4 ans"
                    className="input"
                  />
                </Field>
              )}

              {step === "bebes" && (
                <Field label="Bébés (0 à 3 ans)">
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    value={answers.bebes ?? 0}
                    onChange={(e) => patch({ bebes: Number(e.target.value) })}
                    className="input max-w-[140px]"
                  />
                </Field>
              )}

              {step === "ages_bebes" && (
                <Field label="Âge des bébés">
                  <input
                    autoFocus
                    value={answers.ages_bebes || ""}
                    onChange={(e) => patch({ ages_bebes: e.target.value })}
                    placeholder="ex. 1 an"
                    className="input"
                  />
                </Field>
              )}

              {step === "ados" && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={answers.ados_presents || false}
                      onChange={(e) => patch({ ados_presents: e.target.checked })}
                    />
                    Ados de moins de 16 ans présents parmi les adultes
                  </label>
                  {answers.ados_presents && (
                    <div className="mt-2">
                      <Field label="Âge des ados">
                        <input
                          value={answers.ages_ados || ""}
                          onChange={(e) => patch({ ages_ados: e.target.value })}
                          placeholder="ex. 13 et 14 ans"
                          className="input"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {step === "activites" && clientId && (
                <ActivitesStep
                  client={{ ...answers, id: clientId } as Client}
                  onChange={patch}
                  reservations={reservations}
                  resaOptions={resaOptions}
                  resaTarifs={resaTarifs}
                  onAddReservation={addReservation}
                  onUpdateReservation={updateReservation}
                  onDeleteReservation={deleteReservation}
                  onAddOption={addResaOption}
                  onUpdateOption={updateResaOption}
                  onDeleteOption={deleteResaOption}
                  onAddTarif={addResaTarif}
                  onUpdateTarif={updateResaTarif}
                  onDeleteTarif={deleteResaTarif}
                  catalogue={catalogue}
                  catalogueTarifs={catalogueTarifs}
                  transfertTarifs={transfertTarifs}
                  catalogueOptions={catalogueOptions}
                  canSeeMargins={false}
                  hotelHorsHurghada={hotelHorsHurghada}
                  coutsMap={{}}
                  onUpdateCoutReel={() => {}}
                  onBusEscalation={handleBusEscalation}
                  busEscalations={[]}
                  onJourEscalation={handleJourEscalation}
                  onAssouanVerification={handleAssouanVerification}
                  assouanVerifications={[]}
                />
              )}

              {step === "paiements" && clientId && (
                <PaiementsStep
                  client={{ ...answers, id: clientId } as Client}
                  onChange={patch}
                  reservations={reservations}
                  resaOptions={resaOptions}
                  resaTarifs={resaTarifs}
                  onUpdateReservation={updateReservation}
                />
              )}

              {step === "done" && (
                <div className="text-center">
                  <p className="text-sm text-[#171717]">
                    Le dossier de <strong>{answers.nom}</strong> est créé et enregistré.
                  </p>
                  <p className="mt-2 text-xs text-[#666666]">
                    Le suivi (au revoir, avis, relances…) se complète ensuite, à ton rythme, depuis
                    le dossier.
                  </p>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                {step !== "nom" && step !== "done" && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="rounded-[6px] border border-[#eaeaea] px-3 py-2 text-sm font-medium text-[#666666] hover:bg-[#fafafa]"
                  >
                    Précédent
                  </button>
                )}
                {step === "done" ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-[6px] bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Terminé
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={creating || (step === "nom" && !nomDraft.trim())}
                    className="flex-1 rounded-[6px] bg-[#171717] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {creating ? "Création…" : "Suivant"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {open && clientId && dupMatches.length > 0 && (
        <DuplicateClientModal
          current={{ ...answers, id: clientId } as Client}
          matches={dupMatches}
          onOpenClient={(id) => {
            reset();
            onOpenClient?.(id);
          }}
          onDeleteClient={handleDeleteDuplicate}
          onKeepBoth={() => setDupMatches([])}
        />
      )}
    </>
  );
}
