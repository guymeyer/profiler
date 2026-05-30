"use server";
import Anthropic from "@anthropic-ai/sdk";
import type { MemoKind, PRDStatus } from "@/lib/types";
import { withRetry } from "@/lib/llm/retry";

// Unified categorize for document intake. One entry point for all three
// kinds (research / prd / memo) — internal dispatch picks the right tool
// schema + prompt. Returns a discriminated union so callers can narrow
// off `result.kind` and read the kind-specific fields with type safety.
//
// Replaces the three previous files (actions.ts categorizeResearch,
// prd-actions.ts categorizePRD, memo-actions.ts categorizeMemo). The
// boilerplate (client setup, tool-block parsing, error handling, mock
// fallback) was duplicated three times and is consolidated here.

const MODEL = "claude-sonnet-4-6";
const MAX_CHARS = 30_000;
const MAX_OUT_TOKENS = 2048;

// ── Common shape + per-kind extensions ──

interface CommonCategorizeFields {
  title?: string;
  summary?: string;
  tags?: string[];
  sourceHint?: string;
}

export type CategorizeDocumentResult =
  | (CommonCategorizeFields & {
      kind: "research";
      participants?: string[];
      methodology?: string;
    })
  | (CommonCategorizeFields & {
      kind: "prd";
      problem?: string;
      solution?: string;
      targetUsers?: string[];
      successMetrics?: string[];
      status?: PRDStatus;
      targetShipDate?: string;
    })
  | (CommonCategorizeFields & {
      kind: "memo";
      memoKind?: MemoKind;
      keyClaims?: string[];
      decisions?: string[];
    });

// ── Per-kind tool schemas + system prompts ──

const COMMON_PROPS = {
  title: {
    type: "string",
    description:
      "Concise title (max ~80 chars). Invent a descriptive title if the source's title is generic.",
  },
  summary: {
    type: "string",
    description:
      "1-3 sentence executive summary stating what matters most about the document. No filler.",
  },
  tags: {
    type: "array",
    items: { type: "string" },
    description:
      "5-8 lowercase kebab-case tags. Cover topic, segment, theme, timeframe. No spaces.",
  },
  sourceHint: {
    type: "string",
    description:
      "Best inference of who authored or conducted the document. Empty if not extractable.",
  },
} as const;

const RESEARCH_TOOL = {
  name: "categorize_research",
  description:
    "Extract structured metadata from a primary-source research artifact.",
  input_schema: {
    type: "object",
    properties: {
      ...COMMON_PROPS,
      participants: {
        type: "array",
        items: { type: "string" },
        description:
          "Each entry: 'Name (Role @ Company)' when extractable. Empty array if no named participants are mentioned.",
      },
      methodology: {
        type: "string",
        description:
          "One short sentence: how the research was conducted. Empty if not stated.",
      },
    },
    required: [],
  },
} as const;

const PRD_TOOL = {
  name: "categorize_prd",
  description:
    "Extract structured PRD metadata from a planning document.",
  input_schema: {
    type: "object",
    properties: {
      ...COMMON_PROPS,
      problem: {
        type: "string",
        description:
          "The problem this PRD addresses, in 2-4 sentences. Pull verbatim language where available.",
      },
      solution: {
        type: "string",
        description:
          "Proposed solution / approach, in 2-5 sentences. Capability-level, not implementation.",
      },
      targetUsers: {
        type: "array",
        items: { type: "string" },
        description:
          "User segments / personas. Each entry: short noun phrase. Empty if not stated.",
      },
      successMetrics: {
        type: "array",
        items: { type: "string" },
        description:
          "Target / success metrics verbatim from the PRD. Empty if not stated.",
      },
      status: {
        type: "string",
        enum: ["draft", "review", "approved", "shipped"],
        description: "PRD status if stated. Omit if not stated.",
      },
      targetShipDate: {
        type: "string",
        description: "Target ship date in ISO format (YYYY-MM-DD). Omit if not stated.",
      },
    },
    required: [],
  },
} as const;

const MEMO_TOOL = {
  name: "categorize_memo",
  description:
    "Extract structured memo metadata from a narrative source document.",
  input_schema: {
    type: "object",
    properties: {
      ...COMMON_PROPS,
      memoKind: {
        type: "string",
        enum: ["strategy", "brief", "post-mortem", "market", "other"],
        description:
          "Which kind: strategy / brief / post-mortem / market / other.",
      },
      keyClaims: {
        type: "array",
        items: { type: "string" },
        description:
          "3-6 distilled assertions the memo makes. Load-bearing arguments.",
      },
      decisions: {
        type: "array",
        items: { type: "string" },
        description:
          "Explicit decisions or recommendations. Empty if purely analytical.",
      },
    },
    required: [],
  },
} as const;

const RESEARCH_SYSTEM = `You are a research librarian categorizing a primary-source research artifact (interview, study, customer call notes, etc.).

Rules:
1. Be conservative — leave fields empty rather than invent.
2. Extract from the text only. Don't infer participants from filenames or vibes.
3. Tags should be useful for retrieval: topic, segment, theme, timeframe.
4. Summary states what was found, not what was done.

The source content is stored verbatim — do not rewrite it. Only extract metadata.

Output the categorize_research tool call. Do not write prose.`;

const PRD_SYSTEM = `You are a product operations specialist categorizing a PRD so it can be filed in the team's planning library and cross-referenced with research, OKRs, and metrics.

Rules:
1. Be conservative. Leave fields empty rather than invent.
2. Extract from the text only. Don't infer status from the filename or vibe.
3. successMetrics must be lifted verbatim or near-verbatim — do not paraphrase numbers, units, or dates.
4. problem and solution are the two most important fields. If the PRD doesn't clearly separate them, identify the closest passages.

The source content is stored verbatim — do not rewrite it. Only extract metadata.

Output the categorize_prd tool call. Do not write prose outside the tool call.`;

