"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

const BUCKET = "billets-avion";

export default function BilletAvionUpload({
  paths,
  onChange,
  hideLabel = false,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  // true quand ce widget est déjà inséré dans une ligne portant elle-même
  // le libellé "Billet d'avion" (ex. DetailRow dans ItineraryView) — évite
  // de l'afficher deux fois.
  hideLabel?: boolean;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    const supabase = createClient();
    (async () => {
      const entries = await Promise.all(
        paths.map(async (p) => {
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600);
          return [p, data?.signedUrl ?? ""] as const;
        })
      );
      setUrls(Object.fromEntries(entries));
    })();
  }, [paths]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isAllowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!isAllowed) {
      toast("Choisis une image ou un PDF.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const newPath = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(newPath, file);
    setUploading(false);
    if (error) {
      toast("Échec de l'envoi du billet.");
      return;
    }
    onChange([...paths, newPath]);
  }

  async function handleRemove(path: string) {
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);
    onChange(paths.filter((p) => p !== path));
  }

  return (
    <div>
      {!hideLabel && (
        <span className="mb-1 block text-sm font-medium text-neutral-700">
          Billet d&apos;avion (PDF ou photo — plusieurs possibles)
        </span>
      )}
      {paths.length > 0 && (
        <div className="mb-2 flex flex-col gap-1.5">
          {paths.map((path, i) => (
            <div key={path} className="flex items-center gap-2">
              <a
                href={urls[path] || "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#666666]/30 px-3 py-1.5 text-sm text-[#171717] hover:bg-[#fafafa]"
              >
                Voir le billet {paths.length > 1 ? i + 1 : ""}
              </a>
              <button
                type="button"
                onClick={() => handleRemove(path)}
                className="text-xs text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:border-[#171717]">
        {uploading ? "Envoi…" : paths.length > 0 ? "+ Ajouter un autre billet" : "+ Ajouter le billet"}
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFile}
          className="hidden"
        />
      </label>
    </div>
  );
}
