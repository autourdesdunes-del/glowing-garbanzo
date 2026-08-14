"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";
import { CatalogueItem } from "@/lib/types";
import { AGENCY_CONTACT } from "@/lib/constants";

// Génère le flyer d'une activité du catalogue au même design que les flyers
// Canva de l'agence (cf. demande du 2026-08-14 — un flyer par activité,
// téléchargeable depuis la fiche catalogue, toujours regénéré à partir des
// données actuelles de l'activité donc jamais périmé après une modif).
//
// Rendu : un noeud caché (hors écran, pas display:none — html-to-image a
// besoin d'un layout réel) contient le gabarit HTML/CSS du flyer pour
// l'activité en cours d'export ; une fois l'image et les polices chargées,
// on le rasterise en PNG et on déclenche le téléchargement.

const FLYER_WIDTH = 1080;
const FLYER_HEIGHT = 1620;

function euros(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Un pictogramme simple par mot-clé — le flyer Canva d'origine choisit une
// icône à la main par ligne ; on approxime avec une heuristique plutôt que
// de stocker une icône par ligne d'inclus en base (aucun champ prévu pour
// ça côté catalogue).
function iconForInclus(label: string): string {
  const l = label.toLowerCase();
  if (/bus|van|voiture|transfert|transport/.test(l)) return "🚐";
  if (/guide/.test(l)) return "🧭";
  if (/repas|déjeuner|petit.déj|dîner|buffet/.test(l)) return "🍽️";
  if (/ticket|entrée|billet/.test(l)) return "🎫";
  if (/boisson|eau/.test(l)) return "🥤";
  if (/snorkel|masque|palme/.test(l)) return "🤿";
  if (/hôtel|hotel/.test(l)) return "🏨";
  return "✓";
}

function programmeItems(item: CatalogueItem): string[] {
  if (item.programme?.trim()) {
    return item.programme
      .split(/\n|•|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function inclusItems(item: CatalogueItem): string[] {
  if (item.inclus_liste?.length) return item.inclus_liste.filter(Boolean);
  if (item.inclus?.trim()) return item.inclus.split("\n").map((s) => s.trim()).filter(Boolean);
  return [];
}

function priceLabel(item: CatalogueItem): { montant: string; unite: string } {
  if (item.tarif_mode === "groupe") {
    return {
      montant: `${euros(item.prix_groupe_base)}€`,
      unite: item.prix_groupe_base_pax ? `pour ${item.prix_groupe_base_pax} pers.` : "par groupe",
    };
  }
  return { montant: `${euros(item.pu_adulte)}€`, unite: "par pers." };
}

function FlyerTemplate({ item, photoUrl }: { item: CatalogueItem; photoUrl: string | null }) {
  const inclus = inclusItems(item);
  const programme = programmeItems(item);
  const { montant, unite } = priceLabel(item);
  const dispoJours = item.jours_disponibles?.length ? item.jours_disponibles.join(", ") : item.disponibilites;

  return (
    <div
      style={{
        width: FLYER_WIDTH,
        height: FLYER_HEIGHT,
        background: "#F2E6D2",
        fontFamily: "var(--font-geist-sans)",
        color: "#2B211C",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: FLYER_WIDTH, height: 980, background: "#D8C7A8" }}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={item.nom}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            crossOrigin="anonymous"
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%)",
          }}
        />
        <div style={{ position: "absolute", top: 64, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontSize: 22, letterSpacing: 8, color: "#F2E6D2", fontWeight: 500 }}>
            AUTOUR DES DUNES
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--font-fraunces)",
              fontSize: 58,
              fontWeight: 600,
              color: "#2B211C",
              letterSpacing: 2,
              padding: "0 60px",
            }}
          >
            {item.nom.toUpperCase()}
          </div>
          <div style={{ marginTop: 12, fontSize: 20, letterSpacing: 4, color: "#3a2a22" }}>
            {(item.point_rdv || item.categorie || "").toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", padding: "56px 60px 50px" }}>
        <div
          style={{
            position: "absolute",
            top: -60,
            right: 60,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "#FBF6EC",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 34, fontWeight: 700, color: "#5C2A1D" }}>
            {montant}
          </div>
          <div style={{ fontSize: 16, color: "#5C2A1D" }}>{unite}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640, marginTop: 10 }}>
          {inclus.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24 }}>
              <span style={{ fontSize: 26, width: 34, textAlign: "center" }}>{iconForInclus(label)}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {programme.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div
              style={{
                display: "inline-block",
                background: "#C9973E",
                color: "#2B211C",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                padding: "8px 22px",
                borderRadius: 6,
              }}
            >
              PROGRAMME
            </div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {programme.map((p, i) => (
                <div key={i} style={{ fontSize: 22 }}>
                  • {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {(dispoJours || item.horaire_approx || item.duree) && (
          <div style={{ marginTop: 40 }}>
            <div
              style={{
                display: "inline-block",
                background: "#C9973E",
                color: "#2B211C",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                padding: "8px 22px",
                borderRadius: 6,
              }}
            >
              HORAIRES &amp; DISPONIBILITÉS
            </div>
            <div style={{ marginTop: 16, fontSize: 22, lineHeight: 1.5 }}>
              {dispoJours && <div>Disponibilité : {dispoJours}</div>}
              {item.horaire_approx && <div>{item.horaire_approx}</div>}
              {item.duree && <div>Durée : {item.duree}</div>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 40 }}>
          <div
            style={{
              display: "inline-block",
              background: "#C9973E",
              color: "#2B211C",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              padding: "8px 22px",
              borderRadius: 6,
            }}
          >
            RÉSERVEZ MAINTENANT
          </div>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, fontSize: 22 }}>
            <div>🌐 {AGENCY_CONTACT.site}</div>
            <div>💬 {AGENCY_CONTACT.whatsapp}</div>
            <div>📷 @{AGENCY_CONTACT.instagram}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogueFlyerStage({
  item,
  onDone,
}: {
  item: CatalogueItem | null;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!item || !item.photo_path) {
      Promise.resolve().then(() => {
        if (!cancelled) setPhotoUrl(null);
      });
      return () => {
        cancelled = true;
      };
    }
    const supabase = createClient();
    supabase.storage
      .from("activity-photos")
      .createSignedUrl(item.photo_path, 3600)
      .then(({ data }) => {
        if (!cancelled) setPhotoUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    // Laisse le temps à la photo (si présente) et aux polices web de finir
    // de charger avant de rasteriser, sinon le PNG exporté peut afficher la
    // police de repli ou une image manquante.
    if (item.photo_path && !photoUrl) return;

    let cancelled = false;
    const run = async () => {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled || !ref.current) return;
      try {
        const dataUrl = await toPng(ref.current, { width: FLYER_WIDTH, height: FLYER_HEIGHT, pixelRatio: 1 });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `flyer-${item.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        link.click();
      } finally {
        if (!cancelled) onDone();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, photoUrl]);

  if (!item) return null;

  return (
    // Un offset négatif énorme (position: fixed; left: -99999) casse le
    // positionnement absolu imbriqué une fois le noeud cloné/rendu par
    // html-to-image (constaté : le titre et le badge prix se retrouvaient
    // mal placés dans le PNG exporté). On garde le noeud dans les bornes du
    // viewport et on le cache par opacité + z-index à la place.
    <div
      style={{ position: "fixed", top: 0, left: 0, opacity: 0, zIndex: -1, pointerEvents: "none" }}
      aria-hidden
    >
      <div ref={ref}>
        <FlyerTemplate item={item} photoUrl={photoUrl} />
      </div>
    </div>
  );
}
