import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Auth helpers used by server components, server actions, and route handlers
// to enforce that every request happens within an authenticated user's
// active workspace.

export interface AuthContext {
  userId: string;
  workspaceId: string; // === Clerk organization id
  role: "owner" | "admin" | "member";
}

// Returns the auth context if both a user session AND an active organization
// exist. Otherwise returns null — let the caller decide whether to redirect
// to /sign-in or /onboarding.
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return null;
  if (!orgId) return null;
  return {
    userId,
    workspaceId: orgId,
    role: normalizeRole(orgRole),
  };
}

// Enforced version — redirects when missing. Use this in server components
// and route handlers for routes that require a workspace context.
export async function requireWorkspace(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
    redirect("/onboarding/company");
  }
  return ctx;
}

// Owner-only variant for actions that mutate workspace-level settings
// (e.g. inviting members, deleting the workspace).
export async function requireOwner(): Promise<AuthContext> {
  const ctx = await requireWorkspace();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new Error("Forbidden — owner or admin role required.");
  }
  return ctx;
}

// Ensures the workspace row in our DB matches Clerk's organization. Called
// lazily by requireWorkspace on cold reads + on org-switch — keeps the
// mirror table in sync without needing webhooks for the prototype.
export async function ensureWorkspaceRow(ctx: AuthContext): Promise<void> {
  const { workspaceId, userId } = ctx;
  const existing = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, workspaceId),
  });
  if (existing) return;
  // Fetch organization details from Clerk to populate name/slug.
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({
    organizationId: workspaceId,
  });
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: org.name,
    slug: org.slug ?? workspaceId,
    createdByUserId: userId,
  });
  await db
    .insert(schema.memberships)
    .values({
      userId,
      workspaceId,
      role: "owner",
    })
    .onConflictDoNothing();
}

function normalizeRole(role: string | null | undefined): AuthContext["role"] {
  // Clerk roles come back as "org:admin", "org:member", etc.
  if (!role) return "member";
  if (role.endsWith("admin")) return "admin";
  if (role.endsWith("owner")) return "owner";
  return "member";
}
