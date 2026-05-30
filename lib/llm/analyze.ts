"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  RecommendationResult,
  ArtifactType,
  Person,
  Objective,
  Customer,
  ResearchDocument,
  OKR,
  BusinessUnit,
} from "@/lib/types";
import { PEOPLE } from "@/lib/data/people";
import { OBJECTIVES } from "@/lib/data/objectives";
import {
  SYSTEM_PROMPT,
  buildAudienceBlock,
  buildArtifactBlock,
  buildTaskInstruction,
  serializePerson,
  serializeObjective,
} from "@/lib/llm/prompts";
import {
  RECOMMENDATION_TOOL,
  type RecommendationToolInput,
} from "@/lib/llm/schema";
import { buildMockRecommendation } from "@/lib/llm/mock";
import { withRetry } from "@/lib/llm/retry";

// Partial result shape used by the streaming path. Mirrors the tool input
// schema but every field is optional. The result page knows how to render a
// partial result by falling back to skeleton placeholders.
export interface PartialRecommendation {
  tldr?: string;
  summary?: string;
  audienceRead?: string;
  fitScore?: number;
  confidence?: string;
  recommendedFraming?: string;
  narrativeStructure?: string[];
  dos?: string[];
  donts?: string[];
  keyRisks?: { risk: string; severity: "low" | "med" | "high"; tiedTo?: string }[];
  practiceQA?: {
    question: string;
    askedBy?: string;
    answer: string;
    severity: "low" | "med" | "high";
  }[];
  tacticalEdits?: {
    location: string;
    issue: string;
    before?: string;
    after: string;
    rationale: string;
  }[];
  meetingApproach?: string;
  revisedArtifact?: string;
}

export interface AnalyzeInput {
  title: string;
  type: ArtifactType;
  rawContent: string;
  personIds: string[];
  objectiveIds: string[];
  intent?: string;
  customer?: Customer;
  research?: ResearchDocument[];
  okrs?: OKR[];
  businessUnits?: Record<string, BusinessUnit>;
  strategyOnly?: boolean;
  // Effective audience profiles: custom or edited versions of selected people.
  // Indexed by id. When present, used in place of seed lookups for the audience
  // block. The cached library block still uses the seed catalog.
  audienceOverrides?: Person[];
  model?: "claude-sonnet-4-6" | "claude-opus-4-7";
}

