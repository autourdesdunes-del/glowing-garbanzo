"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";

const BUCKET = "activity-photos";
const FRAME_W = 320;
const FRAME_H = 240;
const OUTPUT_W = 960;
const OUTPUT_H = 720;

function clampOffset(o: { x: number; y: number }, dW: number, dH: number) {
  const minX = Math.min(0, FRAME_W - dW);
  const minY = Math.min(0, FRAME_H - dH);
  return {
    x: Math.max(minX, Math.min(0, o.x)),
    y: Math.max(minY, Math.min(0, o.y)),
  };
}

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

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const imgElRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(
    null
  );

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

  function baseScale() {
    if (!naturalSize.w || !naturalSize.h) return 1;
    return Math.max(FRAME_W / naturalSize.w, FRAME_H / naturalSize.h);
  }

  const displayScale = baseScale() * zoom;
  const displayW = naturalSize.w * displayScale;
  const displayH = naturalSize.h * displayScale;

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ w, h });
    const bScale = Math.max(FRAME_W / w, FRAME_H / h);
    const dW = w * bScale;
    const dH = h * bScale;
    setOffset({ x: (FRAME_W - dW) / 2, y: (FRAME_H - dH) / 2 });
    setZoom(1);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = { x: dragRef.current.startOffsetX + dx, y: dragRef.current.startOffsetY + dy };
    setOffset(clampOffset(next, displayW, displayH));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function handleZoomChange(v: number) {
    setZoom(v);
    const bScale = baseScale();
    const dW = naturalSize.w * bScale * v;
    const dH = naturalSize.h * bScale * v;
    setOffset((o) => clampOffset(o, dW, dH));
  }

  function closeCropModal() {
    if (cropSrc && cropSrc.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropOpen(false);
    setCropSrc(null);
    setNaturalSize({ w: 0, h: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    const supabase = createClient();
    const newPath = `${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, blob, { contentType: "image/jpeg" });
    setUploading(false);
    if (error) {
      toast("Échec de l'envoi de la photo.");
      return;
    }
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
    onPathChange(newPath);
    closeCropModal();
  }

  function confirmCrop() {
    const img = imgElRef.current;
    if (!img || !naturalSize.w || !naturalSize.h) return;
    const dScale = baseScale() * zoom;
    const sx = -offset.x / dScale;
    const sy = -offset.y / dScale;
    const sW = FRAME_W / dScale;
    const sH = FRAME_H / dScale;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, OUTPUT_W, OUTPUT_H);
    } catch {
      toast("Échec du recadrage — réessaie avec un nouvel envoi de la photo.");
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast("Échec du recadrage.");
          return;
        }
        uploadBlob(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choisis un fichier image.");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
    setCropOpen(true);
  }

  function openRecrop() {
    if (!previewUrl) return;
    setCropSrc(previewUrl);
    setCropOpen(true);
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
          <img src={previewUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
          <button
            type="button"
            onClick={openRecrop}
            className="text-xs text-[#171717] hover:underline"
          >
            Recadrer
          </button>
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

      {cropOpen && cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-md bg-white p-4">
            <p className="mb-3 text-sm font-medium text-neutral-700">Recadrer la photo</p>
            <div
              className="relative mx-auto overflow-hidden rounded-md bg-neutral-100 touch-none"
              style={{ width: FRAME_W, height: FRAME_H, cursor: "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgElRef}
                src={cropSrc}
                alt=""
                crossOrigin="anonymous"
                onLoad={handleImgLoad}
                draggable={false}
                className="absolute select-none"
                style={{
                  left: offset.x,
                  top: offset.y,
                  width: displayW || undefined,
                  height: displayH || undefined,
                  maxWidth: "none",
                }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-neutral-400">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCropModal}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmCrop}
                disabled={uploading}
                className="rounded-md bg-[#171717] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Envoi…" : "Utiliser cette photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
