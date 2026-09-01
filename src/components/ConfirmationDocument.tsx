"use client";

import { useEffect, useRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { reservationsActives, resaTotalMontant } from "@/lib/resa";
import { PAYPAL_ME_LINK, AGENCY_CONTACT } from "@/lib/constants";

// Bon de confirmation envoyé au client une fois son séjour réservé —
// remplace la suite de messages WhatsApp manuscrits (bons Kommo un par un +
// conditions + PayPal + solde, cf. retour de Mélanie du 2026-09-01 : "assez
// brouillon, pas facile à comprendre"). Rendu en HTML réel puis rasterisé
// (comme CatalogueFlyer.tsx) plutôt que dessiné dans jsPDF : ça permet
// d'obtenir EXACTEMENT le même rendu (police Geist du CRM, mise en page) en
// PDF (WhatsApp) et en PNG (Instagram, qui n'accepte pas les PDF en DM).
const DOC_WIDTH = 800;

function euros(n: number) {
  return `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDateLong(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function paxLine(client: Client) {
  const parts: string[] = [`${client.adultes} adulte${client.adultes > 1 ? "s" : ""}`];
  if (client.enfants > 0) {
    let s = `${client.enfants} enfant${client.enfants > 1 ? "s" : ""}`;
    if (client.ages_enfants) s += ` (${client.ages_enfants})`;
    parts.push(s);
  }
  if (client.bebes > 0) {
    let s = `${client.bebes} bébé${client.bebes > 1 ? "s" : ""}`;
    if (client.ages_bebes) s += ` (${client.ages_bebes})`;
    parts.push(s);
  }
  return parts.join(", ");
}

// Politique fixe de l'agence (pas de champ base de données dédié — même
// principe que le disclaimer du devis/facture dans generateClientDocument.ts)
const CONDITIONS_ANNULATION =
  "Remboursement intégral jusqu'à 24h avant une activité (48h pour les excursions culturelles). Passé ce délai, ou en cas de non-présentation, le montant n'est pas remboursé. Les acomptes billets d'avion ne sont jamais remboursables ; tout autre acompte l'est jusqu'à 48h avant, sauf croisières sur le Nil et hôtels.";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#211C16",
          textTransform: "uppercase",
          letterSpacing: 0.7,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ConfirmationTemplate({
  client,
  reservations,
  resaOptions,
  resaTarifs,
  hotelVille,
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  hotelVille?: string;
}) {
  const actives = reservationsActives(reservations)
    .filter((r) => r.date_debut)
    .slice()
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  const totalSejour = actives.reduce(
    (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
  const acompteMontant = client.paiement_type === "acompte" ? Number(client.acompte_montant) || 0 : 0;
  const soldeMontant = Math.max(totalSejour - acompteMontant, 0);
  const acomptePaypal = client.paiement_type === "acompte" && client.acompte_mode === "PayPal";

  return (
    <div
      style={{
        width: DOC_WIDTH,
        background: "#FAF8F2",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#211C16",
      }}
    >
      <div style={{ background: "#211C16", padding: "30px 34px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#C9973E", letterSpacing: 2, textTransform: "uppercase" }}>
          Autour des Dunes
        </div>
        <div style={{ fontSize: 27, fontWeight: 600, color: "#FFFFFF", marginTop: 10 }}>Séjour confirmé</div>
        <div style={{ fontFamily: "var(--font-fraunces)", fontStyle: "italic", fontSize: 14, color: "#C9B79A", marginTop: 8 }}>
          Du {fmtDateLong(client.date_debut)} au {fmtDateLong(client.date_fin)} — {hotelVille || "Hurghada"}
        </div>
      </div>

      <div style={{ padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{client.nom || "—"}</div>
            <div style={{ fontSize: 13, color: "#6B6558", marginTop: 3 }}>{paxLine(client)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#948C7A" }}>Total du séjour</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#C9973E" }}>{euros(totalSejour)}</div>
          </div>
        </div>

        <Section label="Programme">
          <div style={{ borderRadius: 10, overflow: "hidden", background: "#FFFFFF", border: "0.5px solid #EBE6D9" }}>
            {actives.map((r, i) => {
              const total = resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []);
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "13px 15px",
                    borderBottom: i < actives.length - 1 ? "1px solid #EBE6D9" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "var(--font-fraunces)", fontStyle: "italic", fontSize: 12, color: "#8B7F63" }}>
                      {fmtDateShort(r.date_debut || "")}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{r.nom_activite || "Activité"}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{euros(total)}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section label="Conditions de paiement">
          <div style={{ background: "#F2E6D2", borderRadius: 10, padding: "15px 17px" }}>
            {client.paiement_type === "acompte" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 10 }}>
                  <span>Acompte à régler via · {client.acompte_mode || "—"}</span>
                  <span style={{ fontWeight: 700 }}>{euros(acompteMontant)}</span>
                </div>
                {acomptePaypal && (
                  <>
                    {PAYPAL_ME_LINK ? (
                      <a
                        href={`${PAYPAL_ME_LINK}/${acompteMontant.toFixed(2)}`}
                        style={{
                          display: "block",
                          textAlign: "center",
                          background: "#211C16",
                          color: "#FFFFFF",
                          fontSize: 14,
                          fontWeight: 600,
                          borderRadius: 8,
                          padding: 11,
                          textDecoration: "none",
                          marginBottom: 10,
                        }}
                      >
                        Payer {euros(acompteMontant)} sur PayPal ↗
                      </a>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "#5C5342", marginBottom: 10 }}>
                        Adresse PayPal : {AGENCY_CONTACT.email}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#5C5342",
                        lineHeight: 1.7,
                        background: "#FFFFFF",
                        borderRadius: 6,
                        padding: "11px 13px",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        1) Pensez à sélectionner <strong>« paiement entre proches »</strong> sur PayPal pour éviter une
                        taxe (3,1 % du montant).
                        <br />
                        <span style={{ color: "#A32D2D" }}>Info : en cas d&apos;oubli, cette taxe vous sera re-facturée.</span>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        2) Si vous ne trouvez pas l&apos;option « entre proches », contactez-nous avant de clôturer
                        l&apos;envoi du paiement.
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/documents/paypal-entre-proches-1.jpg"
                          alt="Écran PayPal — Entre proches"
                          style={{ width: "50%", borderRadius: 6, border: "0.5px solid #EBE6D9" }}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/documents/paypal-entre-proches-2.jpg"
                          alt="Écran PayPal — Pour vos proches coché"
                          style={{ width: "50%", borderRadius: 6, border: "0.5px solid #EBE6D9" }}
                        />
                      </div>
                      <div>3) Une fois le règlement effectué, envoyez-nous une capture d&apos;écran de la confirmation.</div>
                    </div>
                  </>
                )}
              </>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 600,
                paddingTop: client.paiement_type === "acompte" ? 10 : 0,
                borderTop: client.paiement_type === "acompte" ? "1px solid rgba(33,28,22,0.12)" : "none",
              }}
            >
              <span>Solde à régler sur place</span>
              <span>{euros(soldeMontant)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#5C5342", lineHeight: 1.7, marginTop: 6 }}>
              <strong>En espèces, en euros,</strong> <u>auprès de notre équipe présente sur votre première activité</u>.
              Les <u>distributeurs égyptiens ne délivrent pas d&apos;euros</u> — <strong>à prévoir avant le départ.</strong>
            </div>
          </div>
        </Section>

        <Section label="À savoir">
          <div style={{ background: "#FFFFFF", border: "0.5px solid #EBE6D9", borderRadius: 10, padding: "15px 17px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Horaire du rendez-vous transfert depuis votre hôtel
            </div>
            <div style={{ fontSize: 12.5, color: "#6B6558", lineHeight: 1.6, marginBottom: 15 }}>
              Confirmé la veille de chaque activité, entre 17h et 19h.
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Annulation</div>
            <div style={{ fontSize: 12.5, color: "#6B6558", lineHeight: 1.65 }}>{CONDITIONS_ANNULATION}</div>
          </div>
        </Section>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-fraunces)", fontSize: 15, fontWeight: 600, color: "#211C16" }}>
            Merci d&apos;avoir choisi Autour des Dunes
          </div>
          <div style={{ fontSize: 11.5, color: "#948C7A", marginTop: 8 }}>Une question ? Écrivez-nous.</div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationDocumentStage({
  client,
  reservations,
  resaOptions,
  resaTarifs,
  hotelVille,
  format,
  onDone,
}: {
  client: Client | null;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  hotelVille?: string;
  format: "pdf" | "png" | null;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client || !format) return;
    let cancelled = false;
    const run = async () => {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled || !ref.current) return;
      try {
        const dataUrl = await toPng(ref.current, { width: DOC_WIDTH, pixelRatio: 2 });
        const filename = `confirmation-${(client.nom || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
        if (format === "png") {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = `${filename}.png`;
          link.click();
        } else {
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = dataUrl;
          });
          const pageWidth = 210;
          const pageHeight = (img.height / img.width) * pageWidth;
          const doc = new jsPDF({ unit: "mm", format: [pageWidth, pageHeight] });
          doc.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight);
          doc.save(`${filename}.pdf`);
        }
      } finally {
        if (!cancelled) onDone();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, format]);

  if (!client || !format) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, opacity: 0, zIndex: -1, pointerEvents: "none" }} aria-hidden>
      <div ref={ref}>
        <ConfirmationTemplate
          client={client}
          reservations={reservations}
          resaOptions={resaOptions}
          resaTarifs={resaTarifs}
          hotelVille={hotelVille}
        />
      </div>
    </div>
  );
}