const MAX_ARTIFACT_CHARS = 60_000;
const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function analyzeArtifact(
  input: AnalyzeInput,
): Promise<RecommendationResult> {
  const overrides = new Map(
    (input.audienceOverrides ?? []).map((p) => [p.id, p]),
  );
  const people = input.personIds
    .map((id) => overrides.get(id) ?? PEOPLE.find((p) => p.id === id))
    .filter(Boolean) as Person[];
  const objectives = input.objectiveIds
    .map((id) => OBJECTIVES.find((o) => o.id === id))
    .filter(Boolean) as Objective[];

  if (people.length === 0 && objectives.length === 0 && !input.customer) {
    throw new Error("Select at least one person, objective, or customer.");
  }

  const intent = input.intent?.trim();
  const customer = input.customer;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasArtifact = !input.strategyOnly && input.rawContent.trim().length > 0;
  const trimmed = hasArtifact
    ? input.rawContent.slice(0, MAX_ARTIFACT_CHARS)
    : "";

  // Mock path: deterministic, useful recommendation built from profile data.
  if (!apiKey) {
    return buildMockRecommendation({
      title: input.title,
      type: input.type,
      rawContent: trimmed,
      people,
      objectives,
      hasArtifact,
      intent,
      customer,
      research: input.research,
      okrs: input.okrs,
    });
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const model = input.model ?? DEFAULT_MODEL;

  // Library block (full seed) cached at the system+library boundary so
  // multiple analyses in the same session hit cache. The selected audience
  // subset is reasserted in the user turn so the model focuses there.
  const libraryBlock = `# Reference library — all known people\n\n${PEOPLE.map(
    serializePerson,
  ).join("\n\n---\n\n")}\n\n# Reference library — all known objectives\n\n${OBJECTIVES.map(
    serializeObjective,
  ).join("\n\n---\n\n")}`;

  const audienceBlock = buildAudienceBlock(
    people,
    objectives,
    customer,
    input.research ?? [],
    input.okrs ?? [],
    input.businessUnits ?? {},
  );
  const taskInstruction = buildTaskInstruction({
    hasArtifact,
    multiPerson: people.length > 1,
    hasPeople: people.length > 0,
    hasCustomer: !!customer,
    hasResearch: (input.research ?? []).length > 0,
    hasOKRs: (input.okrs ?? []).length > 0,
    intent,
  });

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: libraryBlock,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: audienceBlock },
  ];

  if (hasArtifact) {
    userContent.push({
      type: "text",
      text: buildArtifactBlock({
        title: input.title,
        type: input.type,
        rawContent: trimmed,
      }),
    });
  }

  userContent.push({ type: "text", text: taskInstruction });

  const response = await withRetry(() =>
    client.messages.create({
      model,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [RECOMMENDATION_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: RECOMMENDATION_TOOL.name },
      messages: [{ role: "user", content: userContent }],
    }),
  );

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error("Model did not return a tool_use block.");
  }
  const data = toolBlock.input as RecommendationToolInput;

  const result: RecommendationResult = {
    id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    artifact: {
      title: input.title,
      type: input.type,
      rawContent: hasArtifact ? trimmed : undefined,
      intent: intent || undefined,
      customer: customer ? { id: customer.id, name: customer.name } : undefined,
      selectedPersonIds: input.personIds,
      selectedObjectiveIds: input.objectiveIds,
    },
    tldr: data.tldr,
    summary: data.summary,
    audienceRead: data.audienceRead,
    fitScore: data.fitScore,
    confidence: data.confidence,
    keyRisks: data.keyRisks,
    recommendedFraming: data.recommendedFraming,
    tacticalEdits: data.tacticalEdits ?? [],
    narrativeStructure: data.narrativeStructure,
    dos: data.dos,
    donts: data.donts,
    practiceQA: data.practiceQA ?? [],
    researchEvidence: data.researchEvidence ?? undefined,
    okrAlignment: data.okrAlignment ?? undefined,
    meetingApproach: data.meetingApproach || undefined,
    revisedArtifact: data.revisedArtifact || undefined,
    generatedBy: "anthropic",
    model,
    createdAt: new Date().toISOString(),
  };
  return result;
}

