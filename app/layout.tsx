import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const origin = "https://arkhe-materials.ramzy.tech";
  const description = "A professional spatial-design workspace for materials, quantities, pricing, approvals, and client-ready specification schedules.";
  return {
    metadataBase: new URL(origin),
    title: { default: "Arkhe · Soho Residence", template: "%s · Arkhe" },
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: "Arkhe · Soho Residence",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1792, height: 934, alt: "Arkhe Soho Residence material specification workspace" }],
    },
    twitter: { card: "summary_large_image", title: "Arkhe · Soho Residence", description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
