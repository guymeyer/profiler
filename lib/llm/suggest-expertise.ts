"use server";
import Anthropic from "@anthropic-ai/sdk";
import type { Memo, PRD, Person, ResearchArtifact } from "@/lib/types";
import { withRetry } from "@/lib/llm/retry";

// Fire-and-forget post-ingest step: for each person linked to a newly-saved
// artifact, propose ADDITIVE expertise / active-work / interest tags. Never
// overwrites; the caller merges suggestions into the person's *Auto fields
// (which dedupe against the user-set fields and display with an "ai" badge).
//
// Cheap, parallelized — one small LLM call per linked person.

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_BODY_CHARS = 8_000;

export type ArtifactSummary =
  | { kind: "research"; item: ResearchArtifact }
  | { kind: "prd"; item: PRD }
  | { kind: "memo"; item: Memo };

export interface SuggestExpertiseInput {
  artifact: ArtifactSummary;
  person: Pick<
    Person,
    | "id"
    | "name"
    | "title"
    | "team"
    | "expertiseAreas"
    | "activeWork"
    | "interests"
    | "expertiseAreasAuto"
    | "activeWorkAuto"
    | "interestsAuto"
  >;
}

export interface SuggestExpertiseResult {
  personId: string;
  // New tags to ADD (caller will dedupe against existing).
  addExpertiseAreas: string[];
  addActiveWork: string[];
  addInterests: string[];
}

const SYSTEM_PROMPT = `You suggest expertise tags for a named team member based on a newly-ingested artifact that links to them. You are conservative — only suggest tags that the artifact's content materially supports. The user can prune later, so it's better to suggest fewer high-confidence tags than to pad.

Inputs:
- The artifact (title, summary, body excerpt, kind).
- A person profile (existing expertise tags, active work, interests).

Output via the submit_expertise_updates tool:
- addExpertiseAreas: stable areas this person clearly knows. Only suggest if the artifact substantively places them as the SME or contributor in that area. Each tag is 1-3 lowercase words.
- addActiveWork: current focus. Only if the artifact is recent and explicitly positions them on this work right now.
- addInterests: topics they'd want to be looped in on. Suggest sparingly.

Rules:
1. Do NOT suggest tags that are already in the person's existing fields (manual or auto). The caller dedupes, but suggesting them is noise.
2. Each tag is short, lowercase, kebab-case OK ("ai-agent-studio", "developer-onboarding", "assist-pricing"). Not full sentences.
3. If the artifact doesn't materially expand what we know about this person, return empty arrays. Returning nothing is the right move when the artifact is generic.
4. Three suggestions per field is the soft cap. Five is too many.

Output the submit_expertise_updates tool call. No prose.`;

const TOOL = {
  name: "submit_expertise_updates",
  description: "Submit additive expertise/active-work/interest tags for the named person.",
  input_schema: {
    type: "object",
    properties: {
      addExpertiseAreas: { type: "array", items: { type: "string" } },
      addActiveWork: { type: "array", items: { type: "string" } },
      addInterests: { type: "array", items: { type: "string" } },
    },
    required: ["addExpertiseAreas", "addActiveWork", "addInterests"],
  },
} as const;

function serializeArtifact(a: ArtifactSummary): string {
  const trim = (s: string) =>
    s.length > MAX_BODY_CHARS
      ? s.slice(0, MAX_BODY_CHARS) + `\n[...truncated]`
      : s;
  if (a.kind === "research") {
    const r = a.item;
    return `# Research: ${r.title}
Summary: ${r.summary}
Tags: ${r.tags.join(", ")}

Body:
${trim(r.content)}`;
  }
  if (a.kind === "prd") {
    const p = a.item;
    return `# PRD: ${p.title}
Summary: ${p.summary}
Problem: ${p.problem}
Solution: ${p.solution}
Target users: ${p.targetUsers.join(", ")}
Tags: ${p.tags.join(", ")}

Body:
${trim(p.content)}`;
  }
  const m = a.item;
  return `# Memo: ${m.title}
Summary: ${m.summary}
Kind: ${m.memoKind}
Key claims:
${m.keyClaims.map((c: string) => `- ${c}`).join("\n")}
Tags: ${m.tags.join(", ")}

Body:
${trim(m.content)}`;
}

function serializePerson(p: SuggestExpertiseInput["person"]): string {
  return `# Person: ${p.name}
Title: ${p.title}
Team: ${p.team}
Existing expertise areas: ${[...(p.expertiseAreas ?? []), ...(p.expertiseAreasAuto ?? [])].join(", ") || "(none)"}
Existing active work: ${[...(p.activeWork ?? []), ...(p.activeWorkAuto ?? [])].join(", ") || "(none)"}
Existing interests: ${[...(p.interests ?? []), ...(p.interestsAuto ?? [])].join(", ") || "(none)"}`;
}

export async function suggestExpertiseFromArtifact(
  input: SuggestExpertiseInput,
): Promise<SuggestExpertiseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      personId: input.person.id,
      addExpertiseAreas: [],
      addActiveWork: [],
      addInterests: [],
    };
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        tools: [TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: `${serializePerson(input.person)}\n\n${serializeArtifact(input.artifact)}`,
          },
        ],
      }),
    );
    const tool = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!tool) {
      return {
        personId: input.person.id,
        addExpertiseAreas: [],
        addActiveWork: [],
        addInterests: [],
      };
    }
    const data = tool.input as {
      addExpertiseAreas?: string[];
      addActiveWork?: string[];
      addInterests?: string[];
    };
    return {
      personId: input.person.id,
      addExpertiseAreas: dedupeAgainstExisting(
        data.addExpertiseAreas ?? [],
        [...(input.person.expertiseAreas ?? []), ...(input.person.expertiseAreasAuto ?? [])],
      ),
      addActiveWork: dedupeAgainstExisting(
        data.addActiveWork ?? [],
        [...(input.person.activeWork ?? []), ...(input.person.activeWorkAuto ?? [])],
      ),
      addInterests: dedupeAgainstExisting(
        data.addInterests ?? [],
        [...(input.person.interests ?? []), ...(input.person.interestsAuto ?? [])],
      ),
    };
  } catch (err) {
    console.error("[suggestExpertiseFromArtifact] failed:", err);
    return {
      personId: input.person.id,
      addExpertiseAreas: [],
      addActiveWork: [],
      addInterests: [],
    };
  }
}

function dedupeAgainstExisting(suggested: string[], existing: string[]): string[] {
  const existingLower = new Set(existing.map((s) => s.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of suggested) {
    const normalized = tag.trim();
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (existingLower.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    out.push(normalized);
  }
  return out.slice(0, 5);
}
