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
// Input cap. Documents larger than this get truncated at the tail; the
// LLM only sees the first slice.
const MAX_CHARS = 100_000;
// Output budget. Generous because the body cleanup output dominates —
// the metadata fields total <500 tokens. 32K tokens ≈ 120KB of body
// output, enough for almost any single-file upload.
const MAX_OUT_TOKENS = 32_000;
// The body output is a SYNTHESIS, not a 1:1 rewrite — shorter than the
// source is expected (and the point). We no longer enforce a length
// ratio; the only truncation we still flag is hitting the output cap
// mid-document (stop_reason="max_tokens"), which is unambiguously bad.

// ── Common shape + per-kind extensions ──

interface CommonCategorizeFields {
  title?: string;
  summary?: string;
  tags?: string[];
  sourceHint?: string;
  // The cleaned, restructured body — extracted content minus noise
  // (page numbers, headers/footers, legal boilerplate, formatting
  // artifacts), with headings and paragraph breaks added for human +
  // AI readability. Every factual claim, number, named entity, and
  // direct quote from the source is preserved verbatim; only noise
  // is removed. Callers use this as the document body in place of
  // the raw extracted text.
  bodyMarkdown?: string;
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
  bodyMarkdown: {
    type: "string",
    description:
      "A NEW insight-shaped document that distills the source for downstream synthesis and decision-making. Not a cleaned-up copy of the source — a reorganized, decision-ready artifact. Lead with a TL;DR of what this document tells the reader. Surface key findings as bulleted insights. Pull out every metric, number, percentage, date, and target into a scannable form. Convert dense prose into structured sections organized by what a teammate needs to know (not the source's original outline). Use ## headings, callout-style key-fact lists, and markdown tables for structured data. Keep direct quotes that carry weight (as > blockquotes with attribution). Drop boilerplate (page numbers, headers, footers, copyright, watermarks). The result should read like a well-written internal brief that summarizes the source — tight, scannable, insight-first. Every claim must be grounded in the source; reorganizing and reframing is encouraged, inventing facts is not.",
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

// Shared block used by every kind's system prompt. The metadata rules
// are kind-specific; the body-synthesis rules are universal — the goal
// is the same regardless of whether we're categorizing research, a PRD,
// or a memo: produce a working version of the document that's useful
// for downstream synthesis, insights, and decisions. The original
// upload is stored alongside as a citation, so this body doesn't need
// to be 1:1 — it needs to be USEFUL.

const BODY_SYNTHESIS_RULES = `BODY SYNTHESIS (applies to the bodyMarkdown field):

You are WRITING A NEW DOCUMENT, not cleaning the source. The original upload is preserved verbatim alongside as a citation — your bodyMarkdown is a fresh, insight-shaped artifact built FROM the source, optimized for fast comprehension and downstream synthesis. Think: "internal brief a smart analyst would write after reading this." A teammate should be able to read your output in 2-5 minutes and understand the load-bearing facts, claims, and metrics without ever opening the original.

REQUIRED STRUCTURE:

Open with a ## TL;DR section: 3-6 bullets, each one a complete sentence stating a single insight, finding, decision, or recommendation the document advances. Lead with the most decision-relevant. These are NOT topic summaries ("this section covers X") — they are the actual conclusions ("Customers cite onboarding friction as the #1 blocker, with 47% abandoning during step 3").

Next, if the source contains any quantitative data, a ## Key metrics section: a scannable list or table of every meaningful number — percentages, dollar values, dates, deadlines, targets, counts, growth rates. Each line: the metric, its value, and one-line context. Numbers buried in prose belong here, surfaced.

Then ## Findings (or ## Analysis, ## Argument, ## Background — whatever fits the document's shape). Organize by theme, not by the source's original layout. Each section: ### sub-headings, then 2-5 sentence paragraphs that explain the finding and the evidence behind it. Embed direct quotes as > blockquotes with attribution where they carry weight. Use bullet lists for enumerations.

Close with ## Implications or ## Next steps if the document advances any (decisions made, recommendations, open questions, action items). Skip if the source doesn't surface them — don't invent.

CONTENT RULES:
- REFRAME and REORGANIZE freely. The source's order, headings, and prose structure are NOT sacred. Your job is to extract the signal and present it in the shape that makes it most useful.
- PRESERVE every load-bearing fact: findings, claims, decisions, numbers, named entities (people, companies, products, teams), and quotes that carry argumentative weight.
- DROP all chrome and noise: page numbers, running headers/footers, copyright/confidentiality/legal boilerplate, watermarks, table-of-contents, "see page N" pointers, navigation breadcrumbs, repeated restatements, and tangential content that doesn't inform a decision.
- DENSIFY: a 40-page report with 6 key findings becomes a 1-2 page insight brief. A 3-page memo with one main argument might become a half-page brief. Aim for high signal per word.
- GROUND every claim in the source. Reframing is encouraged; inventing facts, numbers, or quotes is not.

If the source is already a tight, well-structured insight document (e.g. pasted markdown that already has TL;DR + key findings), keep its structure but still surface any buried metrics into a Key metrics section.`;

const RESEARCH_SYSTEM = `You are a senior research analyst at a B2B SaaS company. The team has just dropped a primary-source research artifact (interview, customer call notes, study, survey results) into the knowledge base. Your job: produce a tight insight brief that the team can actually use to make decisions — plus the structured metadata that lets it cross-reference cleanly with people, customers, and OKRs.

PRIMARY OUTPUT — bodyMarkdown:
${BODY_SYNTHESIS_RULES}

SUPPORTING METADATA:
- title: descriptive (max ~80 chars). Invent one if the source's is generic.
- summary: 1-3 sentences stating WHAT WAS FOUND, not what was studied. Lead with the finding.
- participants: extracted from the text only. Each: 'Name (Role @ Company)'. Empty array if not named.
- methodology: one short sentence on HOW the research was conducted. Empty if not stated.
- tags: 5-8 lowercase kebab-case. Cover topic, segment, theme, timeframe.

Output the categorize_research tool call. Do not write prose outside the tool call.`;

const PRD_SYSTEM = `You are a senior product operations partner. A PRD has just been dropped into the knowledge base. Your job: produce a tight insight brief that lets a teammate understand the problem, the proposed solution, and what success looks like in under five minutes — plus the structured metadata that lets it file cleanly against the team's OKRs, BUs, and metrics.

PRIMARY OUTPUT — bodyMarkdown:
${BODY_SYNTHESIS_RULES}

SUPPORTING METADATA:
- title: descriptive (max ~80 chars).
- summary: 1-3 sentences. What's being built, for whom, why now.
- problem: 2-4 sentences. Pull verbatim where the PRD makes its case sharply.
- solution: 2-5 sentences. Capability-level, not implementation.
- targetUsers: short noun phrases. Empty if not stated.
- successMetrics: lifted verbatim or near-verbatim. Do not paraphrase numbers, units, or dates.
- status: if stated. Don't infer from filename.
- targetShipDate: ISO format if stated.
- tags: 5-8 lowercase kebab-case.

Output the categorize_prd tool call. Do not write prose outside the tool call.`;

const MEMO_SYSTEM = `You are a senior strategy partner. A narrative memo — strategy, brief, post-mortem, or market read — has just been dropped into the knowledge base. Your job: produce a tight insight brief that surfaces the load-bearing claims, decisions, and recommendations so a teammate gets the argument in minutes — plus the structured metadata for cross-referencing.

PRIMARY OUTPUT — bodyMarkdown:
${BODY_SYNTHESIS_RULES}

SUPPORTING METADATA:
- title: descriptive (max ~80 chars).
- summary: 1-3 sentences stating what the memo argues or concludes. Not "this memo discusses X."
- memoKind: strategy / brief / post-mortem / market / other.
- keyClaims: 3-6 distilled assertions the memo makes. Load-bearing arguments only. Empty if the memo isn't asserting.
- decisions: explicit recommendations or calls. Empty if purely analytical.
- tags: 5-8 lowercase kebab-case.

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
        bodyMarkdown?: string;
      };
      return {
        kind: "research",
        bodyMarkdown: d.bodyMarkdown?.trim() || undefined,
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
        bodyMarkdown?: string;
      };
      return {
        kind: "prd",
        bodyMarkdown: d.bodyMarkdown?.trim() || undefined,
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
        bodyMarkdown?: string;
      };
      return {
        kind: "memo",
        bodyMarkdown: d.bodyMarkdown?.trim() || undefined,
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
            content: `Original filename: ${args.filename ?? "(none)"}

Source text (verbatim — preserved separately as a citation; your job is to write a new, insight-shaped brief from it, not clean it):

${trimmed}`,
          },
        ],
      }),
    );
    const block = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!block) return spec.normalize({});
    const input = block.input as Record<string, unknown>;

    // The synthesis is allowed to be shorter than the source (that's
    // the point). The only failure mode we still guard against is
    // hitting the output cap mid-document — drop the partial body and
    // fall back to raw in that case.
    if (response.stop_reason === "max_tokens") {
      console.warn(
        `[categorizeDocument:${kind}] body synthesis hit max_tokens; falling back to raw text`,
      );
      input.bodyMarkdown = undefined;
    }
    const body = typeof input.bodyMarkdown === "string" ? input.bodyMarkdown : "";
    const headingCount = (body.match(/^##\s/gm) ?? []).length;
    console.log(
      `[categorizeDocument:${kind}] body=${body.length} chars · ${headingCount} ##-headings · source=${text.length} chars · stop=${response.stop_reason}`,
    );
    return spec.normalize(input);
  } catch (err) {
    // Categorization is best-effort — don't block intake on failure.
    console.error(`[categorizeDocument:${kind}] failed:`, err);
    return spec.normalize({});
  }
}
