"use server";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/llm/retry";

// "Brief me on X" — compiles a one-page brief about any entity (person,
// customer, BU, objective) from everything linked to it. Smaller scope than
// synthesis: one entity, one LLM call, ~500-word output.

export type BriefSubjectKind = "person" | "customer" | "business-unit" | "objective";

export interface BriefInput {
  subject: {
    kind: BriefSubjectKind;
    name: string;
    description?: string;
  };
  // Raw context blocks — the caller decides what to include. Each is a
  // labeled section of plain markdown that the LLM reads.
  contextBlocks: Array<{ label: string; body: string }>;
}

export interface BriefResult {
  // One-paragraph TL;DR. The "if you read nothing else."
  tldr: string;
  // 2-4 sections, each with a 1-line heading and 2-5 paragraph bullets.
  sections: Array<{ heading: string; bullets: string[] }>;
  // 0-3 open questions / things we don't yet know.
  openQuestions: string[];
  generatedBy: "anthropic" | "mock";
  model?: string;
  generatedAt: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You produce one-page briefs about an entity in a team's knowledge repository — a person, customer, business unit, or objective. You synthesize across whatever context the host application has linked to the entity.

Operating rules:

1. Be specific. Pull verbatim phrases, named people, numbers, dates from the source context. No filler.
2. Compress, do not summarize. One paragraph TL;DR, 2-4 sections of 2-5 bullets each, 0-3 open questions. Don't pad.
3. If the context is thin, the right move is short — say what we know and what we don't. Better one solid paragraph than three pages of waffle.
4. The TL;DR is the sentence that survives if the reader stops there. Make it sharp.
5. Open questions are honest gaps in the context — things a reader would want to know that the linked artifacts don't answer. Skip if the context is comprehensive.
6. No hedging. Banned: "it is important to", "stakeholders should", "various", "many", "potentially", "may want to", "consider".

Output via submit_brief. No prose outside the tool call.`;

const TOOL = {
  name: "submit_brief",
  description: "Submit a one-page brief about the named entity.",
  input_schema: {
    type: "object",
    properties: {
      tldr: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["heading", "bullets"],
        },
      },
      openQuestions: { type: "array", items: { type: "string" } },
    },
    required: ["tldr", "sections", "openQuestions"],
  },
} as const;

const KIND_LABEL: Record<BriefSubjectKind, string> = {
  person: "person",
  customer: "customer",
  "business-unit": "business unit",
  objective: "objective",
};

export async function generateBrief(input: BriefInput): Promise<BriefResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockBrief(input);
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const subjectBlock = `# Subject: ${input.subject.name} (${KIND_LABEL[input.subject.kind]})${input.subject.description ? `\n${input.subject.description}` : ""}`;
  const contextBlock = input.contextBlocks.length === 0
    ? "(no linked context yet)"
    : input.contextBlocks
        .map((c) => `## ${c.label}\n\n${c.body}`)
        .join("\n\n");

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        tools: [TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: `${subjectBlock}\n\n# Linked context\n\n${contextBlock}`,
          },
        ],
      }),
    );
    const tool = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!tool) return mockBrief(input);
    const data = tool.input as Omit<
      BriefResult,
      "generatedBy" | "model" | "generatedAt"
    >;
    return {
      tldr: data.tldr ?? "",
      sections: Array.isArray(data.sections) ? data.sections : [],
      openQuestions: Array.isArray(data.openQuestions)
        ? data.openQuestions
        : [],
      generatedBy: "anthropic",
      model: DEFAULT_MODEL,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[generateBrief] failed:", err);
    return mockBrief(input);
  }
}

function mockBrief(input: BriefInput): BriefResult {
  const hasContext = input.contextBlocks.length > 0;
  return {
    tldr: hasContext
      ? `${input.subject.name}: ${input.contextBlocks.length} linked source${input.contextBlocks.length === 1 ? "" : "s"} on file. The corpus points to a working understanding — see sections below for the through-line.`
      : `${input.subject.name}: no linked context yet. Add research, PRDs, or memos that reference this ${KIND_LABEL[input.subject.kind]} to make this brief load-bearing.`,
    sections: hasContext
      ? [
          {
            heading: "What we know",
            bullets: input.contextBlocks
              .slice(0, 4)
              .map(
                (c) =>
                  `${c.label}: ${c.body.split(/\n/).find((l) => l.trim().length > 0) ?? "(empty)"}`,
              ),
          },
        ]
      : [
          {
            heading: "What we know",
            bullets: [
              "Nothing in the linked context yet — this brief is a placeholder.",
            ],
          },
        ],
    openQuestions: hasContext
      ? [
          "What's the most consequential decision pending for this entity?",
          "What recent change in the context is most worth attention?",
        ]
      : [
          "What artifacts could we link here to make this entity load-bearing?",
        ],
    generatedBy: "mock",
    generatedAt: new Date().toISOString(),
  };
}
