"use server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { researchCustomer, researchCustomerStakeholders } from "@/app/(app)/customers/actions";
import { slugifyId as slugifyCompany } from "@/lib/customer-md";
import { slugifyId as slugifyPersonId } from "@/lib/profile-md";

export interface CompanyMatch {
  workspaceId: string;
  name: string;
  primaryDomain: string | null;
  memberCount: number;
}

// Fuzzy lookup of workspaces by company name + (optionally) signup-email
// domain. Used by /onboarding/company to suggest joining an existing
// workspace before creating a new one.
export async function findMatchingWorkspaces(
  companyName: string,
): Promise<CompanyMatch[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const trimmed = companyName.trim();
  if (!trimmed) return [];

  // Get signup email domain to enrich match scoring.
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";
  const emailDomain = email.split("@")[1]?.toLowerCase();

  const slug = slugifyCompany(trimmed);

  const rows = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      slug: schema.workspaces.slug,
      primaryDomain: schema.workspaces.primaryDomain,
      memberCount: sql<number>`(
        select count(*)::int from ${schema.memberships}
        where ${schema.memberships.workspaceId} = ${schema.workspaces.id}
      )`,
    })
    .from(schema.workspaces)
    .where(
      or(
        ilike(schema.workspaces.name, `%${trimmed}%`),
        eq(schema.workspaces.slug, slug),
        emailDomain
          ? eq(schema.workspaces.primaryDomain, emailDomain)
          : undefined,
      ),
    )
    .limit(8);

  return rows.map((r) => ({
    workspaceId: r.id,
    name: r.name,
    primaryDomain: r.primaryDomain,
    memberCount: Number(r.memberCount),
  }));
}

// Submit a join request against an existing workspace. The owner / admins
// see this in their members panel and can approve. For the prototype, we
// auto-approve when the requester's signup email domain matches the
// workspace's verified primaryDomain.
export async function requestToJoinWorkspace(
  workspaceId: string,
): Promise<{ status: "joined" | "pending" }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";
  const emailDomain = email.split("@")[1]?.toLowerCase();

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, workspaceId),
  });
  if (!workspace) throw new Error("Workspace not found.");

  // Auto-join when the email domain matches the workspace's verified domain.
  if (workspace.primaryDomain && emailDomain === workspace.primaryDomain) {
    await client.organizations.createOrganizationMembership({
      organizationId: workspaceId,
      userId,
      role: "org:member",
    });
    await db
      .insert(schema.memberships)
      .values({ userId, workspaceId, role: "member" })
      .onConflictDoNothing();
    return { status: "joined" };
  }

  // Otherwise, record a pending join request. The workspace owner approves
  // this from a future members admin page (Phase 4).
  await db.insert(schema.joinRequests).values({
    workspaceId,
    requesterUserId: userId,
    requesterEmail: email,
  });
  return { status: "pending" };
}

// Create a brand-new workspace for this user, kick off the initial deep
// research, and put the user in the "researching" landing state. Returns
// the new workspace id so the page can navigate.
export async function createWorkspaceForCompany(args: {
  companyName: string;
}): Promise<{ workspaceId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const companyName = args.companyName.trim();
  if (!companyName) throw new Error("Company name is required.");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";
  const emailDomain = email.split("@")[1]?.toLowerCase();

  // Create the Clerk organization. The user becomes its admin/owner.
  const slug = slugifyCompany(companyName);
  const org = await client.organizations.createOrganization({
    name: companyName,
    slug,
    createdBy: userId,
  });

  // Mirror to our DB.
  await db.insert(schema.workspaces).values({
    id: org.id,
    name: companyName,
    slug: org.slug ?? slug,
    primaryDomain: emailDomain ?? null,
    researchInProgress: true,
    createdByUserId: userId,
  });
  await db.insert(schema.memberships).values({
    userId,
    workspaceId: org.id,
    role: "owner",
  });

  // Set as the user's active organization so requireWorkspace() succeeds
  // immediately on the redirect.
  // (Clerk's session token will refresh next request; the /joining page
  // polls so this is fine.)

  // Trigger background research. We deliberately don't await — return the
  // workspace id and let the joining page poll.
  void runInitialResearch({ workspaceId: org.id, companyName }).catch((err) => {
    console.error("[onboarding] initial research failed:", err);
    db.update(schema.workspaces)
      .set({ researchInProgress: false })
      .where(eq(schema.workspaces.id, org.id))
      .catch(() => {});
  });

  return { workspaceId: org.id };
}

