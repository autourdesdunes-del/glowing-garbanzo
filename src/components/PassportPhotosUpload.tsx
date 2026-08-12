"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

const BUCKET = "passport-photos";

export default function PassportPhotosUpload({
  paths,
  onChange,
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
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

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const nonImages = files.filter((f) => !f.type.startsWith("image/"));
    if (nonImages.length > 0) {
      toast("Choisis uniquement des fichiers image.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const uploaded: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const newPath = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(newPath, file);
      if (!error) uploaded.push(newPath);
    }
    setUploading(false);
    if (uploaded.length < files.length) {
      toast(
        uploaded.length === 0
          ? "Échec de l'envoi des photos."
          : `${files.length - uploaded.length} photo(s) sur ${files.length} n'ont pas pu être envoyées.`
      );
    }
    if (uploaded.length > 0) onChange([...paths, ...uploaded]);
  }

  async function handleRemove(path: string) {
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);
    onChange(paths.filter((p) => p !== path));
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        Photos du/des passeport(s)
      </span>
      <div className="flex flex-wrap gap-3">
        {paths.map((p) => (
          <div key={p} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urls[p]}
              alt=""
              className="h-20 w-28 rounded-md border border-neutral-200 object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(p)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white hover:opacity-90"
            >
              ✕
            </button>
          </div>
        ))}
        <label className="flex h-20 w-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 text-center text-xs text-neutral-500 hover:border-[#171717]">
          {uploading ? "Envoi…" : "+ Ajouter"}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
