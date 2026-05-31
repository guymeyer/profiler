// Unified Document entity. Replaces the per-kind ResearchArtifact / PRD /
// Memo split with a single shape carrying a `kind` discriminator and a
// typed `properties` bag for kind-specific fields.
//
// Synthesized content (microsites, decks) folds in here too so the
// Knowledge surface has one canonical record type to index.
//
// Pure type addition for now — no callers yet. Stays alongside the legacy
// types in lib/types.ts until the rest of the refactor lands.

import type {
  MemoKind,
  PRDStatus,
  Slide,
  DeckAudience,
  SynthesisOutline,
} from "@/lib/types";

// The closed registry of document kinds. Adding a new kind is a one-line
// change here plus a matching properties interface below and a branch in
// the Document union — TS exhaustiveness checks then carry you to every
// place that needs to learn the new kind.
export type DocumentKind =
  | "research"
  | "prd"
  | "memo"
  | "microsite"
  | "deck"
  | "postmortem"
  | "rfc"
  | "note";

// Fields every Document carries. Kind-specific fields go in `properties`.
// The shape mirrors the intersection of ResearchArtifact / PRD / Memo
// today — everything outside this base belongs in a per-kind bag.
export interface DocumentBase {
  id: string;
  kind: DocumentKind;
  title: string;
  summary: string;
  // The editable body. For uploaded documents this is an LLM-synthesized
  // version optimized for insights and downstream synthesis — clean
  // structure, key facts preserved, noise removed. For docs typed
  // directly into the editor this is the user's writing verbatim.
  content: string;
  // The verbatim source as uploaded — the ground-truth citation users
  // can view alongside the synthesized body. Set when content is
  // LLM-derived; absent for docs typed directly into the editor.
  originalContent?: string;
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

export interface ResearchProperties {
  participants: string[];
  methodology?: string;
  conductedAt?: string;
}

export interface PRDProperties {
  problem: string;
  solution: string;
  targetUsers: string[];
  successMetrics: string[];
  status: PRDStatus;
  targetShipDate?: string;
}

export interface MemoProperties {
  memoKind: MemoKind;
  keyClaims: string[];
  decisions: string[];
}

// Synthesis output. The body markdown is a rendered summary; the truth is
// in `outline`. `html` is a render cache — keep it optional so we can
// strip it from persisted state later without a type change.
export interface MicrositeProperties {
  researchIds: string[];
  outline: SynthesisOutline;
  html?: string;
  modifier?: string;
  generatedBy: "anthropic" | "mock";
  model?: string;
}

// Slide deck derived from a microsite. Kept thin — slides are the payload,
// audience is provenance.
export interface DeckProperties {
  synthesisId: string;
  audience: DeckAudience;
  slides: Slide[];
  generatedBy: "anthropic" | "mock";
  model?: string;
}

// Reserved kinds — typed empty bags so they're addressable today but earn
// fields when we actually build them. Adding a field is a non-breaking
// change since no callsites read these yet.
export type PostmortemProperties = Record<string, never>;
export type RFCProperties = Record<string, never>;
export type NoteProperties = Record<string, never>;

export type Document =
  | (DocumentBase & { kind: "research"; properties: ResearchProperties })
  | (DocumentBase & { kind: "prd"; properties: PRDProperties })
  | (DocumentBase & { kind: "memo"; properties: MemoProperties })
  | (DocumentBase & { kind: "microsite"; properties: MicrositeProperties })
  | (DocumentBase & { kind: "deck"; properties: DeckProperties })
  | (DocumentBase & { kind: "postmortem"; properties: PostmortemProperties })
  | (DocumentBase & { kind: "rfc"; properties: RFCProperties })
  | (DocumentBase & { kind: "note"; properties: NoteProperties });

export type ResearchDocument = Extract<Document, { kind: "research" }>;
export type PRDDocument = Extract<Document, { kind: "prd" }>;
export type MemoDocument = Extract<Document, { kind: "memo" }>;
export type MicrositeDocument = Extract<Document, { kind: "microsite" }>;
export type DeckDocument = Extract<Document, { kind: "deck" }>;
export type PostmortemDocument = Extract<Document, { kind: "postmortem" }>;
export type RFCDocument = Extract<Document, { kind: "rfc" }>;
export type NoteDocument = Extract<Document, { kind: "note" }>;

// Map from kind to its narrow Document type. Lets the kind registry and
// per-kind components stay strictly typed without each one writing its
// own Extract<>.
export type DocumentOfKind<K extends DocumentKind> = Extract<
  Document,
  { kind: K }
>;

export type DocumentPropertiesOfKind<K extends DocumentKind> =
  DocumentOfKind<K>["properties"];

// Type guard helpers. Useful at narrowing boundaries (store reads, URL
// params, classifier output) without sprinkling `as` casts.
export function isDocumentKind(value: string): value is DocumentKind {
  return DOCUMENT_KINDS.includes(value as DocumentKind);
}

export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  "research",
  "prd",
  "memo",
  "microsite",
  "deck",
  "postmortem",
  "rfc",
  "note",
] as const;

// Human-readable labels for chrome (eyebrows, kind selectors, breadcrumbs).
// The kind registry in lib/document-kinds.ts will own the rich config —
// these are just the bare strings every surface needs.
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  research: "Research",
  prd: "PRD",
  memo: "Memo",
  microsite: "Microsite",
  deck: "Deck",
  postmortem: "Post-mortem",
  rfc: "RFC",
  note: "Note",
};
