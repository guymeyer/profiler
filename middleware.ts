import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

// Optional Cloudflare Access JWT verification layer. Only active when the
// CF_ACCESS_TEAM and CF_ACCESS_AUD env vars are set — when they're absent,
// the middleware passes through and assumes another gate (typically Vercel
// Deployment Protection / Vercel Authentication) is protecting the deploy.
//
// Config (set in Vercel project env, only when using Cloudflare Access):
//   CF_ACCESS_TEAM   — your team slug, e.g. "yourcompany"
//                      (full URL: https://<team>.cloudflareaccess.com)
//   CF_ACCESS_AUD    — the Application Audience tag from the Access app
//                      settings in the Cloudflare Zero Trust dashboard.
//
// Behavior:
//   - `next dev` (NODE_ENV !== "production"): pass through.
//   - Production, CF config absent: pass through. Vercel's own deployment
//     protection (if enabled) is the gate; if it's not enabled, the deploy
//     is public. Make sure exactly one of (Vercel Auth, Cloudflare Access,
//     or this middleware's CF mode) is active before sharing the URL.
//   - Production, CF config present: require + verify Cf-Access-Jwt-Assertion
//     header. Defense-in-depth on top of CF Access.

const CF_TEAM = process.env.CF_ACCESS_TEAM;
const CF_AUD = process.env.CF_ACCESS_AUD;

// `createRemoteJWKSet` caches keys internally, so this is cheap to construct
// once at module load and reuse across requests.
const JWKS = CF_TEAM
  ? createRemoteJWKSet(
      new URL(`https://${CF_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`),
    )
  : null;

export async function middleware(req: NextRequest) {
  // Local dev bypass.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  // No Cloudflare Access config — middleware steps aside and assumes another
  // gate (Vercel Auth, IP allowlist, etc.) is doing the protection. If you
  // want this layer to be your only auth, set CF_ACCESS_TEAM + CF_ACCESS_AUD.
  if (!CF_TEAM || !CF_AUD || !JWKS) return NextResponse.next();

  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) {
    return new NextResponse(
      "Forbidden — this application must be accessed via Cloudflare Access.",
      { status: 403 },
    );
  }

  try {
    await jwtVerify(jwt, JWKS, {
      issuer: `https://${CF_TEAM}.cloudflareaccess.com`,
      audience: CF_AUD,
    });
  } catch {
    return new NextResponse("Forbidden — invalid Cloudflare Access token.", {
      status: 403,
    });
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except Next.js internals + static assets. API routes are
  // intentionally included — they should also be gated.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
