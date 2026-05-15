import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

// Edge middleware: two responsibilities.
//
// 1. Optional Cloudflare Access JWT verification (when CF_ACCESS_TEAM and
//    CF_ACCESS_AUD are set). Otherwise passes through and assumes Vercel
//    Deployment Protection or another gate is providing auth.
//
// 2. Per-IP rate limit on expensive requests (POST /api/* and Next.js
//    server actions). In-memory sliding-window — survives only within one
//    Edge function instance, so a cold start resets counters. That's fine
//    for a prototype where Vercel's serverless scaling keeps instances
//    warm-ish under load; it's a meaningful brake on a single client
//    hammering one instance, not a defense against distributed abuse.
//    For a sturdier limit, add Upstash Redis or Vercel KV.

// ─── Cloudflare Access ──────────────────────────────────────────────────────

const CF_TEAM = process.env.CF_ACCESS_TEAM;
const CF_AUD = process.env.CF_ACCESS_AUD;

const JWKS = CF_TEAM
  ? createRemoteJWKSet(
      new URL(`https://${CF_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`),
    )
  : null;

// ─── Rate limit ─────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface Bucket {
  count: number;
  resetAt: number;
}
// Per-instance map. Cold starts reset it. Acceptable for a prototype.
const ipBuckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function isExpensiveRequest(req: NextRequest): boolean {
  if (req.method !== "POST") return false;
  // Streaming analyze endpoint.
  if (req.nextUrl.pathname.startsWith("/api/")) return true;
  // Server actions — Next.js posts back to the page path with this header.
  if (req.headers.has("next-action")) return true;
  return false;
}

function consumeQuota(ip: string): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipBuckets.set(ip, fresh);
    return {
      ok: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: fresh.resetAt,
    };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  return {
    ok: true,
    remaining: RATE_LIMIT_MAX - bucket.count,
    resetAt: bucket.resetAt,
  };
}

function rateLimitHeaders(remaining: number, resetAt: number) {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
  };
}

// ─── Middleware entrypoint ──────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  // Local dev bypass.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  // Cloudflare Access JWT check (only when configured).
  if (CF_TEAM && CF_AUD && JWKS) {
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
  }

  // Rate limit expensive requests by IP.
  if (isExpensiveRequest(req)) {
    const ip = getClientIp(req);
    const { ok, remaining, resetAt } = consumeQuota(ip);
    const headers = rateLimitHeaders(remaining, resetAt);
    if (!ok) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return new NextResponse(
        JSON.stringify({
          error: "rate_limit_exceeded",
          message: `Limit is ${RATE_LIMIT_MAX} per hour per IP. Try again in ${retryAfter}s.`,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
