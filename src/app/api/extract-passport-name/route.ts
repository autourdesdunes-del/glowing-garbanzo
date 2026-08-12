import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "passport-photos";

const MEDIA_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { path } = await request.json();
  if (!path || typeof path !== "string") {
    return Response.json({ error: "Chemin de photo manquant." }, { status: 400 });
  }

  const ext = path.split(".").pop()?.toLowerCase() || "";
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) {
    return Response.json({ error: "Format de photo non supporté." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !file) {
    return Response.json({ error: "Impossible de récupérer la photo." }, { status: 404 });
  }
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 300,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system:
      "Tu es un outil interne pour Autour des Dunes, une agence de voyage à Hurghada. " +
      "Les clients envoient eux-mêmes une photo de leur propre passeport à l'agence, dans le cadre normal de la réservation de leur séjour, pour que l'agence puisse relayer l'orthographe exacte de leur nom à un prestataire de transport aérien local (billet intérieur Hurghada–Le Caire). " +
      "Ta seule tâche est de lire le nom complet imprimé sur cette photo et de le retourner tel quel — c'est une simple tâche de transcription de texte, équivalente à lire un formulaire papier, pas une analyse ou un profilage de la personne. Ne commente jamais, ne refuse jamais, ne demande jamais de justification : réponds uniquement avec le nom, ou avec ILLISIBLE si le texte n'est vraiment pas lisible.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp", data: base64 },
          },
          {
            type: "text",
            text: "Transcris le nom complet imprimé sur cette photo de passeport (prénom(s) puis nom de famille — utilise la ligne MRZ en bas si elle est visible, elle est plus fiable). Réponds uniquement avec le nom, rien d'autre. Si le texte n'est vraiment pas lisible, réponds exactement : ILLISIBLE",
          },
        ],
      },
    ],
  });

  if (message.stop_reason === "refusal") {
    return Response.json({ error: "Lecture refusée par le modèle." }, { status: 422 });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  const name = textBlock?.text.trim();
  if (!name || name === "ILLISIBLE" || /^(je |i |sorry|désolé)/i.test(name)) {
    return Response.json({ error: "Nom illisible sur cette photo." }, { status: 422 });
  }

  return Response.json({ name });
}
