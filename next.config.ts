import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse / pdfjs-dist load their own worker code at runtime. Bundling them
  // through Turbopack breaks the worker boot; mark them as external so Node
  // resolves them from node_modules at request time.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
  experimental: {
    serverActions: {
      // Default is 1 MB. Match our internal extractDocument cap of 10 MB so
      // research/artifact PDF + DOCX uploads round-trip cleanly.
      bodySizeLimit: "10mb",
    },
  },
  // Tell crawlers to stay out at the HTTP layer. Catches bots that don't
  // parse the HTML <meta> tag (most aggressive scrapers).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
