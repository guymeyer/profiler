import type { Metadata } from "next";
// DEMO MODE: ClerkProvider removed so the app renders on Vercel without
// Clerk env keys. Restore the import + wrapper when re-enabling auth.
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Profiler — Audience intelligence",
  description:
    "Understand how to present work to specific people, leadership groups, and business objectives.",
  // Keep the prototype out of search results. Also set X-Robots-Tag in
  // next.config.ts headers() and serve a Disallow-all robots.txt.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

// Long analyses and customer/stakeholder research routinely run 60–120s;
// the stream endpoint can run longer still. Vercel Pro caps maxDuration
// at 300s. Setting on the root layout applies to every nested route
// segment unless overridden.
export const maxDuration = 300;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
