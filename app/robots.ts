import type { MetadataRoute } from "next";

// Disallow everything for every well-behaved crawler. The X-Robots-Tag
// response header (set in next.config.ts) is the same instruction at the
// HTTP layer and catches bots that don't fetch /robots.txt.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
