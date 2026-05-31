// Unified Document entity (kind=research|prd|memo|microsite|deck|…).
// Lives in lib/types/document.ts and is re-exported here so callers can
// keep importing from "@/lib/types". The legacy ResearchArtifact / PRD /
// Memo interfaces below remain the source of truth for existing call
// sites until the per-kind cutover lands.
export type {
  DocumentKind,
  DocumentBase,
  Document,
  DocumentOfKind,
  DocumentPropertiesOfKind,
  ResearchProperties,
  PRDProperties,
  MemoProperties,
  MicrositeProperties,
  DeckProperties,
  PostmortemProperties,
  RFCProperties,
  NoteProperties,
  ResearchDocument,
  PRDDocument,
  MemoDocument,
  MicrositeDocument,
  DeckDocument,
  PostmortemDocument,
  RFCDocument,
  NoteDocument,
} from "@/lib/types/document";
// Unified Company entity (kind=internal|customer). Same pattern as
// Document — see lib/types/company.ts for the discriminated union.
export type {
  Company,
  CompanyBase,
  CompanyKind,
  CompanyOfKind,
  CompanyPropertiesOfKind,
  CustomerCompany,
  CustomerCompanyProperties,
  InternalCompany,
  InternalCompanyProperties,
} from "@/lib/types/company";
export {
  COMPANY_KIND_LABELS,
  INTERNAL_COMPANY_ID,
  isCompanyKind,
} from "@/lib/types/company";

export {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  isDocumentKind,
} from "@/lib/types/document";

export type InfluenceLevel = "executive" | "senior" | "lead" | "ic";

export type CommStyle =
  | "data-driven"
  | "narrative"
  | "visual"
  | "operational"
  | "customer-centric"
  | "consensus"
  | "technical";

export interface Person {
  id: string;
  name: string;
  title: string;
  team: string;
  influence: InfluenceLevel;
  commStyle: CommStyle[];
  summary: string;
  reviewPreferences: string[];
  visualPreferences: string[];
  decisionTriggers: string[];
  objections: string[];
  dos: string[];
  donts: string[];
  exampleGuidance: string[];
  tags: string[];

  // Expertise dimensions — what this person KNOWS, distinct from how they
  // want work presented to them. Used by the people-recommendations engine
  // on artifact pages to suggest who else to talk to.
  expertiseAreas?: string[]; // stable areas they're the SME for
  activeWork?: string[]; // current focus, shifts quarterly
  interests?: string[]; // topics they want to be looped in on
  // Tags that were auto-suggested by LLM extraction from artifacts. Stored
  // separately so the user can see what came from where; merged with the
  // above arrays at read time. Additive only — extraction never overwrites
  // tags the user typed.
  expertiseAreasAuto?: string[];
  activeWorkAuto?: string[];
  interestsAuto?: string[];

  // When set, this person is an employee of the named customer rather than
  // someone on your own side. Drives where they appear in the directory.
  // DEPRECATED: superseded by `companyId`. Both are present during the
  // transition; PR 20 drops `customerId`.
  customerId?: string;
  // The Company this person belongs to. "internal" for your own org, a
  // customer company id otherwise. Optional until the v2→v3 migration
  // backfills every Person; required from PR 20 onward.
  companyId?: string;
  // Optional source provenance for researched / drafted profiles.
  source?: "manual" | "research" | "seed";
  researchedAt?: string;
  // Within-level rank (0 = top of band). When unset, sort falls back to name.
  rankWithinLevel?: number;
}

export interface Customer {
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

// Discriminator types used as fields inside `Document` properties bags.
// The full Document shape lives in lib/types/document.ts.

export type MemoKind =
  | "strategy"
  | "brief"
  | "post-mortem"
  | "market"
  | "other";

export const MEMO_KIND_LABELS: Record<MemoKind, string> = {
  strategy: "Strategy",
  brief: "Brief",
  "post-mortem": "Post-mortem",
  market: "Market / competitive",
  other: "Other",
};

export type PRDStatus = "draft" | "review" | "approved" | "shipped";

export const PRD_STATUS_LABELS: Record<PRDStatus, string> = {
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  shipped: "Shipped",
};

export interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  leaderPersonId?: string;
  createdAt: string;
  // Scopes this BU to a Company. Optional until v2→v3 backfills it to
  // "internal" for every existing BU (none belonged to customers pre-PR 15).
  companyId?: string;
}

export type OKRLevel = "company" | "bu";
export type OKRStatus = "on-track" | "at-risk" | "off-track" | "achieved";

