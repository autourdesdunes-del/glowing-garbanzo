"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

const BUCKET = "activity-photos";

export default function PhotoUpload({
  path,
  onPathChange,
}: {
  path: string;
  onPathChange: (path: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!path) {
      setPreviewUrl(null);
      return;
    }
    const supabase = createClient();
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => setPreviewUrl(data?.signedUrl ?? null));
  }, [path]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choisis un fichier image.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const newPath = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(newPath, file);
    setUploading(false);
    if (error) {
      toast("Échec de l'envoi de la photo.");
      return;
    }
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
    onPathChange(newPath);
  }

  async function handleRemove() {
    if (path) {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([path]);
    }
    onPathChange("");
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-neutral-700">Photo</span>
      {previewUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="h-16 w-16 rounded-md object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-600 hover:underline"
          >
            Retirer la photo
          </button>
        </div>
      ) : (
        <label className="inline-block cursor-pointer rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-[#171717]">
          {uploading ? "Envoi…" : "Choisir une photo"}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
