import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Fraunces } from "next/font/google";
import "./globals.css";

// Chargé pour le flyer d'activité (cf. CatalogueFlyer.tsx) — c'est la
// police du titre sur les flyers Canva de l'agence. Chargé au niveau du
// layout (pas dans le composant du flyer) pour que la police soit déjà
// prête avant toute génération d'image, évitant un flyer exporté avec la
// police de repli si on l'ouvrait dans un composant qui vient de monter.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

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
      className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
