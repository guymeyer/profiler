import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

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
  // Keep the prototype out of search results. Belt-and-braces: also set
  // X-Robots-Tag via next.config.ts headers() and a Disallow-all robots.txt.
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

// Vercel Pro caps maxDuration at 300s. Long analyses and customer/stakeholder
// research (which uses web_search and can chain several searches) routinely
// run 60-120s; the stream endpoint can run longer still. Setting on the root
// layout applies to all nested route segments unless individual files
// override.
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
      <body className="min-h-full">
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
