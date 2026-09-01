import Anthropic from "@anthropic-ai/sdk";

// Extraction incrémentale des infos utiles d'un prospect à partir de la
// conversation Kommo (WhatsApp/Instagram), message par message. On ne
// stocke jamais le texte des messages eux-mêmes (Kommo reste la seule
// source de la messagerie, cf. 0027_kommo_integration.sql) — seulement
// l'état structuré déduit, réévalué à chaque nouveau message avec l'état
// précédent comme contexte.

export type KommoExtractedInfo = {
  resume: string | null;
  sejour_debut_estime: string | null;
  sejour_fin_estime: string | null;
  hotel_estime: string | null;
  nb_adultes_estime: number | null;
  nb_enfants_estime: number | null;
  ages_enfants_estime: string | null;
  activites_interet: string | null;
  activites_a_eviter: string | null;
  programme_envoye_resume: string | null;
  etape_detectee: "Devis donné" | "Programme envoyé" | "Infos demandées" | "Réservé" | null;
  // Détecté sur CE message uniquement (jamais reporté depuis previousInfo,
  // contrairement aux autres champs) — une vraie réclamation/problème
  // signalé par le prospect, pas juste une question ou une hésitation. Voir
  // message/route.ts pour la création automatique dans la table incidents.
  incident_signale: { titre: string; details: string } | null;
};

export const EMPTY_EXTRACTED_INFO: KommoExtractedInfo = {
  resume: null,
  sejour_debut_estime: null,
  sejour_fin_estime: null,
  hotel_estime: null,
  nb_adultes_estime: null,
  nb_enfants_estime: null,
  ages_enfants_estime: null,
  activites_interet: null,
  activites_a_eviter: null,
  programme_envoye_resume: null,
  etape_detectee: null,
  incident_signale: null,
};

const EXTRACTION_TOOL = {
  name: "update_prospect_info",
  description:
    "Enregistre l'état à jour des informations connues sur ce prospect, en tenant compte de ce qui était déjà connu et du nouveau message.",
  input_schema: {
    type: "object" as const,
    properties: {
      resume: {
        type: ["string", "null"],
        description:
          "Résumé très court (1-2 phrases, en français) de la demande du prospect : ce qu'il veut, pour quand, avec qui. null tant qu'il n'y a pas assez d'information pour résumer quoi que ce soit d'utile.",
      },
      sejour_debut_estime: {
        type: ["string", "null"],
        description:
          "Date de début de séjour au format YYYY-MM-DD, calculée à partir de la date du jour donnée si le prospect donne une indication relative (ex. 'dans 3 semaines'). null si aucune date précise n'a été donnée (une simple saison comme 'cet été' ne compte pas comme précis).",
      },
      sejour_fin_estime: {
        type: ["string", "null"],
        description: "Date de fin de séjour au format YYYY-MM-DD, ou null si inconnue.",
      },
      hotel_estime: {
        type: ["string", "null"],
        description: "Nom de l'hôtel mentionné par le prospect, ou null si aucun hôtel n'a été mentionné.",
      },
      nb_adultes_estime: {
        type: ["integer", "null"],
        description:
          "Nombre de voyageurs de 18 ans ou plus dans le groupe, ou null si inconnu. Compte comme adulte toute personne de 18 ans ou plus même si le prospect la présente comme son 'fils'/sa 'fille' — le lien familial ne change pas le tarif appliqué, seul l'âge compte.",
      },
      nb_enfants_estime: {
        type: ["integer", "null"],
        description:
          "Nombre de voyageurs de moins de 18 ans dans le groupe (enfants et adolescents), ou null si inconnu ou aucun. Un 'fils'/une 'fille' de 18 ans ou plus est un adulte (nb_adultes_estime), pas un enfant, quel que soit le terme utilisé par le prospect.",
      },
      ages_enfants_estime: {
        type: ["string", "null"],
        description:
          "Âges des voyageurs de MOINS DE 18 ANS uniquement, en texte libre et concis (ex. '4 ans et 12 ans'), ou null si aucun. N'y mets jamais l'âge d'un voyageur de 18 ans ou plus (compte-le dans nb_adultes_estime à la place).",
      },
      activites_interet: {
        type: ["string", "null"],
        description:
          "Activités qui intéressent potentiellement le prospect (mentionnées ou clairement sous-entendues par ses questions), séparées par des virgules (ex. 'plongée, excursion désert, Louxor'). Attention : une virgule signifie que le prospect veut les DEUX (envies cumulables) — si le prospect hésite entre deux options concurrentes ou n'en veut qu'une seule (ex. 'Orange Bay ou Paradise', 'le Caire ou Louxor'), garde le 'ou' entre les deux au lieu d'une virgule ('Orange Bay ou Paradise' comme un seul élément de la liste, jamais 'Orange Bay, Paradise'). null si rien n'est ressorti.",
      },
      activites_a_eviter: {
        type: ["string", "null"],
        description:
          "Activités que le prospect a dit explicitement ne PAS vouloir faire ou refuser (ex. 'pas de désert', 'on évite la plongée', 'ma femme n'aime pas les bateaux'), séparées par des virgules. Uniquement ce qui est refusé noir sur blanc dans le texte — ne jamais déduire un refus à partir d'une simple absence de mention. null si rien n'a été explicitement refusé.",
      },
      programme_envoye_resume: {
        type: ["string", "null"],
        description:
          "Résumé très court du programme/de l'itinéraire proposé au prospect par l'équipe, UNIQUEMENT si ce message le mentionne ou le cite explicitement (ex. le prospect répond en citant ou commentant un programme reçu, ou le message de l'équipe détaille un programme envoyé). Ne jamais inventer un programme qui n'est pas explicitement dans le texte. null si aucun programme n'est mentionné dans ce message.",
      },
      etape_detectee: {
        type: ["string", "null"],
        enum: ["Devis donné", "Programme envoyé", "Infos demandées", "Réservé", null],
        description:
          "Étape du dossier telle qu'elle ressort de la conversation jusqu'ici, une seule des quatre valeurs : 'Devis donné' (un prix a été communiqué au prospect), 'Programme envoyé' (un itinéraire/programme détaillé a été envoyé), 'Infos demandées' (le prospect pose des questions, aucun prix ni programme envoyé pour l'instant), 'Réservé' (le prospect a confirmé/payé, la réservation est actée). Garde la valeur déjà connue si ce message ne fait pas avancer le dossier vers une étape différente — ne recule jamais l'étape sauf annulation explicite. null seulement si aucune étape n'est encore identifiable.",
      },
      incident_signale: {
        type: ["object", "null"],
        description:
          "Renseigné UNIQUEMENT si CE message précis (pas les précédents) exprime une vraie réclamation ou un vrai problème vécu par le client : un incident pendant/après une activité (blessure, accident, activité annulée/ratée/décevante, matériel défectueux), un désaccord sur un remboursement, une plainte sur la qualité d'une prestation ou du service, ou un signalement de sécurité. Ne compte JAMAIS comme incident : une simple question, une demande d'info, une hésitation, une négociation de prix, un message de l'équipe (direction 'out'). En cas de doute, laisse null plutôt que de sur-signaler.",
        properties: {
          titre: {
            type: "string",
            description: "Titre très court (5-8 mots) résumant le problème, ex. 'Réclamation : morsure de chameau'.",
          },
          details: {
            type: "string",
            description: "1-3 phrases en français résumant ce qui s'est passé, d'après ce message.",
          },
        },
        required: ["titre", "details"],
        additionalProperties: false,
      },
    },
    required: [
      "resume",
      "sejour_debut_estime",
      "sejour_fin_estime",
      "hotel_estime",
      "nb_adultes_estime",
      "nb_enfants_estime",
      "ages_enfants_estime",
      "activites_interet",
      "activites_a_eviter",
      "programme_envoye_resume",
      "etape_detectee",
      "incident_signale",
    ],
    additionalProperties: false,
  },
};

