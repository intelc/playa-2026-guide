import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Playa 2026 — Burning Man Event Guide",
    description: "Explore 3,744 Burning Man 2026 events. Filter by day, category, camp, and location, then save your playa plan.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Playa 2026 — Find Your Next Wonder",
      description: "A field guide to 3,744 Burning Man events across nine days in Black Rock City.",
      type: "website",
      images: [{ url: "https://playa.intelchen.com/og.png", width: 1792, height: 1024, alt: "Playa 2026 — Find Your Next Wonder" }],
    },
    twitter: { card: "summary_large_image", title: "Playa 2026", description: "Find your next wonder in the dust.", images: ["https://playa.intelchen.com/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4efe5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
