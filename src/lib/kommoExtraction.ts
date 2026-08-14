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
        description: "Nombre d'adultes dans le groupe, ou null si inconnu.",
      },
      nb_enfants_estime: {
        type: ["integer", "null"],
        description: "Nombre d'enfants et/ou d'adolescents dans le groupe, ou null si inconnu ou aucun.",
      },
      ages_enfants_estime: {
        type: ["string", "null"],
        description:
          "Âges des enfants/ados mentionnés, en texte libre et concis (ex. '4 ans et 12 ans'), ou null si inconnu.",
      },
      activites_interet: {
        type: ["string", "null"],
        description:
          "Activités qui intéressent potentiellement le prospect (mentionnées ou clairement sous-entendues par ses questions), séparées par des virgules (ex. 'plongée, excursion désert, Louxor'). null si rien n'est ressorti.",
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
      "Règles strictes : ne déduis/n'invente jamais une information qui n'est pas raisonnablement soutenue par le texte ; si le nouveau message ne dit rien sur un champ, garde exactement la valeur déjà connue pour ce champ (ne la remets pas à null) ; si le message vient de l'équipe (pas du prospect), ne l'utilise que pour comprendre le contexte de la réponse suivante du prospect, pas comme une affirmation de fait sur le prospect lui-même.",
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "update_prospect_info" },
    messages: [
      {
        role: "user",
        content:
          `Date du jour : ${todayStr}\n\n` +
          `Informations déjà connues sur ce prospect (JSON) :\n${JSON.stringify(previousInfo, null, 2)}\n\n` +
          `Nouveau message ${newMessageDirection === "in" ? "du prospect" : "de l'équipe (pas du prospect)"} :\n"${newMessageText}"\n\n` +
          "Appelle l'outil avec l'état à jour complet (les 10 champs), en gardant les valeurs déjà connues quand ce message n'apporte rien de nouveau sur un champ.",
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
