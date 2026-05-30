// Persisted-store migrations. Versioned with the `version` field on the
// Zustand persist config. Each migration is a pure function over the
// snapshot — never read live state, never side-effect.
//
// IDs are preserved across migrations so external references (DerivedMetric
// backrefs in particular) survive the move from per-kind slices to a
// unified `documents` record.

import type {
  Document,
  DocumentBase,
  MemoDocument,
  MicrositeDocument,
  PRDDocument,
  ResearchDocument,
  DeckDocument,
} from "@/lib/types";

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
