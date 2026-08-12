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
    max_tokens: 100,
    output_config: { effort: "low" },
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
            text: "Lis le nom complet de cette personne sur la photo de passeport (prénom(s) puis nom de famille, tels qu'imprimés — utilise la ligne MRZ en bas si elle est visible, elle est plus fiable). Réponds uniquement avec le nom complet, sans rien ajouter d'autre. Si tu ne peux pas le lire avec certitude, réponds exactement : ILLISIBLE",
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
  if (!name || name === "ILLISIBLE") {
    return Response.json({ error: "Nom illisible sur cette photo." }, { status: 422 });
  }

  return Response.json({ name });
}