export interface OKR {
  id: string;
  objective: string;            // the Objective in OKR
  keyResults: string[];         // 1-5 measurable KRs
  level: OKRLevel;
  businessUnitId?: string;      // required when level === "bu"
  ownerPersonIds: string[];     // owns / drives
  attachedPersonIds: string[];  // contributors / stakeholders (drives prompt context)
  timeframe: string;            // free text — e.g. "2026 Q2"
  status?: OKRStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  // Scopes this OKR to a Company. Optional until v2→v3 backfills to
  // "internal" for every existing OKR.
  companyId?: string;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  successCriteria: string[];
  risks: string[];
  recommendedFraming: string[];
  tags: string[];
}

export type ArtifactType =
  | "slide-deck"
  | "product-brief"
  | "strategy-memo"
  | "design-narrative"
  | "ux-case-study"
  | "data-viz-description"
  | "meeting-notes"
  | "other";

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  "slide-deck": "Slide deck",
  "product-brief": "Product brief",
  "strategy-memo": "Strategy memo",
  "design-narrative": "Design narrative",
  "ux-case-study": "UX case study",
  "data-viz-description": "Data viz description",
  "meeting-notes": "Meeting notes",
  other: "Other",
};

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  rawContent: string;
  selectedPersonIds: string[];
  selectedObjectiveIds: string[];
  createdAt: string;
}

export type Severity = "low" | "med" | "high";

export interface KeyRisk {
  risk: string;
  severity: Severity;
  tiedTo?: string;
}

export interface TacticalEdit {
  location: string;
  issue: string;
  before?: string;
  after: string;
  rationale: string;
}

export interface PracticeQA {
  question: string;
  askedBy?: string;
  answer: string;
  severity: Severity;
}

export interface ResearchCitation {
  researchId: string;
  finding: string;
  appliedTo: string;
}

export interface OKRAlignmentNote {
  okrId: string;
  advancesHow: string;
  alignment: "advances" | "neutral" | "tension";
}

export interface RecommendationResult {
  id: string;
  artifact: {
    title: string;
    type: ArtifactType;
    rawContent?: string;
    intent?: string;
    customer?: {
      id: string;
      name: string;
    };
    selectedPersonIds: string[];
    selectedObjectiveIds: string[];
  };
  tldr: string;
  summary: string;
  audienceRead: string;
  fitScore: number;
  confidence: "low" | "medium" | "high";
  keyRisks: KeyRisk[];
  recommendedFraming: string;
  tacticalEdits: TacticalEdit[];
  narrativeStructure: string[];
  dos: string[];
  donts: string[];
  practiceQA: PracticeQA[];
  researchEvidence?: ResearchCitation[];
  okrAlignment?: OKRAlignmentNote[];
  meetingApproach?: string;
  revisedArtifact?: string;
  generatedBy: "anthropic" | "mock";
  model?: string;
  createdAt: string;
  feedback?: ResultFeedback;
}

export interface ResultFeedback {
  rating: "positive" | "negative";
  notes?: string;
  createdAt: string;
}

// ─── Research synthesis (microsite) ─────────────────────────────────────────
// A static HTML microsite generated from N research reports. The microsite
// contains one general read of the corpus plus a per-lens read for each of
// the common enterprise organizations defined below. A dropdown in the
// rendered page switches between lenses at view time.

export type SynthesisLensId =
  | "general"
  | "product-design"
  | "product-management"
  | "engineering"
  | "research"
  | "marketing"
  | "sales-cs"
  | "executive";

export interface SynthesisLens {
  id: SynthesisLensId;
  name: string;
  // Short blurb shown in the dropdown / lens header.
  brief: string;
  // Longer guidance injected into the LLM prompt for this lens.
  guidance: string;
}

