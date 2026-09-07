"use client";

import { useState } from "react";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { clientAPayeQuelqueChose, participantsFor, resaTotalMontant } from "@/lib/resa";
import { RAISONS_ANNULATION } from "@/lib/constants";
import { todayStr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import PaypalEmailPromptModal from "@/components/PaypalEmailPromptModal";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Retire une partie des participants d'une activité SANS l'annuler (ex.
// famille de 4 au quad, 2 annulent, 2 y vont quand même) — contrairement à
// AnnulerActiviteModal, statut_resa ne bouge jamais. Passe la réservation
// en mode "custom" avec les nouveaux effectifs (le total se recalcule tout
// seul via resaTotalMontant), garde une trace du nombre retiré/du motif
// pour le badge, et propose un remboursement de la différence si déjà payée.
export default function RetirerParticipantsModal({
  r,
  client,
  options,
  tarifs,
  onUpdate,
  onUpdateOption,
  onUpdateClient,
  onClose,
}: {
  r: Reservation;
  client: Client;
  options: ReservationOption[];
  tarifs: ReservationTarif[];
  onUpdate: (patch: Partial<Reservation>) => void;
  onUpdateOption: (optId: string, patch: Partial<ReservationOption>) => void;
  onUpdateClient?: (patch: Partial<Client>) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { nbAd, nbEnf, nbBebe, nbAcc, nbEnf3 } = participantsFor(r, client);
  const [adultesPartent, setAdultesPartent] = useState(0);
  const [enfantsPartent, setEnfantsPartent] = useState(0);
  const [date, setDate] = useState(todayStr());
  const [motif, setMotif] = useState("");
  const [motifAutre, setMotifAutre] = useState("");
  const [ajusterOptions, setAjusterOptions] = useState<"auto" | "manuel" | "">("");
  const [dejaPayee, setDejaPayee] = useState(clientAPayeQuelqueChose(client));
  const [remboursementChoix, setRemboursementChoix] = useState<"rembourse" | "avoir" | "">("");
  const [paypalEmail, setPaypalEmail] = useState(client.paypal_email || client.email || "");
  const [showPaypalPrompt, setShowPaypalPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const ancienTotal = resaTotalMontant(r, client, options, tarifs);
  const nouveauxAd = Math.max(nbAd - adultesPartent, 0);
  const nouveauxEnf = Math.max(nbEnf - enfantsPartent, 0);
  const rSimule: Reservation = {
    ...r,
    participants_mode: "custom",
    participants_adultes: nouveauxAd,
    participants_enfants: nouveauxEnf,
    participants_bebes: nbBebe,
    participants_accompagnateurs: nbAcc,
    participants_enfants_3ans: nbEnf3,
  };
  // Si "ajuster automatiquement" est choisi, les options sont elles aussi
  // réduites au moment de confirmer (voir doConfirm) — sans en tenir compte
  // ici, le total prévisualisé (et donc le remboursement suggéré)
  // ignorerait cette baisse, et le vrai total après confirmation serait
  // plus bas que ce qui a été annoncé à l'employée.
  const ratioParticipants = nbAd + nbEnf > 0 ? (nouveauxAd + nouveauxEnf) / (nbAd + nbEnf) : 1;
  const optionsSimulees =
    ajusterOptions === "auto"
      ? options.map((o) => ({ ...o, quantite: Math.max(Math.round((Number(o.quantite) || 0) * ratioParticipants), 0) }))
      : options;
  const nouveauTotal = resaTotalMontant(rSimule, client, optionsSimulees, tarifs);
  const difference = Math.max(ancienTotal - nouveauTotal, 0);
  const nbPartent = adultesPartent + enfantsPartent;
  // Part de l'avoir déjà consommé qui suit les participants qui partent,
  // au même ratio que les options (voir ratioParticipants ci-dessus) —
  // jamais de l'argent reçu par l'agence, donc jamais à rembourser en cash
  // (même principe que AnnulerActiviteModal.avoirDejaUtilise, adapté ici au
  // retrait PARTIEL : seule la part proportionnelle est libérée, le reste
  // continue de couvrir les participants qui restent).
  const avoirUtiliseAvant = Number(r.avoir_utilise) || 0;
  const avoirUtiliseApres = Math.round(avoirUtiliseAvant * ratioParticipants * 100) / 100;
  const avoirLibere = Math.max(avoirUtiliseAvant - avoirUtiliseApres, 0);
  const [montant, setMontant] = useState(0);
  // Le montant suggéré suit la différence (moins la part déjà couverte par
  // un avoir, restituée séparément ci-dessous) tant que l'employée ne l'a
  // pas modifié à la main (ex. frais déjà engagés non récupérables).
  const differenceCash = Math.max(difference - avoirLibere, 0);
  const montantAffiche = montant || differenceCash;

  const remboursementPossible = dejaPayee && differenceCash > 0;

  const confirmer = () => {
    if (nbPartent === 0) {
      toast("Indique au moins un participant qui annule.");
      return;
    }
    if (options.length > 0 && !ajusterOptions) {
      toast("Choisis ce qu'on fait des options (ajuster automatiquement ou revoir toi-même).");
      return;
    }
    if (motif === "Autre" && !motifAutre.trim()) {
      toast("Précise le motif.");
      return;
    }
    if (remboursementPossible && !remboursementChoix) {
      toast("Choisis remboursement ou avoir avant de confirmer.");
      return;
    }
    if (remboursementPossible && remboursementChoix === "rembourse" && !paypalEmail.trim()) {
      setShowPaypalPrompt(true);
      return;
    }
    doConfirm(paypalEmail);
  };

  const doConfirm = async (emailPourRemb: string) => {
    setSubmitting(true);
    const supabase = createClient();
    const motifFinal = motif === "Autre" ? motifAutre.trim() : motif;

    if (ajusterOptions === "auto" && options.length > 0) {
      options.forEach((o) => {
        const nouvelleQuantite = Math.max(Math.round((Number(o.quantite) || 0) * ratioParticipants), 0);
        if (nouvelleQuantite !== o.quantite) onUpdateOption(o.id, { quantite: nouvelleQuantite });
      });
    }

    if (remboursementPossible && remboursementChoix === "rembourse") {
      const { error } = await supabase.from("remboursements").insert({
        client_id: client.id,
        montant: montantAffiche,
        raison: "Annulation",
        // "raison" doit rester une des 4 catégories fixes (voir
        // RAISONS_REMBOURSEMENT) — le motif précis choisi ci-dessus
        // (Météo/Malade/...) vient d'un vocabulaire différent
        // (RAISONS_ANNULATION), donc rangé ici plutôt que dans raison_autre
        // (qui ne s'affiche que si raison === "Autre") pour rester visible
        // dans Suivis > Remboursements.
        details: motifFinal ? `${nbPartent} participant${nbPartent > 1 ? "s" : ""} — ${motifFinal}` : "",
        mode: "PayPal",
        paypal_email: emailPourRemb.trim(),
        activite_id: r.id,
        date_probleme: date || todayStr(),
      });
      if (error) toast("Échec de la création du remboursement.");
      if (emailPourRemb.trim() && emailPourRemb.trim() !== client.paypal_email) {
        onUpdateClient?.({ paypal_email: emailPourRemb.trim() });
      }
    } else if (remboursementPossible && remboursementChoix === "avoir") {
      const { error } = await supabase.from("avoirs").insert({
        client_id: client.id,
        montant: montantAffiche,
        montant_restant: montantAffiche,
        raison: "Annulation",
        raison_autre: motifFinal ? `${nbPartent} participant${nbPartent > 1 ? "s" : ""} — ${motifFinal}` : "",
        activite_id: r.id,
        date_probleme: date || todayStr(),
      });
      if (error) toast("Échec de la création de l'avoir.");
    }

    // La part de l'avoir qui suivait les participants qui partent n'est
    // jamais de l'argent reçu par l'agence — restituée en avoir plutôt
    // qu'absorbée dans le remboursement cash ci-dessus (voir avoirLibere).
    if (avoirLibere > 0) {
      const { error } = await supabase.from("avoirs").insert({
        client_id: client.id,
        montant: avoirLibere,
        montant_restant: avoirLibere,
        raison: "Annulation",
        activite_id: r.id,
        date_probleme: date || todayStr(),
      });
      if (error) toast("Échec de la restitution de l'avoir.");
    }

    onUpdate({
      participants_mode: "custom",
      participants_adultes: nouveauxAd,
      participants_enfants: nouveauxEnf,
      participants_bebes: nbBebe,
      participants_accompagnateurs: nbAcc,
      participants_enfants_3ans: nbEnf3,
      participants_retires: (Number(r.participants_retires) || 0) + nbPartent,
      participants_retires_motif: motifFinal,
      ...(avoirUtiliseAvant > 0 ? { avoir_utilise: avoirUtiliseApres } : {}),
    });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-[#eaeaea] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-base font-semibold text-[#171717]">
            Retirer des participants — « {r.nom_activite || "cette activité"} »
          </h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-[#171717]">
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Le reste du groupe garde l&apos;activité confirmée — seuls les participants retirés ci-dessous ne la font
          plus. Actuellement : {nbAd} adulte{nbAd > 1 ? "s" : ""}
          {nbEnf > 0 ? `, ${nbEnf} enfant${nbEnf > 1 ? "s" : ""}` : ""}.
        </p>

        <div className="mt-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Adultes qui annulent</label>
            <input
              type="number"
              min={0}
              max={nbAd}
              value={adultesPartent}
              onChange={(e) => setAdultesPartent(Math.min(Math.max(Number(e.target.value) || 0, 0), nbAd))}
              className="input text-sm"
            />
          </div>
          {nbEnf > 0 && (
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-neutral-500">Enfants qui annulent</label>
              <input
                type="number"
                min={0}
                max={nbEnf}
                value={enfantsPartent}
                onChange={(e) => setEnfantsPartent(Math.min(Math.max(Number(e.target.value) || 0, 0), nbEnf))}
                className="input text-sm"
              />
            </div>
          )}
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input text-sm" />
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">Motif (optionnel)</label>
          <select value={motif} onChange={(e) => setMotif(e.target.value)} className="input text-sm">
            <option value="">— Non précisé —</option>
            {RAISONS_ANNULATION.map((rai) => (
              <option key={rai}>{rai}</option>
            ))}
          </select>
          {motif === "Autre" && (
            <textarea
              value={motifAutre}
              onChange={(e) => setMotifAutre(e.target.value)}
              placeholder="Précise le motif…"
              rows={2}
              className="input mt-1.5 text-sm"
            />
          )}
        </div>

        {options.length > 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Cette activité a {options.length} option{options.length > 1 ? "s" : ""} (ex. transfert, matériel) —
              qu&apos;en fait-on ?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAjusterOptions("auto")}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  ajusterOptions === "auto"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Ajuster automatiquement (proportionnel)
              </button>
              <button
                type="button"
                onClick={() => setAjusterOptions("manuel")}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  ajusterOptions === "manuel"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Je les revois moi-même
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-md border border-[#0F5C56]/30 bg-[#0F5C56]/5 px-3 py-2 text-sm text-[#0F5C56]">
          Nouveau total activité : {euros(nouveauTotal)} € (au lieu de {euros(ancienTotal)} €)
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            La part de {nbPartent || "ces"} participant{nbPartent > 1 ? "s" : ""} avait-elle déjà été payée ?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDejaPayee(true)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                dejaPayee
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
              }`}
            >
              Oui, déjà payée
            </button>
            <button
              type="button"
              onClick={() => setDejaPayee(false)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                !dejaPayee
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
              }`}
            >
              Non, pas encore
            </button>
          </div>
        </div>

        {avoirLibere > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            {euros(avoirLibere)} € de cette baisse venaient d&apos;un avoir — ce montant sera automatiquement
            restitué en avoir à la confirmation, pas ajouté au remboursement ci-dessous.
          </p>
        )}

        {dejaPayee && differenceCash > 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-neutral-500">Montant à rembourser (€)</label>
            <input
              type="number"
              value={montantAffiche}
              onChange={(e) => setMontant(Number(e.target.value) || 0)}
              className="input mb-2 max-w-[160px]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRemboursementChoix("rembourse")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                  remboursementChoix === "rembourse"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Rembourser
              </button>
              <button
                onClick={() => setRemboursementChoix("avoir")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                  remboursementChoix === "avoir"
                    ? "border-[#171717] bg-[#171717] text-white"
                    : "border-neutral-300 text-neutral-600 hover:bg-[#fafafa]"
                }`}
              >
                Avoir (cas particulier)
              </button>
            </div>
            {remboursementChoix === "rembourse" && (
              <p className="mt-1.5 text-xs text-neutral-500">
                PayPal —{" "}
                {paypalEmail ? (
                  <>
                    {paypalEmail}{" "}
                    <button
                      onClick={() => setShowPaypalPrompt(true)}
                      className="text-[#171717] underline hover:no-underline"
                    >
                      modifier
                    </button>
                  </>
                ) : (
                  <span className="text-neutral-400">demandée à la confirmation</span>
                )}
              </p>
            )}
          </div>
        )}
        {!dejaPayee && (
          <p className="mt-3 text-xs text-neutral-400">
            Marquée &quot;pas encore payée&quot; — rien à rembourser, le nouveau total suffit.
          </p>
        )}

        <button
          onClick={confirmer}
          disabled={submitting || nbPartent === 0}
          className="mt-4 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "…" : "Confirmer le retrait de participants"}
        </button>
      </div>
      {showPaypalPrompt && (
        <PaypalEmailPromptModal
          initialValue={paypalEmail}
          onConfirm={(email) => {
            setPaypalEmail(email);
            setShowPaypalPrompt(false);
            doConfirm(email);
          }}
          onClose={() => setShowPaypalPrompt(false)}
        />
      )}
    </div>
  );
}
