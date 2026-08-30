import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "Playa 2026 — Bilingual Burning Man Event Guide",
    description: "Explore 3,744 Burning Man 2026 events in English and Chinese. Filter by day, category, camp, and location, then save your playa plan.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Playa 2026 — Find Your Next Wonder",
      description: "A bilingual field guide to 3,744 Burning Man events across nine days in Black Rock City.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1792, height: 1024, alt: "Playa 2026 — Find Your Next Wonder" }],
    },
    twitter: { card: "summary_large_image", title: "Playa 2026", description: "Find your next wonder in the dust.", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
