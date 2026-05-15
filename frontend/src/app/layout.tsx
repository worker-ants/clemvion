import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clemvion",
  description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
  /*
   * Icon + OG assets — spec/6-brand.md §8.4.1, §8.4.6.
   * Explicit declaration (instead of Next.js auto-discovery) so the
   * 16px-optimized vector (spec §8.4.2) is registered alongside the
   * 32px master icon.svg.
   *
   * favicon.ico is intentionally omitted — modern browsers prefer SVG.
   * Regenerating a multi-size .ico requires raster tooling (sharp /
   * ImageMagick) and is tracked as a Stage 2 follow-up.
   *
   * apple-icon and opengraph-image are served as SVG; PNG variants
   * are pending the same raster-tooling follow-up.
   */
  icons: {
    icon: [
      { url: "/favicon-16.svg", type: "image/svg+xml", sizes: "16x16" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" }],
  },
  openGraph: {
    title: "Clemvion — Agentic Workflow",
    description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
    images: [
      {
        url: "/opengraph-image.svg",
        width: 1200,
        height: 630,
        type: "image/svg+xml",
        alt: "Clemvion — Agentic Workflow",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clemvion — Agentic Workflow",
    description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
    images: ["/opengraph-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-[family-name:var(--font-geist-sans)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
