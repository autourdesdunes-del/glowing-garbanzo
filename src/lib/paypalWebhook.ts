// Intégration PayPal (étape 1) : vérification de signature + extraction
// des champs utiles d'un event webhook "paiement reçu". Le nom exact de
// l'event et la forme du payload pour un paiement "entre proches" reçu
// hors flux Checkout ne sont confirmés qu'après avoir observé un vrai
// paiement de test — cette extraction reste volontairement défensive
// (tout en Record<string, unknown>) plutôt que typée strictement.

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || "https://api-m.paypal.com";

// PayPal exige un jeton OAuth (client_credentials) pour appeler ses propres
// API, y compris pour vérifier la signature d'un webhook qu'il vient
// d'envoyer.
async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET manquants");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal OAuth échoué (${res.status})`);
  const data = await res.json();
  return data.access_token as string;
}

export async function verifyPaypalWebhookSignature(
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const accessToken = await getPaypalAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

export type PaypalPaiementExtrait = {
  transaction_id: string;
  montant: number;
  devise: string;
  frais: number;
  montant_net: number;
  entre_proches: boolean | null;
  payeur_nom: string;
  payeur_email: string;
  paypal_recu_le: string;
};

// Best-effort : les webhooks PayPal "classiques" (paiement simple reçu,
// hors Checkout) ont un resource_type "sale" avec amount.total/amount.fee ;
// les events Payments v2 ("capture") ont une forme légèrement différente
// (seller_receivable_breakdown). On tente les deux formes connues et on
// laisse entre_proches à null si on ne peut pas le déduire avec certitude
// plutôt que de se tromper silencieusement.
export function extractPaypalPaiement(payload: Record<string, unknown>): PaypalPaiementExtrait | null {
  const resource = payload.resource as Record<string, unknown> | undefined;
  if (!resource) return null;

  const transactionId = (resource.id as string) || "";
  if (!transactionId) return null;

  let montant = 0;
  let devise = "EUR";
  let frais = 0;

  const amount = resource.amount as Record<string, unknown> | undefined;
  if (amount && "total" in amount) {
    montant = parseFloat((amount.total as string) || "0");
    devise = (amount.currency as string) || devise;
    const feeField = resource.transaction_fee as Record<string, unknown> | undefined;
    frais = feeField ? Math.abs(parseFloat((feeField.value as string) || "0")) : 0;
  } else if (amount && "value" in amount) {
    montant = parseFloat((amount.value as string) || "0");
    devise = (amount.currency_code as string) || devise;
    const breakdown = resource.seller_receivable_breakdown as Record<string, unknown> | undefined;
    const feeField = breakdown?.paypal_fee as Record<string, unknown> | undefined;
    frais = feeField ? Math.abs(parseFloat((feeField.value as string) || "0")) : 0;
  }

  const payer = resource.payer as Record<string, unknown> | undefined;
  const payerInfo = (payer?.payer_info as Record<string, unknown>) || payer || {};
  const payeurNom = [payerInfo.first_name, payerInfo.last_name].filter(Boolean).join(" ").trim();
  const payeurEmail = (payerInfo.email as string) || "";

  return {
    transaction_id: transactionId,
    montant,
    devise,
    frais,
    montant_net: Math.round((montant - frais) * 100) / 100,
    // Un paiement "entre proches" (personal payment) n'a aucun frais
    // PayPal prélevé côté receveur — c'est le signal le plus fiable
    // disponible dans le payload, à confirmer sur un vrai paiement test.
    entre_proches: amount ? frais === 0 : null,
    payeur_nom: payeurNom,
    payeur_email: payeurEmail,
    paypal_recu_le: (resource.create_time as string) || new Date().toISOString(),
  };
}
