"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  RecommendationResult,
  ArtifactType,
  Person,
  Objective,
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

export interface AnalyzeInput {
  title: string;
  type: ArtifactType;
  rawContent: string;
  personIds: string[];
  objectiveIds: string[];
  strategyOnly?: boolean;
  model?: "claude-sonnet-4-6" | "claude-opus-4-7";
}

const MAX_ARTIFACT_CHARS = 60_000;
const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function analyzeArtifact(
  input: AnalyzeInput,
): Promise<RecommendationResult> {
  const people = input.personIds
    .map((id) => PEOPLE.find((p) => p.id === id))
    .filter(Boolean) as Person[];
  const objectives = input.objectiveIds
    .map((id) => OBJECTIVES.find((o) => o.id === id))
    .filter(Boolean) as Objective[];

  if (people.length === 0) {
    throw new Error("At least one person must be selected.");
  }

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
    });
  }

  const client = new Anthropic({ apiKey });
  const model = input.model ?? DEFAULT_MODEL;

  // Library block (full seed) cached at the system+library boundary so
  // multiple analyses in the same session hit cache. The selected audience
  // subset is reasserted in the user turn so the model focuses there.
  const libraryBlock = `# Reference library — all known people\n\n${PEOPLE.map(
    serializePerson,
  ).join("\n\n---\n\n")}\n\n# Reference library — all known objectives\n\n${OBJECTIVES.map(
    serializeObjective,
  ).join("\n\n---\n\n")}`;

  const audienceBlock = buildAudienceBlock(people, objectives);
  const taskInstruction = buildTaskInstruction({
    hasArtifact,
    multiPerson: people.length > 1,
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

  const response = await client.messages.create({
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
      selectedPersonIds: input.personIds,
      selectedObjectiveIds: input.objectiveIds,
    },
    summary: data.summary,
    audienceRead: data.audienceRead,
    fitScore: data.fitScore,
    confidence: data.confidence,
    keyRisks: data.keyRisks,
    recommendedFraming: data.recommendedFraming,
    tacticalEdits: data.tacticalEdits ?? [],
    narrativeStructure: data.narrativeStructure,
    emphasize: data.emphasize,
    avoid: data.avoid,
    meetingApproach: data.meetingApproach || undefined,
    revisedArtifact: data.revisedArtifact || undefined,
    generatedBy: "anthropic",
    model,
    createdAt: new Date().toISOString(),
  };
  return result;
}
