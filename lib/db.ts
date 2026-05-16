import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

// Single shared Drizzle client backed by the Neon serverless HTTP driver.
// POSTGRES_URL is provided by the Vercel Postgres integration; DATABASE_URL
// is a common fallback for local dev / other hosts.
//
// At build time the env var might not be present (Vercel doesn't inject
// it during static analysis or during pre-deploy verification). We still
// want the module to import cleanly so pages that reference `db` can be
// type-checked and compiled. Resolution: build a real Neon client when the
// URL is present, otherwise a Proxy that throws on any query — so the
// failure is loud and obvious at request time, but module load doesn't
// trip on a missing var.

function buildSql(): NeonQueryFunction<false, false> {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (url) return neon(url);
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[lib/db] POSTGRES_URL / DATABASE_URL is not set. Database queries will throw at request time.",
    );
  }
  const stub = (() => {
    throw new Error(
      "Database not configured: POSTGRES_URL (or DATABASE_URL) is missing.",
    );
  }) as unknown as NeonQueryFunction<false, false>;
  return stub;
}

const sql = buildSql();
export const db = drizzle(sql, { schema });
export { schema };
