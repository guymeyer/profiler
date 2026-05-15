import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

// Belt-and-braces auth gate. Cloudflare Access is the primary protection —
// it sits in front of the deployment and won't pass traffic through without a
// valid Access session. This middleware additionally verifies the JWT
// Cloudflare Access injects on each request, so even if someone hits the raw
// Vercel deployment URL directly (bypassing the Cloudflare-routed domain),
// they're rejected.
//
// Config (set in Vercel project env):
//   CF_ACCESS_TEAM   — your team slug, e.g. "yourcompany"
//                      (full URL: https://<team>.cloudflareaccess.com)
//   CF_ACCESS_AUD    — the Application Audience tag from the Access app
//                      settings in the Cloudflare Zero Trust dashboard.
//
// Behavior:
//   - In `next dev` (NODE_ENV !== "production"): pass through.
//   - In production with config missing: 503 (fail-closed; better than
//     accidentally shipping the app publicly while you're still wiring up
//     Cloudflare).
//   - In production with config set: verify Cf-Access-Jwt-Assertion. Reject
//     missing or invalid tokens.

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

  // Fail closed if production is missing config — never accidentally serve
  // the app publicly.
  if (!CF_TEAM || !CF_AUD || !JWKS) {
    return new NextResponse(
      "Server misconfigured: CF_ACCESS_TEAM / CF_ACCESS_AUD not set.",
      { status: 503 },
    );
  }

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
