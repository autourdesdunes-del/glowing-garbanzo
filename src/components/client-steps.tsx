"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CatalogueItem,
  Client,
  Paiement,
  Remboursement,
  Reservation,
  ReservationOption,
  Verification,
} from "@/lib/types";
import {
  BILLET_STATUTS,
  CANAUX,
  INFOS_MANQUANTES_OPTIONS,
  MODES_PAIEMENT,
  RAISONS_REMBOURSEMENT,
  RELATIONS,
  STATUTS,
} from "@/lib/constants";
import { resaTotalMontant } from "@/lib/resa";
import ReservationCard from "@/components/ReservationCard";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

type StepProps = {
  client: Client;
  onChange: (patch: Partial<Client>) => void;
};

export function ContactStep({ client, onChange }: StepProps) {
  const toggleInfoManquante = (opt: string) => {
    const has = client.infos_manquantes.includes(opt);
    onChange({
      infos_manquantes: has
        ? client.infos_manquantes.filter((o) => o !== opt)
        : [...client.infos_manquantes, opt],
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Contact</h2>

      <Field label="Nom du client">
        <input
          value={client.nom}
          onChange={(e) => onChange({ nom: e.target.value })}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Statut">
          <select
            value={client.statut}
            onChange={(e) => onChange({ statut: e.target.value })}
            className="input"
          >
            {STATUTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Contact via">
          <select
            value={client.canal}
            onChange={(e) => onChange({ canal: e.target.value })}
            className="input"
          >
            {CANAUX.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      {client.canal === "Autre" && (
        <Field label="Préciser le canal">
          <input
            value={client.canal_autre}
            onChange={(e) => onChange({ canal_autre: e.target.value })}
            className="input"
          />
        </Field>
      )}

      {(client.canal === "Instagram" || client.canal === "TikTok") && (
        <Field label={`Pseudo ${client.canal}`}>
          <input
            value={client.pseudo_contact}
            onChange={(e) => onChange({ pseudo_contact: e.target.value })}
            className="input"
          />
        </Field>
      )}

      <Field label="Relation grâce à">
        <select
          value={client.relation_grace_a}
          onChange={(e) => onChange({ relation_grace_a: e.target.value })}
          className="input"
        >
          {RELATIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      {client.relation_grace_a === "Autre" && (
        <Field label="Préciser la relation">
          <input
            value={client.relation_autre}
            onChange={(e) => onChange({ relation_autre: e.target.value })}
            className="input"
          />
        </Field>
      )}

      <Field label="Téléphone / WhatsApp">
        <input
          value={client.telephone}
          onChange={(e) => onChange({ telephone: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Infos manquantes">
        <div className="flex flex-wrap gap-2">
          {INFOS_MANQUANTES_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleInfoManquante(opt)}
              className={`rounded-full border px-3 py-1 text-xs ${
                client.infos_manquantes.includes(opt)
                  ? "border-[#C9973E] bg-[#C9973E] text-white"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {client.infos_manquantes.includes("Autre") && (
          <input
            value={client.info_manquante_autre}
            onChange={(e) => onChange({ info_manquante_autre: e.target.value })}
            placeholder="Préciser"
            className="input mt-2 max-w-xs"
          />
        )}
      </Field>

      <details className="rounded-md border border-neutral-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-[#5C2A1D]">
          Plus de champs
        </summary>
        <div className="mt-3 space-y-4">
          <Field label="Email">
            <input
              value={client.email}
              onChange={(e) => onChange({ email: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Lien passeport (Drive)">
            <input
              value={client.lien_passeport}
              onChange={(e) => onChange({ lien_passeport: e.target.value })}
              className="input"
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

export function SejourStep({ client, onChange }: StepProps) {
  const copyBlock = `Name : ${client.nom || "—"}\n${client.adultes || 0} adults\nHotel : ${
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
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Séjour</h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date début séjour">
          <input
            type="date"
            value={client.date_debut ?? ""}
            onChange={(e) => onChange({ date_debut: e.target.value || null })}
            className="input"
          />
        </Field>
        <Field label="Date fin séjour">
          <input
            type="date"
            value={client.date_fin ?? ""}
            onChange={(e) => onChange({ date_fin: e.target.value || null })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Hôtel">
        <input
          value={client.hotel}
          onChange={(e) => onChange({ hotel: e.target.value })}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Adultes">
          <input
            type="number"
            min={0}
            value={client.adultes}
            onChange={(e) => onChange({ adultes: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Enfants">
          <input
            type="number"
            min={0}
            value={client.enfants}
            onChange={(e) => onChange({ enfants: Number(e.target.value) })}
            className="input"
          />
        </Field>
      </div>

      <details className="rounded-md border border-neutral-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-[#5C2A1D]">
          Plus de champs
        </summary>
        <div className="mt-3 space-y-4">
          <Field label="N° de chambre">
            <input
              value={client.chambre}
              onChange={(e) => onChange({ chambre: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Âges des enfants">
            <input
              value={client.ages_enfants}
              onChange={(e) => onChange({ ages_enfants: e.target.value })}
              placeholder="ex. 7 et 4 ans"
              className="input"
            />
          </Field>
          <Field label="Noms des participants">
            <input
              value={client.participant_noms}
              onChange={(e) => onChange({ participant_noms: e.target.value })}
              placeholder="Saisie manuelle"
              className="input"
            />
          </Field>
        </div>
      </details>

      <div className="rounded-md border border-[#8B4531]/20 bg-white p-4">
        <h3 className="font-heading text-sm font-semibold text-[#5C2A1D]">
          Bloc pour l&apos;équipe Égypte
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          La date et le détail de l&apos;activité restent à taper à la main — ce bloc ne
          couvre que la partie client.
        </p>
        <pre className="font-amounts mt-2 whitespace-pre-wrap rounded-md bg-[#F2E6D2] p-3 text-xs">
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

export function BilletAvionStep({
  client,
  onChange,
  reservations,
}: StepProps & { reservations: Reservation[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">
          Billet d&apos;avion
        </h2>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={client.billet_requis}
            onChange={(e) => onChange({ billet_requis: e.target.checked })}
          />
          Ce client a un billet à gérer
        </label>
      </div>

      {client.billet_requis && (
        <>
          <Field label="Statut">
            <select
              value={client.billet_statut}
              onChange={(e) => onChange({ billet_statut: e.target.value })}
              className="input"
            >
              {BILLET_STATUTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Date du billet">
            <input
              type="date"
              value={client.billet_date ?? ""}
              onChange={(e) => onChange({ billet_date: e.target.value || null })}
              className="input"
            />
          </Field>
          <Field label="Activité liée">
            <select
              value={client.billet_activite_id ?? ""}
              onChange={(e) => onChange({ billet_activite_id: e.target.value || null })}
              className="input"
            >
              <option value="">Non liée</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom_activite || "Activité sans nom"}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Acompte billet payé">
              <select
                value={client.billet_acompte_paye ? "Oui" : "Non"}
                onChange={(e) =>
                  onChange({ billet_acompte_paye: e.target.value === "Oui" })
                }
                className="input"
              >
                <option>Non</option>
                <option>Oui</option>
              </select>
            </Field>
            <Field label="Billet envoyé au client">
              <select
                value={client.billet_envoye ? "Oui" : "Non"}
                onChange={(e) => onChange({ billet_envoye: e.target.value === "Oui" })}
                className="input"
              >
                <option>Non</option>
                <option>Oui</option>
              </select>
            </Field>
          </div>
          <Field label="Lien billet (Drive)">
            <input
              value={client.billet_lien}
              onChange={(e) => onChange({ billet_lien: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Notes pour Hossam">
            <input
              value={client.billet_notes}
              onChange={(e) => onChange({ billet_notes: e.target.value })}
              className="input"
            />
          </Field>
        </>
      )}
    </div>
  );
}

export function ActivitesStep({
  client,
  onChange,
  reservations,
  resaOptions,
  onAddReservation,
  onUpdateReservation,
  onDeleteReservation,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  catalogue,
}: StepProps & {
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  onAddReservation: () => void;
  onUpdateReservation: (id: string, patch: Partial<Reservation>) => void;
  onDeleteReservation: (id: string) => void;
  onAddOption: (resaId: string) => void;
  onUpdateOption: (resaId: string, optId: string, patch: Partial<ReservationOption>) => void;
  onDeleteOption: (resaId: string, optId: string) => void;
  catalogue: CatalogueItem[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">
          Activités réservées
        </h2>
        <button
          onClick={onAddReservation}
          className="rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Ajouter une activité
        </button>
      </div>

      {reservations.length === 0 && (
        <div className="text-sm text-neutral-400">Aucune activité.</div>
      )}

      {reservations.map((r) => (
        <ReservationCard
          key={r.id}
          r={r}
          client={client}
          options={resaOptions[r.id] || []}
          expanded={!!expanded[r.id]}
          onToggleExpanded={(v) => setExpanded((prev) => ({ ...prev, [r.id]: v }))}
          onUpdate={(patch) => onUpdateReservation(r.id, patch)}
          onDelete={() => onDeleteReservation(r.id)}
          onAddOption={() => onAddOption(r.id)}
          onUpdateOption={(optId, patch) => onUpdateOption(r.id, optId, patch)}
          onDeleteOption={(optId) => onDeleteOption(r.id, optId)}
          onToggleSoldePaye={() => onChange({ solde_paye: !client.solde_paye })}
          catalogue={catalogue}
        />
      ))}
    </div>
  );
}

export function PaiementsStep({
  client,
  onChange,
  reservations,
  resaOptions,
}: StepProps & { reservations: Reservation[]; resaOptions: Record<string, ReservationOption[]> }) {
  const supabase = createClient();
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    (async () => {
      const { data, error } = await supabase
        .from("paiements")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      if (!error && data) setPaiements(data as Paiement[]);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const addPaiement = async () => {
    const { data, error } = await supabase
      .from("paiements")
      .insert({ client_id: client.id, montant: 0, mode: "PayPal", date: null })
      .select()
      .single();
    if (!error && data) setPaiements((prev) => [...prev, data as Paiement]);
  };

  const updatePaiement = async (id: string, patch: Partial<Paiement>) => {
    setPaiements((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await supabase.from("paiements").update(patch).eq("id", id);
  };

  const deletePaiement = async (id: string) => {
    setPaiements((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("paiements").delete().eq("id", id);
  };

  const totalSejour = reservations.reduce(
    (sum, r) => sum + resaTotalMontant(r, client, resaOptions[r.id] || []),
    0
  );
  const totalPaye =
    paiements.reduce((sum, p) => sum + (Number(p.montant) || 0), 0) +
    (client.solde_paye ? Number(client.solde_montant) || 0 : 0);
  const reste = totalSejour - totalPaye;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Paiements</h2>

      <div className="rounded-md bg-white p-3 text-sm text-neutral-600">
        Total séjour (calculé automatiquement) : <strong>{euros(totalSejour)} €</strong>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">
          Acompte(s) à la réservation
        </h3>
        {loaded && paiements.length === 0 && (
          <div className="text-sm text-neutral-400">Aucun acompte.</div>
        )}
        <div className="space-y-3">
          {paiements.map((p) => (
            <div key={p.id} className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Montant (€)">
                  <input
                    type="number"
                    value={p.montant}
                    onChange={(e) =>
                      updatePaiement(p.id, { montant: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Mode">
                  <select
                    value={p.mode}
                    onChange={(e) => updatePaiement(p.id, { mode: e.target.value })}
                    className="input"
                  >
                    {MODES_PAIEMENT.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    value={p.date ?? ""}
                    onChange={(e) => updatePaiement(p.id, { date: e.target.value || null })}
                    className="input"
                  />
                </Field>
              </div>
              <button
                onClick={() => deletePaiement(p.id)}
                className="mt-2 text-xs text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addPaiement}
          className="mt-3 rounded-md bg-[#C9973E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          + Ajouter un acompte
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">
          Solde (un seul, pour tout le séjour)
        </h3>
        <div className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant du solde (€)">
              <input
                type="number"
                value={client.solde_montant}
                onChange={(e) => onChange({ solde_montant: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Mode">
              <select
                value={client.solde_mode}
                onChange={(e) => onChange({ solde_mode: e.target.value })}
                className="input"
              >
                {MODES_PAIEMENT.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={client.solde_date ?? ""}
                onChange={(e) => onChange({ solde_date: e.target.value || null })}
                className="input"
              />
            </Field>
            <Field label="Où est-il réglé ?">
              <select
                value={client.solde_activite_id ?? ""}
                onChange={(e) => onChange({ solde_activite_id: e.target.value || null })}
                className="input"
              >
                <option value="">RDV dédié à l&apos;hôtel</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    À l&apos;activité — {r.nom_activite || "Activité sans nom"}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {!client.solde_activite_id && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Field label="RDV — heure">
                <input
                  value={client.solde_rdv_heure}
                  onChange={(e) => onChange({ solde_rdv_heure: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="RDV — lieu">
                <input
                  value={client.solde_rdv_lieu}
                  onChange={(e) => onChange({ solde_rdv_lieu: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Assigné à">
                <input
                  value={client.solde_assigne_a}
                  onChange={(e) => onChange({ solde_assigne_a: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={client.solde_paye}
              onChange={(e) => onChange({ solde_paye: e.target.checked })}
            />
            Solde encaissé
          </label>
        </div>
      </div>

      <div className="rounded-md bg-white p-3 text-sm text-neutral-600">
        Payé : <strong>{euros(totalPaye)} €</strong> — Reste à payer :{" "}
        <strong>{euros(reste)} €</strong>
      </div>
    </div>
  );
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function SuiviStep({
  client,
  onChange,
  reservations,
}: StepProps & { reservations: Reservation[] }) {
  const supabase = createClient();
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verifNom, setVerifNom] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: rembs }, { data: verifs }] = await Promise.all([
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
      ]);
      setRemboursements((rembs as Remboursement[]) || []);
      setVerifications((verifs as Verification[]) || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const addRemboursement = async () => {
    const { data, error } = await supabase
      .from("remboursements")
      .insert({ client_id: client.id })
      .select()
      .single();
    if (!error && data) setRemboursements((prev) => [...prev, data as Remboursement]);
  };

  const updateRemboursement = async (id: string, patch: Partial<Remboursement>) => {
    setRemboursements((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await supabase.from("remboursements").update(patch).eq("id", id);
  };

  const deleteRemboursement = async (id: string) => {
    setRemboursements((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("remboursements").delete().eq("id", id);
  };

  const addVerification = async () => {
    if (!verifNom.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("verifications")
      .insert({ client_id: client.id, nom: verifNom.trim(), date: today })
      .select()
      .single();
    if (!error && data) setVerifications((prev) => [...prev, data as Verification]);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#5C2A1D]">Suivi</h2>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#5C2A1D]">Remboursements</h3>
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
        <div className="space-y-3">
          {remboursements.map((r) => (
            <div key={r.id} className="rounded-md border border-neutral-200 bg-white p-3">
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
                <Field label="Activité liée">
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
                <Field label="Date du problème">
                  <input
                    type="date"
                    value={r.date_probleme ?? ""}
                    onChange={(e) =>
                      updateRemboursement(r.id, { date_probleme: e.target.value || null })
                    }
                    className="input"
                  />
                </Field>
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
              <button
                onClick={() => deleteRemboursement(r.id)}
                className="mt-2 text-xs text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#5C2A1D]">Vérification du dossier</h3>
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

      <Field label="Commentaires internes">
        <textarea
          value={client.commentaires}
          onChange={(e) => onChange({ commentaires: e.target.value })}
          className="input h-24"
        />
      </Field>
    </div>
  );
}
