"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

const BUCKET = "remboursement-preuves";

// Capture d'écran obligatoire (PayPal, virement...) au moment de marquer un
// remboursement "Effectué" — pour retrouver la preuve sans repasser par
// WhatsApp.
export default function PreuveRemboursementUpload({
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
    if (!path) {
      setUrl("");
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      setUrl(data?.signedUrl ?? "");
    })();
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
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    const ext = file.name.split(".").pop();
    const newPath = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(newPath, file);
    setUploading(false);
    if (error) {
      toast("Échec de l'envoi de la preuve.");
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
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        Preuve du remboursement (capture d&apos;écran) *
      </span>
      {path ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="h-24 w-32 rounded-md border border-neutral-200 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white hover:opacity-90"
          >
            ✕
          </button>
        </div>
      ) : (
        <label className="flex h-24 w-32 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 text-center text-xs text-neutral-500 hover:border-[#171717]">
          {uploading ? "Envoi…" : "+ Ajouter la preuve"}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}
