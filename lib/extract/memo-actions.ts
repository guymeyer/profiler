"use server";
import Anthropic from "@anthropic-ai/sdk";
import type { MemoKind } from "@/lib/types";
import { withRetry } from "@/lib/llm/retry";

// Memo-specific categorize. Memos are narrative documents — strategy memos,
// briefs, post-mortems, market notes — so the structured extraction focuses
// on the assertions the document makes and the decisions it states, rather
// than the research metadata (participants / methodology) or PRD planning
// shape (problem / solution).

export interface CategorizeMemoResult {
  title?: string;
  summary?: string;
  memoKind?: MemoKind;
  keyClaims?: string[];
  decisions?: string[];
  tags?: string[];
  sourceHint?: string;
  bodyMarkdown?: string;
}

const CATEGORIZE_TOOL = {
  name: "categorize_memo",
  description:
    "Extract structured memo metadata from a narrative source document.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "Concise memo title (max ~80 chars) that names the assertion or topic. Invent a descriptive title if the source's title is generic.",
      },
      summary: {
        type: "string",
        description:
          "1-3 sentence executive summary. What the memo argues, recommends, or reports. No filler.",
      },
      memoKind: {
        type: "string",
        enum: ["strategy", "brief", "post-mortem", "market", "other"],
        description:
          "What kind of memo this is. strategy = directional argument; brief = scoped instructions/context; post-mortem = analysis of a past event; market = competitive/market intelligence; other = if none fit cleanly.",
      },
      keyClaims: {
        type: "array",
        items: { type: "string" },
        description:
          "3-6 distilled assertions the memo makes. Each one sentence, in the memo's own framing. These are the load-bearing arguments — what would change if a reader believed them.",
      },
      decisions: {
        type: "array",
        items: { type: "string" },
        description:
          "Explicit decisions or recommendations the memo states. Empty array if the memo is purely analytical and proposes nothing. Each one sentence, naming the action and who.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "5-8 lowercase kebab-case tags. Cover topic, segment, timeframe. No spaces.",
      },
      sourceHint: {
        type: "string",
        description:
          "Best inference of the author or team. Empty if not extractable.",
      },
      bodyMarkdown: {
        type: "string",
        description:
          "Rewrite the source as concise, structured markdown. Preserve every factual claim, every number, every named entity, every direct quote verbatim. Strip transcript noise, headers/footers, formatting artifacts. Use markdown headings. NEVER invent or interpret.",
      },
    },
    required: [],
  },
} as const;

const CATEGORIZE_SYSTEM_PROMPT = `You are a knowledge librarian filing a narrative memo into the team's repository. Memos are strategy documents, briefs, post-mortems, or market notes — anything narrative that is neither structured research nor a PRD.

Rules:
1. Be conservative. Leave fields empty rather than invent.
2. Extract from the text only. Don't infer who wrote it from the filename or vibe.
3. keyClaims are the assertions the memo *makes* — the load-bearing arguments. Not "the author discusses X" but "X is happening, and here's what to do about it." If the memo isn't asserting anything, leave keyClaims empty rather than padding.
4. decisions are explicit recommendations or calls — "We should ship feature X in Q3", "Stop investment in Y" — not summaries of the memo's tone.
5. bodyMarkdown is a structured rewrite of the original, NOT a summary. Preserve every factual claim, every number, every named entity, every direct quote verbatim. Compression comes from removing transcript noise and formatting artifacts.

Output the categorize_memo tool call. Do not write prose outside the tool call.`;

const CATEGORIZE_MAX_CHARS = 30_000;

export async function categorizeMemo(args: {
  content: string;
  filename?: string;
}): Promise<CategorizeMemoResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockCategorize(args.content);
  }
  const trimmed =
    args.content.length > CATEGORIZE_MAX_CHARS
      ? args.content.slice(0, CATEGORIZE_MAX_CHARS) +
        `\n\n[...truncated from ${args.content.length} chars]`
      : args.content;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 2,
  });

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: CATEGORIZE_SYSTEM_PROMPT,
        tools: [CATEGORIZE_TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: CATEGORIZE_TOOL.name },
        messages: [
          {
            role: "user",
            content: `Original filename: ${args.filename ?? "(none)"}\n\nExtracted text:\n\n${trimmed}`,
          },
        ],
      }),
    );
    const tool = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!tool) return {};
    return tool.input as CategorizeMemoResult;
  } catch (err) {
    console.error("[categorizeMemo] failed:", err);
    return mockCategorize(args.content);
  }
}

function mockCategorize(content: string): CategorizeMemoResult {
  const firstPara = content.split(/\n\n/).find((p) => p.trim().length > 40);
  // Pull bullet-like lines as keyClaims/decisions heuristically.
  const lines = content.split(/\n/).map((s) => s.trim());
  const bullets = lines
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, ""))
    .filter((l) => l.length > 12 && l.length < 240);
  return {
    summary: firstPara?.trim().slice(0, 280),
    memoKind: "other",
    keyClaims: bullets.slice(0, 5),
  };
}
