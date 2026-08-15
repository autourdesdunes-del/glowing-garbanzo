import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces, Work_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

// Chargées pour le flyer d'activité (cf. CatalogueFlyer.tsx) — le système
// de marque de l'agence (CLAUDE.md) : Fraunces pour les titres, Work Sans
// pour le texte courant, Space Mono pour les dates/montants. Chargées au
// niveau du layout (pas dans le composant du flyer) pour que les polices
// soient déjà prêtes avant toute génération d'image, évitant un flyer
// exporté avec la police de repli si on l'ouvrait dans un composant qui
// vient de monter.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" });
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} ${workSans.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
