import { createClient as createServerClient } from "@/lib/supabase/server";
import { CRM_STATUT_TO_KOMMO_STATUS_ID } from "@/lib/kommoWebhook";
import { updateKommoLeadStatus } from "@/lib/kommoApi";

// Étape 2 (écriture) de l'intégration Kommo : appelée depuis le navigateur
// quand quelqu'un change le statut d'un prospect/client dans le CRM
// (glisser une carte dans le pipeline, bouton "Passer en client confirmé",
// menu Statut de la fiche complète), pour répercuter ce changement sur le
// lead Kommo correspondant. Ne fait jamais rien dans l'autre sens — c'est
// le webhook /api/kommo/webhook qui gère Kommo → CRM.
//
// Protégée par la session Supabase de l'utilisateur (pas par le token
// KOMMO_WEBHOOK_SECRET, qui sert uniquement aux appels entrants de Kommo).

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { leadId, statut, nom } = await request.json();
  const statusId = typeof statut === "string" ? CRM_STATUT_TO_KOMMO_STATUS_ID[statut] : undefined;
  if (!leadId || !statusId) {
    return Response.json({ error: "lead_id ou statut manquant/inconnu." }, { status: 400 });
  }

  // Le nom complet n'est repoussé vers Kommo que pour "Client confirmé" —
  // c'est le cas où avoir le bon nom (plutôt qu'un pseudo Instagram/WhatsApp)
  // compte vraiment sur le lead Kommo.
  const nameToPush = statut === "Client confirmé" && typeof nom === "string" && nom.trim() ? nom.trim() : undefined;

  const ok = await updateKommoLeadStatus(Number(leadId), statusId, nameToPush);
  return Response.json({ ok });
}
