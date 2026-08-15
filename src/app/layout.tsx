import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces, Quicksand, Space_Mono } from "next/font/google";
import "./globals.css";

// Chargées pour le flyer d'activité (cf. CatalogueFlyer.tsx) — Fraunces
// pour le titre (police du flyer Canva d'origine), Space Mono pour le prix,
// Quicksand pour le texte courant. Mélanie a identifié la vraie police du
// flyer comme "Now" (police premium Canva, absente de Google Fonts) — Work
// Sans puis Poppins testés le 2026-08-15 jugés pas assez proches ; Quicksand
// est l'équivalent gratuit le plus proche (même famille géométrique arrondie
// et informelle). Chargées au niveau du layout (pas dans le composant du
// flyer) pour que les polices soient déjà prêtes avant toute génération
// d'image, évitant un flyer exporté avec la police de repli si on
// l'ouvrait dans un composant qui vient de monter.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-quicksand" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  title: "Autour des Dunes — Espace interne",
  description: "CRM interne Autour des Dunes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} ${quicksand.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
