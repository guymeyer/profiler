"use server";
import Anthropic from "@anthropic-ai/sdk";
import type { PRDStatus } from "@/lib/types";
import { withRetry } from "@/lib/llm/retry";

// PRD-specific categorize. Parallel to lib/extract/actions.ts:categorizeResearch
// but pulls planning-shape fields from the body: problem, solution, target
// users, success metrics, status, target ship date.

export interface CategorizePRDResult {
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
  bodyMarkdown?: string;
}

const CATEGORIZE_TOOL = {
  name: "categorize_prd",
  description:
    "Extract structured PRD metadata from a planning-document source.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "Concise PRD title (max ~80 chars) that names what is being built. Invent a descriptive title if the source's title is generic.",
      },
      summary: {
        type: "string",
        description:
          "1-3 sentence executive summary. What is being built, for whom, and why now. No filler.",
      },
      problem: {
        type: "string",
        description:
          "The problem this PRD addresses, in 2-4 sentences. Pull verbatim language from the source where it's available.",
      },
      solution: {
        type: "string",
        description:
          "The proposed solution / approach, in 2-5 sentences. What the team will build, at the right altitude (capability-level, not implementation-level).",
      },
      targetUsers: {
        type: "array",
        items: { type: "string" },
        description:
          "User segments / personas the PRD targets. Each entry: short noun phrase ('admin operators at Canada Life', 'first-time agent builders'). Empty array if not stated.",
      },
      successMetrics: {
        type: "array",
        items: { type: "string" },
        description:
          "Target / success metrics as written in the PRD ('30% adoption within 90 days', 'time-to-first-agent under 7 days'). Verbatim where possible. Empty if not stated.",
      },
      status: {
        type: "string",
        enum: ["draft", "review", "approved", "shipped"],
        description:
          "PRD status if stated. If the PRD mentions a state ('in review', 'approved at the May 18 council'), map to enum. Omit if not stated.",
      },
      targetShipDate: {
        type: "string",
        description:
          "Target ship date in ISO format (YYYY-MM-DD) if stated. Omit if not stated.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "5-8 lowercase kebab-case tags. Cover the product area, audience, and theme. No spaces.",
      },
      sourceHint: {
        type: "string",
        description:
          "Best inference of the owner / author of this PRD (e.g. 'Product · AI Platform', 'Jon Sigler'). Empty if not extractable.",
      },
      bodyMarkdown: {
        type: "string",
        description:
          "Rewrite the source as concise, structured markdown. Preserve every factual claim, target metric, named entity, and direct quote verbatim. Strip transcript noise, formatting artifacts, page headers/footers. Use markdown headings to organize sections. NEVER invent or interpret.",
      },
    },
    required: [],
  },
} as const;

const CATEGORIZE_SYSTEM_PROMPT = `You are a product operations specialist categorizing a PRD (product requirements document) so it can be filed in the team's planning library and cross-referenced with research, OKRs, and metrics.

Rules:
1. Be conservative. Leave fields empty rather than invent. This metadata will be cited to stakeholders; fabricated content destroys credibility.
2. Extract from the text only. Don't infer status from the filename or vibe.
3. successMetrics must be lifted verbatim or near-verbatim from the PRD — do not paraphrase numbers, units, or dates. They will be used downstream to track target vs. observed.
4. problem and solution are the two most important fields. If the PRD doesn't clearly separate them, identify the closest passages and report them.
5. bodyMarkdown is a structured rewrite of the original, NOT a summary. Preserve every factual claim, every number, every named entity, every direct quote — verbatim. Compression comes from removing transcript noise and formatting artifacts.

Output the categorize_prd tool call. Do not write prose outside the tool call.`;

const CATEGORIZE_MAX_CHARS = 30_000;

export async function categorizePRD(args: {
  content: string;
  filename?: string;
}): Promise<CategorizePRDResult> {
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
    return tool.input as CategorizePRDResult;
  } catch (err) {
    console.error("[categorizePRD] failed:", err);
    return mockCategorize(args.content);
  }
}

// Lightweight mock so the upload UX still produces something without an API
// key. Pulls the first paragraph as summary; extracts target-metric-like
// patterns into successMetrics.
function mockCategorize(content: string): CategorizePRDResult {
  const firstPara = content.split(/\n\n/).find((p) => p.trim().length > 40);
  const successMetrics: string[] = [];
  const re = /([A-Z][^.]{8,120}?\d{1,4}\s*(?:%|x|users|days|seconds|ms))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null && successMetrics.length < 5) {
    successMetrics.push(m[1].trim());
  }
  return {
    summary: firstPara?.trim().slice(0, 280),
    successMetrics: successMetrics.length > 0 ? successMetrics : undefined,
    status: "draft",
  };
}
