import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "admin",
  "member",
]);

export const inviteStatus = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const influenceLevel = pgEnum("influence_level", [
  "executive",
  "senior",
  "lead",
  "ic",
]);

export const okrLevel = pgEnum("okr_level", ["company", "bu"]);
export const okrStatus = pgEnum("okr_status", [
  "on-track",
  "at-risk",
  "off-track",
  "achieved",
]);

export const personSource = pgEnum("person_source", [
  "seed",
  "manual",
  "research",
]);

export const customerSource = pgEnum("customer_source", ["manual", "research"]);

// ─── Workspaces + membership ────────────────────────────────────────────────

// A workspace IS the tenant. One workspace per company in the user's mental
// model. Clerk owns user identity; we mirror the Clerk org id here as our
// workspace id so Clerk's first-class Organizations primitive (members,
// invites, roles) maps onto our data without duplication.
export const workspaces = pgTable(
  "workspaces",
  {
    // Clerk org id (e.g. "org_2abc...") — primary key, no separate uuid.
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    primaryDomain: text("primary_domain"), // e.g. "servicenow.com"
    // The workspace's own company profile, drafted at creation via deep
    // research. Lives in the customers table with selfCompany=true and is
    // referenced from here for quick access.
    selfCompanyId: uuid("self_company_id"),
    // Research progress flag — true while the initial company + stakeholder
    // research is still running. UI shows the onboarding-in-progress state.
    researchInProgress: boolean("research_in_progress").notNull().default(false),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspaces_slug_idx").on(t.slug)],
);

// Mirrored Clerk membership — Clerk owns this in its database, but caching
// it here lets us scope queries and check roles without an API roundtrip.
export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id").notNull(), // Clerk user id
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.workspaceId] }),
    index("memberships_workspace_idx").on(t.workspaceId),
  ],
);

// Pending invites. Clerk has its own invite system, but we keep a shadow
// here for join requests initiated from outside Clerk (e.g. a user asking to
// join an existing workspace they don't yet have access to).
export const joinRequests = pgTable(
  "join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requesterUserId: text("requester_user_id").notNull(),
    requesterEmail: text("requester_email").notNull(),
    status: inviteStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: text("resolved_by_user_id"),
  },
  (t) => [
    index("join_requests_workspace_idx").on(t.workspaceId),
    index("join_requests_user_status_idx").on(t.requesterUserId, t.status),
    // Note: we want at most one pending join request per (workspace, user).
    // Enforce in application code via an upsert/check rather than a partial
    // unique index — keeps the schema portable across Drizzle versions.
  ],
);

// ─── Domain entities, tenant-scoped ─────────────────────────────────────────

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // External id used in markdown round-trip + URLs (slug). Per workspace.
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    team: text("team").notNull(),
    influence: influenceLevel("influence").notNull(),
    commStyle: text("comm_style").array().notNull().default([]),
    summary: text("summary").notNull().default(""),
    reviewPreferences: text("review_preferences").array().notNull().default([]),
    visualPreferences: text("visual_preferences").array().notNull().default([]),
    decisionTriggers: text("decision_triggers").array().notNull().default([]),
    objections: text("objections").array().notNull().default([]),
    dos: text("dos").array().notNull().default([]),
    donts: text("donts").array().notNull().default([]),
    exampleGuidance: text("example_guidance").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    // When set, this person is an employee of the named customer (their side)
    // rather than internal (your side).
    customerId: uuid("customer_id"),
    source: personSource("source").notNull().default("manual"),
    researchedAt: timestamp("researched_at", { withTimezone: true }),
    rankWithinLevel: integer("rank_within_level"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("people_workspace_slug_idx").on(t.workspaceId, t.slug),
    index("people_workspace_customer_idx").on(t.workspaceId, t.customerId),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    industry: text("industry"),
    size: text("size"),
    region: text("region"),
    summary: text("summary").notNull().default(""),
    knownStakeholders: text("known_stakeholders").array().notNull().default([]),
    buyingTriggers: text("buying_triggers").array().notNull().default([]),
    evaluationCriteria: text("evaluation_criteria").array().notNull().default([]),
    redFlags: text("red_flags").array().notNull().default([]),
    competitiveContext: text("competitive_context").array().notNull().default([]),
    notes: text("notes").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    source: customerSource("source").notNull().default("manual"),
    // selfCompany=true marks the workspace's own company profile (their
    // employer), as opposed to an external customer they're pitching.
    isSelfCompany: boolean("is_self_company").notNull().default(false),
    researchedAt: timestamp("researched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_workspace_slug_idx").on(t.workspaceId, t.slug),
    index("customers_workspace_self_idx").on(t.workspaceId, t.isSelfCompany),
  ],
);

export const businessUnits = pgTable(
  "business_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    leaderPersonId: uuid("leader_person_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("business_units_workspace_idx").on(t.workspaceId)],
);

export const okrs = pgTable(
  "okrs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    objective: text("objective").notNull(),
    keyResults: text("key_results").array().notNull().default([]),
    level: okrLevel("level").notNull(),
    businessUnitId: uuid("business_unit_id"),
    ownerPersonIds: uuid("owner_person_ids").array().notNull().default([]),
    attachedPersonIds: uuid("attached_person_ids").array().notNull().default([]),
    timeframe: text("timeframe").notNull(),
    status: okrStatus("status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("okrs_workspace_idx").on(t.workspaceId),
    index("okrs_workspace_bu_idx").on(t.workspaceId, t.businessUnitId),
  ],
);

export const researchArtifacts = pgTable(
  "research_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull(),
    source: text("source").notNull().default("Internal"),
    conductedAt: timestamp("conducted_at", { withTimezone: true }),
    participants: text("participants").array().notNull().default([]),
    methodology: text("methodology"),
    tags: text("tags").array().notNull().default([]),
    linkedPersonIds: uuid("linked_person_ids").array().notNull().default([]),
    linkedCustomerIds: uuid("linked_customer_ids").array().notNull().default([]),
    linkedObjectiveIds: text("linked_objective_ids").array().notNull().default([]),
    uploadedFromFilename: text("uploaded_from_filename"),
    uploadedFromKind: text("uploaded_from_kind"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("research_workspace_idx").on(t.workspaceId),
    index("research_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const savedAudiences = pgTable(
  "saved_audiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    personIds: uuid("person_ids").array().notNull().default([]),
    objectiveIds: text("objective_ids").array().notNull().default([]),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("saved_audiences_workspace_idx").on(t.workspaceId)],
);

export const recommendationResults = pgTable(
  "recommendation_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").notNull(),
    // Whole result blob stored as JSONB. Schema evolves; querying happens by
    // workspace + createdAt + linked entities (a few denormalized columns
    // below).
    payload: jsonb("payload").notNull(),
    // Denormalized for filtering/recents:
    title: text("title").notNull(),
    fitScore: integer("fit_score").notNull(),
    personIds: uuid("person_ids").array().notNull().default([]),
    customerId: uuid("customer_id"),
    generatedBy: text("generated_by").notNull(),
    feedback: jsonb("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("results_workspace_idx").on(t.workspaceId),
    index("results_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);
