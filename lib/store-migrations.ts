// Persisted-store migrations. Versioned with the `version` field on the
// Zustand persist config. Each migration is a pure function over the
// snapshot — never read live state, never side-effect.
//
// IDs are preserved across migrations so external references (DerivedMetric
// backrefs in particular) survive the move from per-kind slices to a
// unified `documents` record.

import type {
  BusinessUnit,
  Company,
  CustomerCompany,
  Document,
  DocumentBase,
  InternalCompany,
  MemoDocument,
  MicrositeDocument,
  OKR,
  Person,
  PRDDocument,
  ResearchDocument,
  DeckDocument,
} from "@/lib/types";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

// Name used for the seeded internal Company. Baked in for now; once
// Clerk multi-tenant lands this becomes the workspace's display name.
const INTERNAL_COMPANY_NAME = "ServiceNow";

// Loose shapes describing the legacy v1 records — kept as `any`-ish maps
// so a malformed snapshot doesn't crash boot. The migration only reads
// fields it expects.
interface LegacyV1Snapshot {
  research?: Record<string, LegacyResearch>;
  prds?: Record<string, LegacyPRD>;
  memos?: Record<string, LegacyMemo>;
  syntheses?: Record<string, LegacySynthesis>;
  decks?: Record<string, LegacyDeck>;
  documents?: Record<string, Document>;
  [key: string]: unknown;
}

