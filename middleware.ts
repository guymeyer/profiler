import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Middleware stack, applied in order:
//
// 1. Per-IP rate limit on expensive POST requests. In-memory sliding window —
//    survives only within one Edge function instance, so cold starts reset
//    counters. A real shared limit needs Upstash Redis. This is fine for
//    prototype traffic but isn't airtight against distributed abuse.
//
// 2. Clerk auth. Sign-in / sign-up routes are public. Everything else
//    requires a signed-in user. Routes that require an active organization
//    are enforced inside server components via requireWorkspace().
//
// 3. (Removed) Cloudflare Access JWT verification. We standardized on Clerk
//    + Vercel-native protection; the CF Access middleware was deleted
//    rather than left dormant.

// ─── Rate limit (per IP, in-memory, sliding window) ─────────────────────────

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}
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
  if (req.nextUrl.pathname.startsWith("/api/")) return true;
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
    return { ok: true, remaining: RATE_LIMIT_MAX - 1, resetAt: fresh.resetAt };
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

// ─── Clerk auth + public route allowlist ────────────────────────────────────

// Routes accessible without a Clerk session. Everything else is protected.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Health checks if we add any later
  "/api/health(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Local dev keeps Clerk gating but skips rate limit so iteration is fast.
  if (process.env.NODE_ENV === "production" && isExpensiveRequest(req)) {
    const ip = getClientIp(req);
    const { ok, remaining, resetAt } = consumeQuota(ip);
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
            ...rateLimitHeaders(remaining, resetAt),
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
    // Rate-limit headers are added to successful responses too; we can't
    // mutate the Clerk-protected response easily, so we just continue.
  }

  // Public routes: skip auth.
  if (isPublicRoute(req)) return NextResponse.next();

  // Everything else requires a session. The orgId / workspace check happens
  // in server components via requireWorkspace() — sending users to
  // /onboarding/company when they have a user but no active org.
  await auth.protect();
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
