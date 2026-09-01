"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { Client, Reservation, ReservationOption, ReservationTarif } from "@/lib/types";
import { agesLabel, reservationsActives, resaTotalMontant } from "@/lib/resa";
import { PAYPAL_ME_LINK, PAYPAL_EMAIL } from "@/lib/constants";
import { PAYPAL_ENTRE_PROCHES_1, PAYPAL_ENTRE_PROCHES_2 } from "@/lib/paypalScreenshots";

// Un PNG (Instagram) est une image plate — aucun lien ne peut jamais y être
// cliquable, quel que soit l'outil utilisé. Le QR code est le contournement
// standard : l'appli Photos (iOS et Android) détecte un QR code dans une
// image et propose de l'ouvrir directement, même en le regardant depuis le
// même téléphone qui l'a reçu (pas besoin d'un second appareil).
function acomptePaypalInfo(client: Client) {
  const acompteMontant = client.paiement_type === "acompte" ? Number(client.acompte_montant) || 0 : 0;
  const acomptePaypal = client.paiement_type === "acompte" && client.acompte_mode === "PayPal";
  const url = acomptePaypal && PAYPAL_ME_LINK ? `${PAYPAL_ME_LINK}/${acompteMontant.toFixed(2)}` : null;
  return { acompteMontant, acomptePaypal, url };
}

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
    parts.push(`${client.enfants} enfant${client.enfants > 1 ? "s" : ""}${agesLabel(client.ages_enfants)}`);
  }
  if (client.bebes > 0) {
    parts.push(`${client.bebes} bébé${client.bebes > 1 ? "s" : ""}${agesLabel(client.ages_bebes)}`);
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
          fontSize: 13.5,
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
  qrDataUrl,
}: {
  client: Client;
  reservations: Reservation[];
  resaOptions: Record<string, ReservationOption[]>;
  resaTarifs: Record<string, ReservationTarif[]>;
  hotelVille?: string;
  qrDataUrl?: string | null;
}) {
  const actives = reservationsActives(reservations)
    .filter((r) => r.date_debut)
    .slice()
    .sort((a, b) => (a.date_debut || "").localeCompare(b.date_debut || ""));

  const totalSejour = actives.reduce(
    (s, r) => s + resaTotalMontant(r, client, resaOptions[r.id] || [], resaTarifs[r.id] || []),
    0
  );
  const { acompteMontant, acomptePaypal, url: paypalUrl } = acomptePaypalInfo(client);
  const soldeMontant = Math.max(totalSejour - acompteMontant, 0);

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
        <div style={{ fontSize: 14, fontWeight: 600, color: "#C9973E", letterSpacing: 2, textTransform: "uppercase" }}>
          Autour des Dunes
        </div>
        <div style={{ fontSize: 30, fontWeight: 600, color: "#FFFFFF", marginTop: 10 }}>Séjour confirmé</div>
        <div style={{ fontFamily: "var(--font-fraunces)", fontStyle: "italic", fontSize: 16, color: "#C9B79A", marginTop: 8 }}>
          Du {fmtDateLong(client.date_debut)} au {fmtDateLong(client.date_fin)} — {hotelVille || "Hurghada"}
        </div>
      </div>

      <div style={{ padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>{client.nom || "—"}</div>
            <div style={{ fontSize: 14.5, color: "#6B6558", marginTop: 3 }}>{paxLine(client)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12.5, color: "#948C7A" }}>Total du séjour</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#C9973E" }}>{euros(totalSejour)}</div>
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
                    <div style={{ fontFamily: "var(--font-fraunces)", fontStyle: "italic", fontSize: 13.5, color: "#8B7F63" }}>
                      {fmtDateShort(r.date_debut || "")}
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 500, marginTop: 2 }}>{r.nom_activite || "Activité"}</div>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 600 }}>{euros(total)}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section label="Conditions de paiement">
          <div style={{ background: "#F2E6D2", borderRadius: 10, padding: "15px 17px" }}>
            {client.paiement_type === "acompte" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 15.5, marginBottom: 10 }}>
                  <span>
                    Acompte à régler via · {client.acompte_mode || "—"}
                    {acomptePaypal && (
                      <span style={{ fontSize: 11.5, color: "#948C7A", marginLeft: 6 }}>({PAYPAL_EMAIL})</span>
                    )}
                  </span>
                  <span style={{ fontWeight: 700 }}>{euros(acompteMontant)}</span>
                </div>
                {acomptePaypal && (
                  <>
                    {paypalUrl ? (
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                        <a
                          href={paypalUrl}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            background: "#211C16",
                            color: "#FFFFFF",
                            fontSize: 14.5,
                            fontWeight: 600,
                            borderRadius: 8,
                            padding: "11px 10px",
                            textDecoration: "none",
                          }}
                        >
                          Payer {euros(acompteMontant)} sur PayPal ↗
                        </a>
                        {qrDataUrl && (
                          <div
                            style={{
                              background: "#FFFFFF",
                              borderRadius: 8,
                              padding: 4,
                              flexShrink: 0,
                              lineHeight: 0,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrDataUrl} alt="QR code de paiement PayPal" style={{ width: 48, height: 48 }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13.5, color: "#5C5342", marginBottom: 10 }}>
                        Adresse PayPal : {PAYPAL_EMAIL}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 13.5,
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
                      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={PAYPAL_ENTRE_PROCHES_1}
                          alt="Écran PayPal — Entre proches"
                          style={{ width: 120, borderRadius: 4, border: "0.5px solid #EBE6D9" }}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={PAYPAL_ENTRE_PROCHES_2}
                          alt="Écran PayPal — Pour vos proches coché"
                          style={{ width: 120, borderRadius: 4, border: "0.5px solid #EBE6D9" }}
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
                fontSize: 15.5,
                fontWeight: 600,
                paddingTop: client.paiement_type === "acompte" ? 10 : 0,
                borderTop: client.paiement_type === "acompte" ? "1px solid rgba(33,28,22,0.12)" : "none",
              }}
            >
              <span>Solde à régler sur place</span>
              <span>{euros(soldeMontant)}</span>
            </div>
            <div style={{ fontSize: 13.5, color: "#5C5342", lineHeight: 1.7, marginTop: 6 }}>
              <strong>En espèces, en euros,</strong> <u>auprès de notre équipe présente sur votre première activité</u>.
              Les <u>distributeurs égyptiens ne délivrent pas d&apos;euros</u> — <strong>à prévoir avant le départ.</strong>
            </div>
          </div>
        </Section>

        <Section label="À savoir">
          <div style={{ background: "#FFFFFF", border: "0.5px solid #EBE6D9", borderRadius: 10, padding: "15px 17px" }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 4 }}>
              Horaire du rendez-vous transfert depuis votre hôtel
            </div>
            <div style={{ fontSize: 13.5, color: "#6B6558", lineHeight: 1.6, marginBottom: 15 }}>
              Confirmé la veille de chaque activité, entre 17h et 19h.
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 4 }}>Annulation</div>
            <div style={{ fontSize: 13.5, color: "#6B6558", lineHeight: 1.65 }}>{CONDITIONS_ANNULATION}</div>
          </div>
        </Section>

        {acomptePaypal && (
          <Section label="Questions fréquentes">
            <div style={{ background: "#FFFFFF", border: "0.5px solid #EBE6D9", borderRadius: 10, padding: "15px 17px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>
                Pourquoi « paiement entre proches » ?
              </div>
              <div style={{ fontSize: 13.5, color: "#6B6558", lineHeight: 1.65, marginBottom: 16 }}>
                Sans cette option, PayPal nous prélève 3,1 % du montant envoyé — nous devons alors vous refacturer
                cette part pour ne pas la perdre, comme pour tous nos clients. Une facture justificative peut vous
                être fournie sur demande. Si vous préférez régler en « Biens et services », ajoutez simplement 3,1 %
                à votre montant d&apos;acompte.
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>Vous n&apos;avez pas de compte PayPal ?</div>
              <div style={{ fontSize: 13.5, color: "#6B6558", lineHeight: 1.65 }}>
                Vous pouvez en créer un en une minute —{" "}
                <a
                  href="https://www.paypal.com/fr/webapps/mpp/account-selection"
                  style={{ color: "#8B7F63", textDecoration: "underline" }}
                >
                  cliquez ici pour voir comment
                </a>
                . Vous pouvez aussi demander à un proche de régler à votre place : il suffit d&apos;indiquer le nom de
                la réservation en référence du paiement.
              </div>
            </div>
          </Section>
        )}

        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-fraunces)", fontSize: 17, fontWeight: 600, color: "#211C16" }}>
            Merci d&apos;avoir choisi Autour des Dunes
          </div>
          <div style={{ fontSize: 13, color: "#948C7A", marginTop: 8 }}>Une question ? Écrivez-nous.</div>
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
  // undefined = pas encore calculé, null = pas de PayPal sur ce séjour.
  const [qrDataUrl, setQrDataUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!client) {
      setQrDataUrl(undefined);
      return;
    }
    const { url } = acomptePaypalInfo(client);
    if (!url) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client || !format || qrDataUrl === undefined) return;
    let cancelled = false;
    const run = async () => {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled || !ref.current) return;
      // Les captures PayPal + le QR code sont des <img> ordinaires — sans
      // attendre explicitement leur chargement, toPng peut rasteriser avant
      // qu'ils soient décodés et les rendre invisibles dans le résultat
      // (constaté : la photo "entre proches" absente du PDF/PNG généré).
      const imgs = Array.from(ref.current.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              })
        )
      );
      if (cancelled || !ref.current) return;
      try {
        // Les liens (PayPal.me, créer un compte) doivent rester mesurés
        // AVANT la rasterisation — toPng aplati tout en pixels, un lien
        // "affiché" dans l'image ne serait pas cliquable sans cette
        // annotation ajoutée séparément par-dessus, aux mêmes coordonnées.
        const containerRect = ref.current.getBoundingClientRect();
        const linkRects = Array.from(ref.current.querySelectorAll<HTMLAnchorElement>("a[href]")).map((el) => ({
          url: el.getAttribute("href") || "",
          rect: el.getBoundingClientRect(),
        }));

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
          // jsPDF embarque son propre décodeur PNG (pas les décodeurs natifs
          // du navigateur) qui échoue silencieusement sur certains PNG
          // composites — ici, celui produit en combinant plusieurs <img>
          // JPEG dans un même canvas via toPng : le PNG s'affiche
          // parfaitement dans le navigateur, mais les captures "entre
          // proches" ressortaient blanches une fois collées dans le PDF.
          // Repasser par un canvas en JPEG contourne ce décodeur PNG limité.
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
          const pageWidth = 210;
          const pageHeight = (img.height / img.width) * pageWidth;
          const doc = new jsPDF({ unit: "mm", format: [pageWidth, pageHeight] });
          doc.addImage(jpegDataUrl, "JPEG", 0, 0, pageWidth, pageHeight);
          const scale = pageWidth / containerRect.width;
          linkRects.forEach(({ url, rect }) => {
            if (!url) return;
            doc.link(
              (rect.left - containerRect.left) * scale,
              (rect.top - containerRect.top) * scale,
              rect.width * scale,
              rect.height * scale,
              { url }
            );
          });
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
  }, [client, format, qrDataUrl]);

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
          qrDataUrl={qrDataUrl}
        />
      </div>
    </div>
  );
}
