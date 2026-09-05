"use client";

import { useEffect, useState } from "react";
import { Client, PaypalPaiement } from "@/lib/types";
import { paypalRappelDueKey } from "@/lib/paypalRappel";
import { deaccent } from "@/lib/deaccent";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Prévient toute l'équipe qu'un paiement PayPal reçu n'est pas encore
// rattaché à un client — premier pop-up dans l'heure qui suit la
// réception, puis toutes les 3h tant qu'il traîne (même cadence que
// BilletEnvoiRappels). Le rattachement se fait directement depuis le
// pop-up, pas besoin d'aller chercher Suivis > Paiements PayPal.
export default function PaypalPaiementRappel({
  paypalPaiements,
  clients,
  onRattacher,
}: {
  paypalPaiements: PaypalPaiement[];
  clients: Client[];
  onRattacher: (paiementId: string, clientId: string, type: "acompte" | "etape" | "solde") => void;
}) {
  const [alert, setAlert] = useState<{ p: PaypalPaiement; key: string } | null>(null);
  const [query, setQuery] = useState("");
  // Un paiement PayPal en cours de dossier n'est pas toujours l'acompte —
  // ça peut être un règlement en cours de séjour ou le solde. On demande à
  // l'employée de trancher une fois le client identifié, plutôt que de
  // toujours le compter comme acompte.
  const [clientChoisi, setClientChoisi] = useState<Client | null>(null);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      for (const p of paypalPaiements) {
        const storageKey = "paypal-rappel-" + p.id;
        const lastShown = localStorage.getItem(storageKey);
        const due = paypalRappelDueKey(p, lastShown, now);
        if (due) {
          setAlert({ p, key: due });
          return; // un seul pop-up à la fois ; le suivant apparaît au prochain check
        }
      }
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [paypalPaiements]);

  if (!alert) return null;

  const { p } = alert;
  const dismiss = () => {
    localStorage.setItem("paypal-rappel-" + p.id, alert.key);
    setAlert(null);
    setQuery("");
    setClientChoisi(null);
  };

  const rattacher = (type: "acompte" | "etape" | "solde") => {
    if (!clientChoisi) return;
    onRattacher(p.id, clientChoisi.id, type);
    setAlert(null);
    setQuery("");
    setClientChoisi(null);
  };

  const matches =
    query.trim().length >= 2
      ? clients
          .filter((c) => deaccent((c.nom || "").toLowerCase()).includes(deaccent(query.trim().toLowerCase())))
          .slice(0, 6)
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-[#171717]">💰 Paiement PayPal à rattacher</h2>
        <p className="mt-3 text-sm text-[#171717]">
          <strong>{p.payeur_nom || "Un client"}</strong> a envoyé{" "}
          <strong>{euros(p.montant_net)} €</strong> via PayPal
          {p.entre_proches ? " (entre proches)" : " (frais prélevés)"} — à quel client le rattacher ?
        </p>
        {!clientChoisi ? (
          <div className="mt-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un client…"
              autoFocus
              className="input text-sm"
            />
            {matches.length > 0 && (
              <div className="mt-1.5 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setClientChoisi(c)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#fafafa]"
                  >
                    {c.nom || "Sans nom"}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-neutral-600">
              Pour <strong>{clientChoisi.nom || "Sans nom"}</strong>, ce paiement correspond à :
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                onClick={() => rattacher("acompte")}
                className="rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-[#fafafa]"
              >
                L&apos;acompte
              </button>
              <button
                onClick={() => rattacher("etape")}
                className="rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-[#fafafa]"
              >
                Un paiement en cours de séjour
              </button>
              <button
                onClick={() => rattacher("solde")}
                className="rounded-md border border-neutral-300 px-3 py-2 text-left text-sm hover:bg-[#fafafa]"
              >
                Le solde
              </button>
            </div>
            <button
              onClick={() => setClientChoisi(null)}
              className="mt-2 text-xs text-neutral-400 hover:underline"
            >
              ‹ Choisir un autre client
            </button>
          </div>
        )}
        <button
          onClick={dismiss}
          className="mt-4 w-full rounded-md border border-[#171717]/20 px-3 py-2 text-sm font-medium text-[#171717] hover:bg-[#fafafa]"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