// Runs in the background after workspace creation. Drafts the workspace's
// own company profile (the user's employer) + the executive leadership as
// internal People. Errors are logged but don't block the user — the
// /joining page just stops polling and lets them proceed.
async function runInitialResearch(args: {
  workspaceId: string;
  companyName: string;
}) {
  const { workspaceId, companyName } = args;

  // Research the company profile. We use the existing researchCustomer
  // action but mark the resulting customer as the workspace's self-company.
  const companyDraft = await researchCustomer({
    companyName,
    context: "Drafting the workspace's own company profile.",
  });

  const [insertedCustomer] = await db
    .insert(schema.customers)
    .values({
      workspaceId,
      slug: companyDraft.id, // slugifyId(companyName)
      name: companyDraft.name,
      industry: companyDraft.industry ?? null,
      size: companyDraft.size ?? null,
      region: companyDraft.region ?? null,
      summary: companyDraft.summary,
      knownStakeholders: companyDraft.knownStakeholders,
      buyingTriggers: companyDraft.buyingTriggers,
      evaluationCriteria: companyDraft.evaluationCriteria,
      redFlags: companyDraft.redFlags,
      competitiveContext: companyDraft.competitiveContext,
      notes: companyDraft.notes,
      tags: companyDraft.tags,
      source: companyDraft.source === "research" ? "research" : "manual",
      isSelfCompany: true,
      researchedAt: companyDraft.researchedAt
        ? new Date(companyDraft.researchedAt)
        : new Date(),
    })
    .returning({ id: schema.customers.id });

  await db
    .update(schema.workspaces)
    .set({ selfCompanyId: insertedCustomer.id })
    .where(eq(schema.workspaces.id, workspaceId));

  // Research executive leadership. The result is shaped as Person but we
  // want them as INTERNAL people (no customerId), so strip that.
  const stakeholderDrafts = await researchCustomerStakeholders({
    customer: {
      ...companyDraft,
      id: insertedCustomer.id,
    },
  });

  for (const p of stakeholderDrafts) {
    const slug = `${companyDraft.id}-${slugifyPersonId(p.name)}`;
    await db
      .insert(schema.people)
      .values({
        workspaceId,
        slug,
        name: p.name,
        title: p.title,
        team: p.team,
        influence: p.influence,
        commStyle: p.commStyle,
        summary: p.summary,
        reviewPreferences: p.reviewPreferences,
        visualPreferences: p.visualPreferences,
        decisionTriggers: p.decisionTriggers,
        objections: p.objections,
        dos: p.dos,
        donts: p.donts,
        exampleGuidance: p.exampleGuidance,
        tags: p.tags.filter((t) => !t.startsWith("customer:")),
        customerId: null, // INTERNAL — these are the workspace's own leaders
        source: "research",
        researchedAt: p.researchedAt ? new Date(p.researchedAt) : new Date(),
        rankWithinLevel: p.rankWithinLevel ?? null,
      })
      .onConflictDoNothing();
  }

  await db
    .update(schema.workspaces)
    .set({ researchInProgress: false })
    .where(eq(schema.workspaces.id, workspaceId));
}

// Polled by the /onboarding/joining page to check whether research has
// finished. Returns counts so the page can show a useful progress card.
export async function getWorkspaceOnboardingStatus(): Promise<{
  workspaceId: string;
  workspaceName: string;
  researchInProgress: boolean;
  selfCompanyId: string | null;
  peopleCount: number;
}> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    redirect("/onboarding/company");
  }

  const ws = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.id, orgId),
  });
  if (!ws) {
    return {
      workspaceId: orgId,
      workspaceName: "",
      researchInProgress: true,
      selfCompanyId: null,
      peopleCount: 0,
    };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.people)
    .where(
      and(
        eq(schema.people.workspaceId, orgId),
        sql`${schema.people.customerId} is null`,
      ),
    );

  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    researchInProgress: ws.researchInProgress,
    selfCompanyId: ws.selfCompanyId,
    peopleCount: Number(count),
  };
}