export async function extractProspectInfoFromMessage(params: {
  previousInfo: KommoExtractedInfo;
  newMessageText: string;
  newMessageDirection: "in" | "out";
  todayStr: string;
}): Promise<KommoExtractedInfo | null> {
  const { previousInfo, newMessageText, newMessageDirection, todayStr } = params;
  if (!newMessageText.trim()) return null;

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    thinking: { type: "disabled" },
    system:
      "Tu es un outil interne pour Autour des Dunes, une agence de voyage francophone à Hurghada (Égypte). " +
      "Tu lis, message par message, une conversation WhatsApp/Instagram avec un prospect qui envisage de réserver des activités/un séjour via l'agence. " +
      "Ta tâche : maintenir à jour un petit résumé structuré du dossier, en partant de ce qui était déjà connu et en l'ajustant seulement si le nouveau message apporte une info nouvelle, plus précise, ou contradictoire. " +
      "Règles strictes : ne déduis/n'invente jamais une information qui n'est pas raisonnablement soutenue par le texte ; si le nouveau message ne dit rien sur un champ, garde exactement la valeur déjà connue pour ce champ (ne la remets pas à null) ; si le message vient de l'équipe (pas du prospect), ne l'utilise que pour comprendre le contexte de la réponse suivante du prospect, pas comme une affirmation de fait sur le prospect lui-même. " +
      "Cas particulier de incident_signale : contrairement aux autres champs, ne le reporte jamais depuis l'état déjà connu — évalue-le uniquement sur ce nouveau message précis (mets-le à null si CE message ne contient pas de nouvelle réclamation, même si un incident était signalé dans un message précédent).",
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "update_prospect_info" },
    messages: [
      {
        role: "user",
        content:
          `Date du jour : ${todayStr}\n\n` +
          `Informations déjà connues sur ce prospect (JSON) :\n${JSON.stringify(previousInfo, null, 2)}\n\n` +
          `Nouveau message ${newMessageDirection === "in" ? "du prospect" : "de l'équipe (pas du prospect)"} :\n"${newMessageText}"\n\n` +
          "Appelle l'outil avec l'état à jour complet (les 12 champs), en gardant les valeurs déjà connues quand ce message n'apporte rien de nouveau sur un champ (sauf incident_signale, toujours réévalué sur ce seul message).",
      },
    ],
  });

  if (message.stop_reason === "refusal") return null;
  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "update_prospect_info"
  );
  if (!toolUse) return null;
  return toolUse.input as KommoExtractedInfo;
}
