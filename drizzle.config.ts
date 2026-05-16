import type { Config } from "drizzle-kit";

// Drizzle Kit reads POSTGRES_URL from .env.local for local dev. In production
// Vercel injects the same env var via the Vercel Postgres integration.
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL || "",
  },
  // Verbose output during generate; quiet during migrate.
  verbose: true,
  strict: true,
} satisfies Config;