const MEMO_SYSTEM = `You are a knowledge librarian filing a narrative memo. Memos are strategy documents, briefs, post-mortems, or market notes.

Rules:
1. Be conservative. Leave fields empty rather than invent.
2. Extract from the text only. Don't infer who wrote it from the filename or vibe.
3. keyClaims are the assertions the memo *makes* — the load-bearing arguments. If the memo isn't asserting anything, leave keyClaims empty.
4. decisions are explicit recommendations or calls. Not summaries of the memo's tone.

The source content is stored verbatim — do not rewrite it. Only extract metadata.

Output the categorize_memo tool call. Do not write prose outside the tool call.`;

// ── Dispatch + shared call ──

interface CategorizeArgs {
  content: string;
  filename?: string;
}

const SPEC: Record<
  "research" | "prd" | "memo",
  {
    tool: typeof RESEARCH_TOOL | typeof PRD_TOOL | typeof MEMO_TOOL;
    system: string;
    normalize: (raw: Record<string, unknown>) => CategorizeDocumentResult;
    mock: (text: string, filename?: string) => CategorizeDocumentResult;
  }
> = {
  research: {
    tool: RESEARCH_TOOL,
    system: RESEARCH_SYSTEM,
    normalize: (data) => {
      const d = data as {
        title?: string;
        summary?: string;
        participants?: string[];
        methodology?: string;
        tags?: string[];
        sourceHint?: string;
      };
      return {
        kind: "research",
        title: d.title?.trim() || undefined,
        summary: d.summary?.trim() || undefined,
        participants: (d.participants ?? [])
          .map((p) => p.trim())
          .filter(Boolean),
        methodology: d.methodology?.trim() || undefined,
        tags: normalizeTags(d.tags),
        sourceHint: d.sourceHint?.trim() || undefined,
      };
    },
    mock: (text, filename) => ({
      kind: "research",
      ...mockCommon(text, filename),
    }),
  },
  prd: {
    tool: PRD_TOOL,
    system: PRD_SYSTEM,
    normalize: (data) => {
      const d = data as {
        title?: string;
        summary?: string;
        problem?: string;
        solution?: string;
        targetUsers?: string[];
        successMetrics?: string[];
        status?: PRDStatus;
        targetShipDate?: string;
        tags?: string[];
        sourceHint?: string;
      };
      return {
        kind: "prd",
        title: d.title?.trim() || undefined,
        summary: d.summary?.trim() || undefined,
        problem: d.problem?.trim() || undefined,
        solution: d.solution?.trim() || undefined,
        targetUsers: (d.targetUsers ?? [])
          .map((u) => u.trim())
          .filter(Boolean),
        successMetrics: (d.successMetrics ?? [])
          .map((m) => m.trim())
          .filter(Boolean),
        status: d.status,
        targetShipDate: d.targetShipDate?.trim() || undefined,
        tags: normalizeTags(d.tags),
        sourceHint: d.sourceHint?.trim() || undefined,
      };
    },
    mock: (text, filename) => ({
      kind: "prd",
      ...mockCommon(text, filename),
      status: "draft",
    }),
  },
  memo: {
    tool: MEMO_TOOL,
    system: MEMO_SYSTEM,
    normalize: (data) => {
      const d = data as {
        title?: string;
        summary?: string;
        memoKind?: MemoKind;
        keyClaims?: string[];
        decisions?: string[];
        tags?: string[];
        sourceHint?: string;
      };
      return {
        kind: "memo",
        title: d.title?.trim() || undefined,
        summary: d.summary?.trim() || undefined,
        memoKind: d.memoKind,
        keyClaims: (d.keyClaims ?? []).map((c) => c.trim()).filter(Boolean),
        decisions: (d.decisions ?? []).map((c) => c.trim()).filter(Boolean),
        tags: normalizeTags(d.tags),
        sourceHint: d.sourceHint?.trim() || undefined,
      };
    },
    mock: (text, filename) => ({
      kind: "memo",
      ...mockCommon(text, filename),
      memoKind: "other",
    }),
  },
};

function normalizeTags(tags?: string[]): string[] {
  return (tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
}

function mockCommon(
  text: string,
  filename?: string,
): { title?: string; summary?: string; tags?: string[] } {
  const firstLine = text.split(/\n+/).find((l) => l.trim().length > 0) ?? "";
  return {
    title:
      filename?.replace(/\.[^.]+$/, "") ||
      firstLine.slice(0, 80) ||
      undefined,
    summary: text.slice(0, 200).trim() || undefined,
    tags: [],
  };
}

export async function categorizeDocument(
  args: CategorizeArgs,
  kind: "research" | "prd" | "memo",
): Promise<CategorizeDocumentResult> {
  const spec = SPEC[kind];
  const text = args.content.trim();
  if (!text) return spec.normalize({});

  if (!process.env.ANTHROPIC_API_KEY) return spec.mock(text, args.filename);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 2,
  });
  const trimmed =
    text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n…[truncated]" : text;

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: MAX_OUT_TOKENS,
        system: spec.system,
        tools: [spec.tool as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: spec.tool.name },
        messages: [
          {
            role: "user",
            content: `Original filename: ${args.filename ?? "(none)"}\n\nExtracted text:\n\n${trimmed}`,
          },
        ],
      }),
    );
    const block = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!block) return spec.normalize({});
    return spec.normalize(block.input as Record<string, unknown>);
  } catch (err) {
    // Categorization is best-effort — don't block intake on failure.
    console.error(`[categorizeDocument:${kind}] failed:`, err);
    return spec.normalize({});
  }
}
