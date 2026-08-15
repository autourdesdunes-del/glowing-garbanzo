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
    <div className="flex flex-wrap items-center gap-2">
      {paths.map((p) => (
        <div key={p} className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[p]}
            alt=""
            className="h-10 w-14 rounded-md border border-neutral-200 object-cover"
          />
          <button
            type="button"
            onClick={() => handleRemove(p)}
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white opacity-0 hover:opacity-100 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
      <label
        title="Ajouter une photo"
        className="flex h-10 w-14 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 text-sm text-neutral-400 hover:border-[#171717] hover:text-[#171717]"
      >
        {uploading ? "…" : "+"}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </label>
    </div>
  );
}