// Streaming variant. Invokes the model with messages.stream() and pushes
// partial-snapshot updates to `onPartial` as the tool input JSON accumulates.
// Returns the final RecommendationResult once the stream ends.
export async function analyzeArtifactStreaming(
  input: AnalyzeInput,
  onPartial: (partial: PartialRecommendation) => void,
): Promise<RecommendationResult> {
  const overrides = new Map(
    (input.audienceOverrides ?? []).map((p) => [p.id, p]),
  );
  const people = input.personIds
    .map((id) => overrides.get(id) ?? PEOPLE.find((p) => p.id === id))
    .filter(Boolean) as Person[];
  const objectives = input.objectiveIds
    .map((id) => OBJECTIVES.find((o) => o.id === id))
    .filter(Boolean) as Objective[];

  if (people.length === 0 && objectives.length === 0 && !input.customer) {
    throw new Error("Select at least one person, objective, or customer.");
  }

  const intent = input.intent?.trim();
  const customer = input.customer;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasArtifact = !input.strategyOnly && input.rawContent.trim().length > 0;
  const trimmed = hasArtifact
    ? input.rawContent.slice(0, MAX_ARTIFACT_CHARS)
    : "";

  // Mock path can't really stream; just call mock and emit the partial all at
  // once, then return. The caller still benefits from a consistent API shape.
  if (!apiKey) {
    const result = buildMockRecommendation({
      title: input.title,
      type: input.type,
      rawContent: trimmed,
      people,
      objectives,
      hasArtifact,
      intent,
      customer,
      research: input.research,
      okrs: input.okrs,
    });
    // Simulate progressive arrival of the fields users care about most.
    onPartial({ tldr: result.tldr });
    onPartial({ tldr: result.tldr, fitScore: result.fitScore });
    onPartial({
      tldr: result.tldr,
      fitScore: result.fitScore,
      dos: result.dos,
      donts: result.donts,
    });
    return result;
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const model = input.model ?? DEFAULT_MODEL;

  const libraryBlock = `# Reference library — all known people\n\n${PEOPLE.map(
    serializePerson,
  ).join("\n\n---\n\n")}\n\n# Reference library — all known objectives\n\n${OBJECTIVES.map(
    serializeObjective,
  ).join("\n\n---\n\n")}`;

  const audienceBlock = buildAudienceBlock(
    people,
    objectives,
    customer,
    input.research ?? [],
    input.okrs ?? [],
    input.businessUnits ?? {},
  );
  const taskInstruction = buildTaskInstruction({
    hasArtifact,
    multiPerson: people.length > 1,
    hasPeople: people.length > 0,
    hasCustomer: !!customer,
    hasResearch: (input.research ?? []).length > 0,
    hasOKRs: (input.okrs ?? []).length > 0,
    intent,
  });

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: libraryBlock,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: audienceBlock },
  ];
  if (hasArtifact) {
    userContent.push({
      type: "text",
      text: buildArtifactBlock({
        title: input.title,
        type: input.type,
        rawContent: trimmed,
      }),
    });
  }
  userContent.push({ type: "text", text: taskInstruction });

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [RECOMMENDATION_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: RECOMMENDATION_TOOL.name },
    messages: [{ role: "user", content: userContent }],
  });

  // Throttle outgoing partial events: emit at most every 200ms, plus a final
  // emit before completion. Keeps the stream lively without saturating it.
  let lastEmit = 0;
  let lastSnapshotKey = "";
  stream.on("inputJson", (_partial, snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const now = Date.now();
    const snapKey = JSON.stringify(snapshot);
    if (snapKey === lastSnapshotKey) return;
    if (now - lastEmit < 200) return;
    lastEmit = now;
    lastSnapshotKey = snapKey;
    onPartial(snapshot as PartialRecommendation);
  });

  const finalMessage = await stream.finalMessage();
  const toolBlock = finalMessage.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error("Model did not return a tool_use block.");
  }
  const data = toolBlock.input as RecommendationToolInput;

  const result: RecommendationResult = {
    id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    artifact: {
      title: input.title,
      type: input.type,
      rawContent: hasArtifact ? trimmed : undefined,
      intent: intent || undefined,
      customer: customer ? { id: customer.id, name: customer.name } : undefined,
      selectedPersonIds: input.personIds,
      selectedObjectiveIds: input.objectiveIds,
    },
    tldr: data.tldr,
    summary: data.summary,
    audienceRead: data.audienceRead,
    fitScore: data.fitScore,
    confidence: data.confidence,
    keyRisks: data.keyRisks,
    recommendedFraming: data.recommendedFraming,
    tacticalEdits: data.tacticalEdits ?? [],
    narrativeStructure: data.narrativeStructure,
    dos: data.dos,
    donts: data.donts,
    practiceQA: data.practiceQA ?? [],
    researchEvidence: data.researchEvidence ?? undefined,
    okrAlignment: data.okrAlignment ?? undefined,
    meetingApproach: data.meetingApproach || undefined,
    revisedArtifact: data.revisedArtifact || undefined,
    generatedBy: "anthropic",
    model,
    createdAt: new Date().toISOString(),
  };
  return result;
}
