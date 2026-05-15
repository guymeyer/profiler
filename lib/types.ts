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
  // When set, this person is an employee of the named customer rather than
  // someone on your own side. Drives where they appear in the directory.
  customerId?: string;
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

export interface ResearchArtifact {
  id: string;
  title: string;
  summary: string;            // executive summary (1-3 sentences)
  content: string;            // full body text (may come from PDF/DOCX extract)
  source: string;             // who/team conducted, e.g. "Customer Research Team"
  conductedAt?: string;       // ISO date — when the research was conducted
  participants: string[];     // who was interviewed / observed
  methodology?: string;       // brief description of how it was conducted
  tags: string[];
  linkedPersonIds: string[];
  linkedCustomerIds: string[];
  linkedObjectiveIds: string[];
  uploadedFrom?: { filename: string; kind: string };
  createdAt: string;
  updatedAt?: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  description?: string;
  leaderPersonId?: string;
  createdAt: string;
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