interface LegacyResearch {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  conductedAt?: string;
  participants: string[];
  methodology?: string;
  tags: string[];
  linkedPersonIds: string[];
  linkedCustomerIds: string[];
  linkedObjectiveIds: string[];
  uploadedFrom?: { filename: string; kind: string };
  sourceUrl?: string;
  locked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface LegacyPRD {
  id: string;
  title: string;
  summary: string;
  problem: string;
  solution: string;
  targetUsers: string[];
  successMetrics: string[];
  status: "draft" | "review" | "approved" | "shipped";
  targetShipDate?: string;
  content: string;
  source?: string;
  tags: string[];
  linkedPersonIds: string[];
  linkedCustomerIds: string[];
  linkedObjectiveIds: string[];
  linkedBusinessUnitId?: string;
  uploadedFrom?: { filename: string; kind: string };
  sourceUrl?: string;
  locked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface LegacyMemo {
  id: string;
  title: string;
  summary: string;
  memoKind: "strategy" | "brief" | "post-mortem" | "market" | "other";
  keyClaims: string[];
  decisions: string[];
  content: string;
  source?: string;
  tags: string[];
  linkedPersonIds: string[];
  linkedCustomerIds: string[];
  linkedObjectiveIds: string[];
  linkedBusinessUnitId?: string;
  uploadedFrom?: { filename: string; kind: string };
  sourceUrl?: string;
  locked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface LegacySynthesis {
  id: string;
  title: string;
  researchIds: string[];
  outline: unknown;
  html: string;
  modifier?: string;
  generatedBy: "anthropic" | "mock";
  model?: string;
  createdAt: string;
  updatedAt?: string;
}

interface LegacyDeck {
  id: string;
  synthesisId: string;
  title: string;
  audience: unknown;
  slides: unknown[];
  generatedBy: "anthropic" | "mock";
  model?: string;
  createdAt: string;
  updatedAt?: string;
}

// Top-level entry. The Zustand `migrate(persistedState, version)` hook
// hands us whatever was serialized — we accept it loosely, narrow as we
// go, and never throw.
export function migrateV1ToV2(
  persisted: unknown,
): Record<string, unknown> {
  if (!persisted || typeof persisted !== "object") return {};
  const snapshot = persisted as LegacyV1Snapshot;

  const documents: Record<string, Document> = {
    ...(snapshot.documents ?? {}),
  };

  for (const r of Object.values(snapshot.research ?? {})) {
    if (!r?.id) continue;
    documents[r.id] = researchToDocument(r);
  }
  for (const p of Object.values(snapshot.prds ?? {})) {
    if (!p?.id) continue;
    documents[p.id] = prdToDocument(p);
  }
  for (const m of Object.values(snapshot.memos ?? {})) {
    if (!m?.id) continue;
    documents[m.id] = memoToDocument(m);
  }
  for (const s of Object.values(snapshot.syntheses ?? {})) {
    if (!s?.id) continue;
    documents[s.id] = synthesisToDocument(s);
  }
  for (const d of Object.values(snapshot.decks ?? {})) {
    if (!d?.id) continue;
    documents[d.id] = deckToDocument(d);
  }

  return { ...snapshot, documents };
}

function baseFrom<T extends LegacyResearch | LegacyPRD | LegacyMemo>(
  r: T,
): DocumentBase {
  return {
    id: r.id,
    kind: "research", // overwritten by the caller's spread
    title: r.title,
    summary: r.summary,
    content: r.content,
    source: "source" in r ? (r as LegacyResearch).source : r.source,
    tags: r.tags ?? [],
    linkedPersonIds: r.linkedPersonIds ?? [],
    linkedCustomerIds: r.linkedCustomerIds ?? [],
    linkedObjectiveIds: r.linkedObjectiveIds ?? [],
    linkedBusinessUnitId:
      "linkedBusinessUnitId" in r ? r.linkedBusinessUnitId : undefined,
    uploadedFrom: r.uploadedFrom,
    sourceUrl: r.sourceUrl,
    locked: r.locked,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function researchToDocument(r: LegacyResearch): ResearchDocument {
  return {
    ...baseFrom(r),
    kind: "research",
    properties: {
      participants: r.participants ?? [],
      methodology: r.methodology,
      conductedAt: r.conductedAt,
    },
  };
}

function prdToDocument(p: LegacyPRD): PRDDocument {
  return {
    ...baseFrom(p),
    kind: "prd",
    properties: {
      problem: p.problem,
      solution: p.solution,
      targetUsers: p.targetUsers ?? [],
      successMetrics: p.successMetrics ?? [],
      status: p.status,
      targetShipDate: p.targetShipDate,
    },
  };
}

function memoToDocument(m: LegacyMemo): MemoDocument {
  return {
    ...baseFrom(m),
    kind: "memo",
    properties: {
      memoKind: m.memoKind,
      keyClaims: m.keyClaims ?? [],
      decisions: m.decisions ?? [],
    },
  };
}

function synthesisToDocument(s: LegacySynthesis): MicrositeDocument {
  return {
    id: s.id,
    kind: "microsite",
    title: s.title,
    summary: "",
    content: "",
    tags: [],
    linkedPersonIds: [],
    linkedCustomerIds: [],
    linkedObjectiveIds: [],
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    properties: {
      researchIds: s.researchIds ?? [],
      outline: s.outline as MicrositeDocument["properties"]["outline"],
      html: s.html,
      modifier: s.modifier,
      generatedBy: s.generatedBy,
      model: s.model,
    },
  };
}

function deckToDocument(d: LegacyDeck): DeckDocument {
  return {
    id: d.id,
    kind: "deck",
    title: d.title,
    summary: "",
    content: "",
    tags: [],
    linkedPersonIds: [],
    linkedCustomerIds: [],
    linkedObjectiveIds: [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    properties: {
      synthesisId: d.synthesisId,
      audience: d.audience as DeckDocument["properties"]["audience"],
      slides: d.slides as DeckDocument["properties"]["slides"],
      generatedBy: d.generatedBy,
      model: d.model,
    },
  };
}

// ───────── v2 → v3: People + OKRs + BUs scope to a Company ─────────────
// Seeds a singular internal Company, folds every legacy `Customer` into
// `companies` as kind="customer", and backfills `companyId` on Person /
// OKR / BusinessUnit. Document.linkedCustomerIds is duplicated to
// linkedCompanyIds — the field rename happens in PR 20 cleanup.

interface LegacyV2Customer {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  region?: string;
  summary: string;
  knownStakeholders: string[];
  buyingTriggers: string[];
  evaluationCriteria: string[];
  redFlags: string[];
  competitiveContext: string[];
  notes: string[];
  tags: string[];
  source: "manual" | "research";
  researchedAt?: string;
  createdAt: string;
}

interface LegacyV2Snapshot {
  customers?: Record<string, LegacyV2Customer>;
  customProfiles?: Record<string, Person>;
  okrs?: Record<string, OKR>;
  businessUnits?: Record<string, BusinessUnit>;
  companies?: Record<string, Company>;
  documents?: Record<string, Document & { linkedCustomerIds?: string[] }>;
  [key: string]: unknown;
}

export function migrateV2ToV3(
  persisted: unknown,
): Record<string, unknown> {
  if (!persisted || typeof persisted !== "object") return {};
  const snapshot = persisted as LegacyV2Snapshot;
  const now = new Date().toISOString();

  // 1. Build the companies record. Seed the internal Company first;
  //    every existing Customer becomes a kind=customer Company.
  const companies: Record<string, Company> = {
    ...(snapshot.companies ?? {}),
  };
  if (!companies[INTERNAL_COMPANY_ID]) {
    const internal: InternalCompany = {
      id: INTERNAL_COMPANY_ID,
      kind: "internal",
      name: INTERNAL_COMPANY_NAME,
      summary: "",
      tags: [],
      createdAt: now,
      properties: {},
    };
    companies[INTERNAL_COMPANY_ID] = internal;
  }
  for (const c of Object.values(snapshot.customers ?? {})) {
    if (!c?.id) continue;
    if (companies[c.id]) continue; // never overwrite a hand-edited Company
    const cust: CustomerCompany = {
      id: c.id,
      kind: "customer",
      name: c.name,
      summary: c.summary ?? "",
      industry: c.industry,
      size: c.size,
      region: c.region,
      tags: c.tags ?? [],
      createdAt: c.createdAt ?? now,
      properties: {
        knownStakeholders: c.knownStakeholders ?? [],
        buyingTriggers: c.buyingTriggers ?? [],
        evaluationCriteria: c.evaluationCriteria ?? [],
        redFlags: c.redFlags ?? [],
        competitiveContext: c.competitiveContext ?? [],
        notes: c.notes ?? [],
        source: c.source ?? "manual",
        researchedAt: c.researchedAt,
      },
    };
    companies[c.id] = cust;
  }

  // 2. Backfill Person.companyId. customerId set → that company; absent
  //    → internal. customerId is left in place during the transition;
  //    PR 20 deletes it.
  const customProfiles: Record<string, Person> = {};
  for (const [id, p] of Object.entries(snapshot.customProfiles ?? {})) {
    if (!p) continue;
    customProfiles[id] = {
      ...p,
      companyId: p.companyId ?? p.customerId ?? INTERNAL_COMPANY_ID,
    };
  }

  // 3. OKRs: everything pre-v3 was implicitly internal — no per-customer
  //    OKRs existed. Backfill companyId="internal" for any without one.
  const okrs: Record<string, OKR> = {};
  for (const [id, o] of Object.entries(snapshot.okrs ?? {})) {
    if (!o) continue;
    okrs[id] = {
      ...o,
      companyId: o.companyId ?? INTERNAL_COMPANY_ID,
    };
  }

  // 4. BusinessUnits: same — all existing BUs scoped to internal.
  const businessUnits: Record<string, BusinessUnit> = {};
  for (const [id, b] of Object.entries(snapshot.businessUnits ?? {})) {
    if (!b) continue;
    businessUnits[id] = {
      ...b,
      companyId: b.companyId ?? INTERNAL_COMPANY_ID,
    };
  }

  // 5. Documents: duplicate linkedCustomerIds → linkedCompanyIds so
  //    readers can switch over. The legacy field is dropped in PR 20.
  const documents: Record<string, Document & { linkedCompanyIds?: string[] }> = {};
  for (const [id, d] of Object.entries(snapshot.documents ?? {})) {
    if (!d) continue;
    const linkedCustomerIds = (d as { linkedCustomerIds?: string[] })
      .linkedCustomerIds;
    documents[id] = {
      ...d,
      linkedCompanyIds:
        (d as { linkedCompanyIds?: string[] }).linkedCompanyIds ??
        linkedCustomerIds ??
        [],
    };
  }

  return {
    ...snapshot,
    companies,
    customProfiles,
    okrs,
    businessUnits,
    documents,
  };
}
