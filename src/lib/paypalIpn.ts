// Intégration PayPal via IPN (Instant Payment Notification) : contrairement
// aux webhooks REST modernes (scopés aux paiements passés par une
// intégration Checkout/Orders), IPN est l'ancien mécanisme de PayPal qui
// notifie de toute réception d'argent sur le compte, quelle que soit son
// origine — y compris un virement manuel "Envoyer de l'argent" entre
// particuliers, comme les acomptes reçus par l'agence. Vérifié en situation
// réelle le 13/08 : un vrai paiement de 10€ n'a déclenché aucun webhook
// REST alors qu'il apparaissait bien dans les transactions du compte —
// IPN est le seul mécanisme qui couvre ce cas.

const IPN_VERIFY_URL =
  process.env.PAYPAL_IPN_VERIFY_URL || "https://ipnpb.paypal.com/cgi-bin/webscr";

export function parseIpnBody(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody);
  const record: Record<string, string> = {};
  for (const [key, value] of params.entries()) record[key] = value;
  return record;
}

// PayPal exige de renvoyer le message reçu tel quel, préfixé de
// "cmd=_notify-validate", et répond "VERIFIED" ou "INVALID" en texte brut.
export async function verifyIpn(rawBody: string): Promise<boolean> {
  const res = await fetch(IPN_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `cmd=_notify-validate&${rawBody}`,
  });
  if (!res.ok) return false;
  const text = await res.text();
  return text.trim() === "VERIFIED";
}

export type PaypalPaiementExtrait = {
  transaction_id: string;
  montant: number;
  devise: string;
  frais: number;
  montant_net: number;
  entre_proches: boolean;
  payeur_nom: string;
  payeur_email: string;
  paypal_recu_le: string;
};

// N'extrait que les paiements reçus et complets (payment_status=Completed) —
// IPN notifie aussi les remboursements, litiges, paiements en attente, etc.
// qu'on ignore pour l'instant (aucune colonne acompte_* à toucher dans ces
// cas). mc_fee absent ou à 0 = aucun frais prélevé = paiement "entre
// proches" (personal payment) ; présent et > 0 = paiement standard, la
// différence a été prélevée par PayPal.
export function extractIpnPaiement(fields: Record<string, string>): PaypalPaiementExtrait | null {
  if (fields.payment_status !== "Completed") return null;
  const transactionId = fields.txn_id;
  if (!transactionId) return null;

  const montant = parseFloat(fields.mc_gross || fields.payment_gross || "0");
  const frais = Math.abs(parseFloat(fields.mc_fee || fields.payment_fee || "0"));
  const devise = fields.mc_currency || fields.currency_code || "EUR";
  const payeurNom = [fields.first_name, fields.last_name].filter(Boolean).join(" ").trim();

  return {
    transaction_id: transactionId,
    montant,
    devise,
    frais,
    montant_net: Math.round((montant - frais) * 100) / 100,
    entre_proches: frais === 0,
    payeur_nom: payeurNom,
    payeur_email: fields.payer_email || "",
    paypal_recu_le: fields.payment_date ? new Date(fields.payment_date).toISOString() : new Date().toISOString(),
  };
}
