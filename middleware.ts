import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// DEMO MODE: Clerk middleware removed so the prototype runs on Vercel
// without Clerk env keys. Restoration plan when re-enabling auth:
//   1) reinstate `import { clerkMiddleware, createRouteMatcher } …`
//   2) wrap the rate-limit body in `clerkMiddleware(async (auth, req) => …)`
//   3) call `await auth.protect()` after the public-route check
//   4) set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY on Vercel
//
// The rate limit stays — per-IP, in-memory, production-only.

// ─── Rate limit (per IP, in-memory, sliding window) ─────────────────────────

const RATE_LIMIT_MAX = 200;
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

export function middleware(req: NextRequest) {
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
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