// Common enterprise organizations. The "general" lens is the default — a
// non-audience-specific synthesis. Every other lens reframes the same corpus
// for a specific reader role.
export const SYNTHESIS_LENSES: SynthesisLens[] = [
  {
    id: "general",
    name: "General",
    brief:
      "An audience-agnostic read of the corpus. Start here, then switch lenses to see what each org should take away.",
    guidance:
      "Audience-agnostic synthesis. Surface the through-line of the corpus, the strongest evidence, and the most consequential implications without favoring any single function. Treat this as the version a cross-functional leader would read first.",
  },
  {
    id: "product-design",
    name: "Product Design",
    brief: "User reality, mental models, friction patterns, design problems to solve.",
    guidance:
      "Read this corpus as a product designer. Surface user behavior, mental models, friction patterns, and jobs-to-be-done. Call out where current design intuition is thin or wrong. Frame insights as design problems to solve, not findings to file.",
  },
  {
    id: "product-management",
    name: "Product Management",
    brief: "Unmet need, prioritization, trade-offs the roadmap should reflect.",
    guidance:
      "Read this corpus as a product manager. Surface unmet needs, willingness-to-pay signals, segmentation cues, and trade-offs the roadmap should reflect. Translate qualitative signal into product decisions (build, defer, kill, or learn-more).",
  },
  {
    id: "engineering",
    name: "Engineering",
    brief: "Capability gaps and what user reality implies for the platform.",
    guidance:
      "Read this corpus as an engineering leader. Surface what user reality implies for architecture, reliability, performance, integration surface, and technical debt. Translate user pain into capability gaps and the smallest investment that closes each.",
  },
  {
    id: "research",
    name: "Research",
    brief: "Evidence strength, methodological gaps, what to study next.",
    guidance:
      "Read this corpus as a research lead. Surface methodological strengths and weaknesses, where claims are over- or under-supported, and the studies that should come next. Treat this as a meta-review of the corpus.",
  },
  {
    id: "marketing",
    name: "Marketing & Comms",
    brief: "The story, the positioning, the narrative this evidence earns.",
    guidance:
      "Read this corpus as a marketing leader. Surface the story arc the evidence supports, the positioning shifts it warrants, and the narratives competitors cannot credibly claim. Distinguish between what's earned by evidence and what would be aspirational.",
  },
  {
    id: "sales-cs",
    name: "Sales & Customer Success",
    brief: "Deal motion, expansion paths, churn risk.",
    guidance:
      "Read this corpus as a go-to-market leader. Surface deal-motion implications, expansion opportunities, and churn risks. Where research describes friction, name the deal stage it shows up in and the play that addresses it.",
  },
  {
    id: "executive",
    name: "Executive Leadership",
    brief: "Strategic shape and decisions only leadership can make.",
    guidance:
      "Read this corpus as an executive sponsor. Surface strategic implications, risks to objectives, the smallest set of decisions that would change the trajectory, and what to escalate. Compress, do not summarize.",
  },
];

export const SYNTHESIS_LENS_BY_ID: Record<SynthesisLensId, SynthesisLens> =
  Object.fromEntries(SYNTHESIS_LENSES.map((l) => [l.id, l])) as Record<
    SynthesisLensId,
    SynthesisLens
  >;

// Structured outline returned by the model. The HTML is built from this
// deterministically — see lib/llm/synthesize-render.ts.
export interface SynthesisInsight {
  headline: string;
  body: string;
  citations?: string[]; // research report titles backing this claim
}

export interface SynthesisLensSection {
  summary: string; // 2-4 sentence read-for-this-lens framing
  hmwQuestions: string[]; // 3-5 "How might we..." questions scoped to this lens
  insights: SynthesisInsight[]; // ranked insights for this lens
  implications: string[]; // bullet-style implications / actions
  tensions: string[]; // gaps, disagreements, weak evidence
  next: string[]; // smallest set of next moves
}

export interface SynthesisOutline {
  title: string;
  overview: string; // lens-independent corpus overview (1-2 paragraphs)
  lenses: Partial<Record<SynthesisLensId, SynthesisLensSection>>;
  // Optional per-person "microscopic" lenses. Each carries two depths so
  // the viewer can switch between a full brief and an executive summary.
  people?: PersonLensSection[];
  sources: { title: string; summary: string }[];
}

// Per-person lens — a microscopic reframe using the named individual's full
// profile (communication preferences, decision triggers, objections, do's
// and don'ts). Has two depths the viewer toggles between.
export type PersonLensDepth = "brief" | "exec";

export interface PersonExecutiveSummary {
  tldr: string; // 1-2 sentences — what this person should walk away knowing
  keyPoints: string[]; // 2-4 must-know bullets, ranked
  callToAction: string; // the single most consequential next move for them
}

export interface PersonLensSection {
  personId: string;
  personName: string; // baked in so the outline survives a person rename
  fullBrief: SynthesisLensSection; // same depth as a functional lens
  executiveSummary: PersonExecutiveSummary; // compressed for <60s reads
}

// ─── Slide decks (presentation derivative of a synthesis) ───────────────────
// A deck is a compression of a synthesis for a specific audience. Many
// decks per synthesis (one per audience) is the persistence model — the
// same research can be presented three different ways without losing prior
// cuts.

export type SlideKind =
  | "title"
  | "setup"
  | "insight"
  | "implication"
  | "quote"
  | "decision"
  | "sources"
  | "narrative"; // open prose slot for slides where bullets don't fit

