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

export interface RecommendationResult {
  id: string;
  artifact: {
    title: string;
    type: ArtifactType;
    selectedPersonIds: string[];
    selectedObjectiveIds: string[];
  };
  summary: string;
  audienceRead: string;
  fitScore: number;
  confidence: "low" | "medium" | "high";
  keyRisks: KeyRisk[];
  recommendedFraming: string;
  tacticalEdits: TacticalEdit[];
  narrativeStructure: string[];
  emphasize: string[];
  avoid: string[];
  meetingApproach?: string;
  revisedArtifact?: string;
  generatedBy: "anthropic" | "mock";
  model?: string;
  createdAt: string;
}
