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
   *
   * `src/app/icon.png` (192×192) and `src/app/apple-icon.png` (180×180)
   * are auto-discovered by Next.js. The explicit `icons` block below
   * additionally registers the multi-size PNG favicons in /public so
   * older browsers can pick the matching size.
   *
   * opengraph-image PNG (1200×630) is not yet generated — social
   * previews fall back to plain title + description until then.
   */
  icons: {
    icon: [
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
    ],
  },
  openGraph: {
    title: "Clemvion — Agentic Workflow",
    description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Clemvion — Agentic Workflow",
    description: "AI가 엮고, 실행하고, 성장시키는 워크플로우 시스템",
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