export const SLIDE_KIND_LABELS: Record<SlideKind, string> = {
  title: "Title",
  setup: "Setup",
  insight: "Insight",
  implication: "Implication",
  quote: "Quote",
  decision: "Decision",
  sources: "Sources",
  narrative: "Narrative",
};

export interface Slide {
  kind: SlideKind;
  title: string;
  subtitle?: string;
  bullets?: string[]; // 1-4 bullets, each ≤ ~12 words
  quote?: { text: string; attribution?: string };
  citations?: string[]; // source titles referenced
  body?: string; // for narrative slides — a short paragraph
  speakerNotes?: string; // shown below slide in-app, embedded in export
}

// Audience snapshot baked into the deck so a deck stays valid even if the
// underlying selections change later.
export interface DeckAudience {
  personIds: string[];
  objectiveIds: string[];
  intent?: string;
}

// ─── Derived metrics + BU recommendations ───────────────────────────────────
// Metrics are extracted (by an LLM step) from research artifacts. They are
// not user-entered: a research report that mentions "AI Agent builder usage
// down 32%" yields a DerivedMetric tied to that research and to the
// inferred business unit. Multiple research artifacts mentioning the same
// metric for the same BU form a trend.

export type MetricKind =
  | "engagement"
  | "adoption"
  | "retention"
  | "satisfaction"
  | "performance"
  | "revenue"
  | "support"
  | "other";

export const METRIC_KIND_LABELS: Record<MetricKind, string> = {
  engagement: "Engagement",
  adoption: "Adoption",
  retention: "Retention",
  satisfaction: "Satisfaction",
  performance: "Performance",
  revenue: "Revenue",
  support: "Support",
  other: "Other",
};

export type MetricChangeDirection = "up" | "down" | "flat" | "unknown";
export type MetricChangeUnit = "pct" | "absolute" | "ratio";
export type MetricSentiment = "positive" | "negative" | "neutral";

// "observed" = pulled from research (what was), "target" = pulled from a
// PRD success metric (what we want). The BU dashboard groups both by
// canonical metric name, so a target sits alongside its observed trajectory.
export type MetricObservationType = "observed" | "target";

// What kind of document the metric was extracted from. The grouping logic
// on the BU dashboard treats all sources uniformly, but UI can label.
export type MetricSourceKind = "research" | "prd" | "memo";

export interface DerivedMetric {
  id: string;

  // Identity — name should be canonical enough that two extractions across
  // documents naturally collide for dedup-by-name on the dashboard.
  name: string;
  kind: MetricKind;
  unit?: string; // "%", "users", "days", "$", "score"

  // Observation as stated in the source document
  value?: number; // headline value if stated (e.g. 4200 active users)
  changeDirection: MetricChangeDirection;
  changeMagnitude?: number; // size of the change (e.g. 32 for "down 32%")
  changeUnit?: MetricChangeUnit;
  sentiment: MetricSentiment;

  observationType: MetricObservationType; // observed (default) | target
  periodLabel: string;
  asOfDate?: string;

  // Linkage / provenance
  sourceKind: MetricSourceKind; // research | prd — what document type produced this
  sourceDocumentId: string; // document id (any kind — research/prd/memo). Single column so per-source-kind dedup logic stays simple.
  businessUnitId?: string;
  linkedObjectiveIds?: string[];
  evidenceQuote?: string;

  generatedBy: "anthropic" | "mock";
  createdAt: string;
}

export type BURecommendationStance =
  | "amplify" // good trend, research validates, scale
  | "guard" // good trend, fragility — preserve the gain
  | "pivot" // bad trend, research explains why, change course
  | "investigate" // unclear signal, study before acting
  | "escalate"; // off-track + against objectives, leadership decision

export const BU_STANCE_LABELS: Record<BURecommendationStance, string> = {
  amplify: "Amplify",
  guard: "Guard",
  pivot: "Pivot",
  investigate: "Investigate",
  escalate: "Escalate",
};

export interface BURecommendationItem {
  stance: BURecommendationStance;
  headline: string;
  rationale: string;
  // Which metrics this recommendation rests on (by id).
  metricIds: string[];
  // Citation chips. Each citation includes a one-line "relevance" so we
  // know how the cited thing supports this recommendation.
  researchCitations: { researchId: string; relevance: string }[];
  objectiveCitations: { objectiveId: string; relevance: string }[];
  okrCitations: { okrId: string; relevance: string }[];
  nextActions: string[];
  risks: string[];
}

export interface BURecommendationSet {
  id: string;
  businessUnitId: string;
  summary: string; // 2-3 sentence overall narrative for the BU
  recommendations: BURecommendationItem[]; // 2-5 ranked
  generatedAt: string;
  generatedBy: "anthropic" | "mock";
  model?: string;
}
