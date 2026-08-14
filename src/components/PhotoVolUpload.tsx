"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

const BUCKET = "photos-vol";

export default function PhotoVolUpload({
  path,
  onChange,
}: {
  path: string | null;
  onChange: (path: string | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      if (!path) {
        setUrl("");
        return;
      }
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      setUrl(data?.signedUrl ?? "");
    })();
  }, [path]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choisis une image.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    const ext = file.name.split(".").pop();
    const newPath = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(newPath, file);
    setUploading(false);
    if (error) {
      toast("Échec de l'envoi de la photo.");
      return;
    }
    onChange(newPath);
  }

  async function handleRemove() {
    if (!path) return;
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);
    onChange(null);
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-neutral-700">Photo du vol</span>
      {path ? (
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[#666666]/30 px-3 py-1.5 text-sm text-[#171717] hover:bg-[#fafafa]"
          >
            Voir la photo
          </a>
          <button type="button" onClick={handleRemove} className="text-xs text-red-600 hover:underline">
            Retirer
          </button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:border-[#171717]">
          {uploading ? "Envoi…" : "+ Ajouter la photo"}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
