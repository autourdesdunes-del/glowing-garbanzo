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

// Largeur fixe, mais hauteur libre — le programme d'une activité peut faire
// une ligne ou vingt, une hauteur figée coupait le bas du flyer (et le mini
// encadré "Réservez maintenant") pour les programmes détaillés.
const FLYER_WIDTH = 1080;

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

const TOUS_LES_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// "Tous les jours" plutôt que d'égrainer les 7 jours — plus lisible sur un
// flyer. Dédoublonne aussi les entrées mal saisies côté catalogue (ex.
// jours en double, casse mélangée) avant de comparer.
function dispoLabel(item: CatalogueItem): string {
  if (item.jours_disponibles?.length) {
    const normalises = new Set(item.jours_disponibles.map((j) => j.trim().toLowerCase()));
    if (TOUS_LES_JOURS.every((j) => normalises.has(j))) return "Tous les jours";
    return item.jours_disponibles.join(", ");
  }
  return item.disponibilites || "";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-block",
        background: "#C9973E",
        color: "#2B211C",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 1.5,
        padding: "7px 18px",
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  );
}

function FlyerTemplate({ item, photoUrl }: { item: CatalogueItem; photoUrl: string | null }) {
  const inclus = inclusItems(item);
  const programme = programmeItems(item);
  const { montant, unite } = priceLabel(item);
  const dispo = dispoLabel(item);

  return (
    <div
      style={{
        width: FLYER_WIDTH,
        background: "#F2E6D2",
        fontFamily: "var(--font-geist-sans)",
        color: "#2B211C",
        display: "flex",
        flexDirection: "column",
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
        {/* Dégradé large + plaque sombre derrière le texte : le titre doit
            rester lisible quelle que soit la photo (ciel clair, sable...). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 65%)",
          }}
        />
        <div style={{ position: "absolute", top: 60, left: 40, right: 40, textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "28px 40px",
              borderRadius: 14,
              background: "rgba(20,14,10,0.4)",
            }}
          >
            <div style={{ fontSize: 20, letterSpacing: 8, color: "#F2E6D2", fontWeight: 600 }}>
              AUTOUR DES DUNES
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: "var(--font-fraunces)",
                fontSize: 56,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: 1,
                lineHeight: 1.1,
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {item.nom.toUpperCase()}
            </div>
            <div style={{ marginTop: 12, fontSize: 18, letterSpacing: 4, color: "#F2E6D2" }}>
              {(item.point_rdv || item.categorie || "").toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", padding: "56px 60px 50px" }}>
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

        {/* Deux encadrés côte à côte : disponibilités à gauche, inclus à
            droite (demande explicite du 2026-08-14). */}
        <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
          <div
            style={{
              flex: 1,
              border: "1px solid rgba(92,42,29,0.18)",
              borderRadius: 10,
              background: "#FBF6EC",
              padding: 20,
            }}
          >
            <SectionLabel>DISPONIBILITÉS</SectionLabel>
            <div style={{ marginTop: 14, fontSize: 19, lineHeight: 1.5 }}>
              {dispo && <div>{dispo}</div>}
              {item.horaire_approx && <div>{item.horaire_approx}</div>}
              {item.duree && <div>Durée : {item.duree}</div>}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              border: "1px solid rgba(92,42,29,0.18)",
              borderRadius: 10,
              background: "#FBF6EC",
              padding: 20,
            }}
          >
            <SectionLabel>INCLUS</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {inclus.map((label, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18 }}>
                  <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{iconForInclus(label)}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {programme.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <SectionLabel>PROGRAMME</SectionLabel>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {programme.map((p, i) => (
                <div key={i} style={{ fontSize: 22 }}>
                  • {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mini encadré compact (demande explicite) plutôt qu'un bloc
            pleine largeur — infos de contact sur une seule ligne. */}
        <div
          style={{
            marginTop: 32,
            display: "inline-flex",
            flexDirection: "column",
            gap: 8,
            border: "1px solid rgba(92,42,29,0.18)",
            borderRadius: 10,
            background: "#FBF6EC",
            padding: "14px 20px",
          }}
        >
          <SectionLabel>RÉSERVEZ MAINTENANT</SectionLabel>
          <div style={{ display: "flex", gap: 20, fontSize: 17, flexWrap: "wrap" }}>
            <span>🌐 {AGENCY_CONTACT.site}</span>
            <span>💬 {AGENCY_CONTACT.whatsapp}</span>
            <span>📷 @{AGENCY_CONTACT.instagram}</span>
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
        const dataUrl = await toPng(ref.current, { width: FLYER_WIDTH, pixelRatio: 2 });
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
