"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BusinessUnit,
  DerivedMetric,
  MemoDocument,
  MetricChangeDirection,
  MetricChangeUnit,
  MetricKind,
  MetricSentiment,
  PRDDocument,
  ResearchDocument,
} from "@/lib/types";

// Extracts quantitative observations from research / PRD / memo documents
// and structures them as DerivedMetric records. Runs at document ingestion
// time and again when the user clicks "Re-extract metrics".
//
// Three entry points (one per source kind) share the EXTRACT_TOOL schema
// and the finalize pipeline but use kind-specific prompts because the
// framing differs: research observes, PRDs target, memos assert.

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_BODY_CHARS = 24_000;

// ─── Shared schema + helpers ────────────────────────────────────────────

const EXTRACT_TOOL = {
  name: "extract_metrics",
  description:
    "Submit the list of quantitative metrics extracted from the document.",
  input_schema: {
    type: "object",
    properties: {
      metrics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            kind: {
              type: "string",
              enum: [
                "engagement",
                "adoption",
                "retention",
                "satisfaction",
                "performance",
                "revenue",
                "support",
                "other",
              ],
            },
            unit: { type: "string" },
            value: { type: "number" },
            changeDirection: {
              type: "string",
              enum: ["up", "down", "flat", "unknown"],
            },
            changeMagnitude: { type: "number" },
            changeUnit: {
              type: "string",
              enum: ["pct", "absolute", "ratio"],
            },
            sentiment: {
              type: "string",
              enum: ["positive", "negative", "neutral"],
            },
            periodLabel: { type: "string" },
            businessUnitId: { type: "string" },
            evidenceQuote: { type: "string" },
          },
          required: ["name", "kind", "changeDirection", "sentiment"],
        },
      },
    },
    required: ["metrics"],
  },
} as const;

interface ExtractedMetricRaw {
  name: string;
  kind: MetricKind;
  unit?: string;
  value?: number;
  changeDirection: MetricChangeDirection;
  changeMagnitude?: number;
  changeUnit?: MetricChangeUnit;
  sentiment: MetricSentiment;
  periodLabel: string;
  businessUnitId?: string;
  evidenceQuote?: string;
}

function serializeBUList(bus: BusinessUnit[]): string {
  if (bus.length === 0) return "(no business units defined yet)";
  return bus
    .map(
      (b) =>
        `- id: ${b.id} | name: ${b.name}${b.description ? ` — ${b.description}` : ""}`,
    )
    .join("\n");
}

function truncate(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;
  return text.slice(0, MAX_BODY_CHARS) + `\n\n[…truncated from ${text.length} chars]`;
}

async function runExtract(
  systemPrompt: string,
  userBlocks: Anthropic.Messages.ContentBlockParam[],
  maxTokens: number,
): Promise<ExtractedMetricRaw[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
    messages: [{ role: "user", content: userBlocks }],
  });
  const final = await stream.finalMessage();
  const toolBlock = final.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error(
      `Extractor did not return a tool_use block (stop_reason=${final.stop_reason}).`,
    );
  }
  const raw = (toolBlock.input as { metrics?: ExtractedMetricRaw[] }).metrics;
  return Array.isArray(raw) ? raw : [];
}

function newMetricId(i: number): string {
  return `met_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
}

function regexFallback(text: string): {
  subject: string;
  direction: MetricChangeDirection;
  magnitude: number;
  sentence: string;
}[] {
  const out: {
    subject: string;
    direction: MetricChangeDirection;
    magnitude: number;
    sentence: string;
  }[] = [];
  const pctRe = /([A-Z][^.]{6,80}?)(\b(?:up|down|fell|rose|grew|dropped|declined|increased|decreased)\b)[^.]{0,40}?(\d{1,3})\s*%/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(text)) !== null && out.length < 6) {
    const dir = /down|fell|dropped|declined|decreased/i.test(m[2])
      ? "down"
      : "up";
    out.push({
      subject: m[1].trim(),
      direction: dir as MetricChangeDirection,
      magnitude: Number(m[3]),
      sentence: m[0],
    });
  }
  return out;
}

// ─── Public entry point ─────────────────────────────────────────────────
// One function for all three source kinds. Dispatches to the right prompt
// + block builder + finalizer based on doc.kind.

import type { Document } from "@/lib/types";

export async function extractMetricsFromDocument(
  doc: ResearchDocument | PRDDocument | MemoDocument,
  businessUnits: BusinessUnit[],
): Promise<DerivedMetric[]> {
  if (doc.kind === "research") {
    return extractMetricsFromResearch({ research: doc, businessUnits });
  }
  if (doc.kind === "prd") {
    return extractMetricsFromPRD({ prd: doc, businessUnits });
  }
  return extractMetricsFromMemo({ memo: doc, businessUnits });
}

// ─── Research ───────────────────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `You are a research analyst extracting quantitative observations from internal research artifacts. Your job is to find every numeric claim or trend statement in the artifact and structure it so it can be tracked across the team's BU dashboards.

Rules:

1. ONLY extract claims that are actually in the artifact. Do not invent numbers, percentages, or trends. If the artifact has no quantitative claims, return an empty list.

2. Extract metrics, not anecdotes. A metric has a name (what is being measured), a value or direction, and a period. "Some users complained" is not a metric. "Adoption fell 32% over Q1" is.

3. Each metric gets:
   - name: canonical name another researcher would naturally pick (e.g. "AI Agent builder weekly active users", not "the agent thing"). Lowercase first word unless proper noun. No trailing period.
   - kind: engagement / adoption / retention / satisfaction / performance / revenue / support / other.
   - unit: "%", "users", "days", "$", "score", etc. Empty if not stated.
   - value: headline number if stated. null if only a direction.
   - changeDirection: up / down / flat / unknown.
   - changeMagnitude: size of the change. Omit if only direction is stated.
   - changeUnit: pct / absolute / ratio.
   - sentiment: positive / negative / neutral relative to the business.
   - periodLabel: "April 2026" / "last quarter" / "Q1 2026". Default to "as observed".
   - businessUnitId: pick from the provided BU list. Omit if no BU fits.
   - evidenceQuote: verbatim sentence from the artifact. Required when possible.

4. Be conservative. Six precise, defensible metrics is better than fifteen shaky ones.

5. Canonical metric names enable cross-document dedup. Use names that would naturally collide if two artifacts measure the same thing.

Output via the extract_metrics tool. No prose outside the tool call.`;

function buildResearchBlock(d: ResearchDocument): string {
  const meta: string[] = [];
  if (d.source) meta.push(`Source: ${d.source}`);
  if (d.properties.conductedAt)
    meta.push(`Conducted: ${d.properties.conductedAt}`);
  if (d.properties.methodology)
    meta.push(`Methodology: ${d.properties.methodology}`);
  return `# Research artifact: ${d.title}
${meta.join("\n")}

Executive summary: ${d.summary}

Full body:
${truncate(d.content)}`;
}

export interface ExtractMetricsInput {
  research: ResearchDocument;
  businessUnits: BusinessUnit[];
}

export async function extractMetricsFromResearch(
  input: ExtractMetricsInput,
): Promise<DerivedMetric[]> {
  if (!process.env.ANTHROPIC_API_KEY) return mockResearchExtract(input);
  const raw = await runExtract(
    RESEARCH_SYSTEM_PROMPT,
    [
      {
        type: "text",
        text: `# Business unit roster\n\n${serializeBUList(input.businessUnits)}`,
      },
      { type: "text", text: buildResearchBlock(input.research) },
      {
        type: "text",
        text: "Now call extract_metrics with the list of metrics you found. Empty list is fine if the artifact has no numeric claims.",
      },
    ],
    6000,
  );
  return finalizeResearch(raw, input, "anthropic");
}

function finalizeResearch(
  raw: ExtractedMetricRaw[],
  input: ExtractMetricsInput,
  generatedBy: "anthropic" | "mock",
): DerivedMetric[] {
  const buIds = new Set(input.businessUnits.map((b) => b.id));
  const now = new Date().toISOString();
  const asOfDate = input.research.properties.conductedAt;
  return raw.map((m, i) => ({
    id: newMetricId(i),
    name: m.name.trim(),
    kind: m.kind,
    unit: m.unit?.trim() || undefined,
    value: typeof m.value === "number" ? m.value : undefined,
    changeDirection: m.changeDirection,
    changeMagnitude:
      typeof m.changeMagnitude === "number" ? m.changeMagnitude : undefined,
    changeUnit: m.changeUnit,
    sentiment: m.sentiment,
    observationType: "observed",
    periodLabel: m.periodLabel || "as observed",
    asOfDate,
    sourceKind: "research",
    sourceDocumentId: input.research.id,
    businessUnitId:
      m.businessUnitId && buIds.has(m.businessUnitId)
        ? m.businessUnitId
        : undefined,
    linkedObjectiveIds: input.research.linkedObjectiveIds,
    evidenceQuote: m.evidenceQuote?.trim() || undefined,
    generatedBy,
    createdAt: now,
  }));
}

function mockResearchExtract(input: ExtractMetricsInput): DerivedMetric[] {
  const raw: ExtractedMetricRaw[] = regexFallback(input.research.content).map(
    (h) => ({
      name: h.subject.toLowerCase(),
      kind: "engagement",
      unit: "%",
      changeDirection: h.direction,
      changeMagnitude: h.magnitude,
      changeUnit: "pct",
      sentiment: h.direction === "down" ? "negative" : "positive",
      periodLabel: input.research.properties.conductedAt ?? "as observed",
      businessUnitId: input.businessUnits[0]?.id,
      evidenceQuote: h.sentence,
    }),
  );
  return finalizeResearch(raw, input, "mock");
}

// ─── PRD ────────────────────────────────────────────────────────────────
// PRDs state TARGET metrics, not observed trends. Same schema, flipped
// framing; results tagged observationType="target".

const PRD_SYSTEM_PROMPT = `You are a product operations specialist extracting TARGET metrics from a PRD (product requirements document). Inputs:
- A PRD with a problem, solution, target users, success metrics, and body.
- The list of business units. Use the PRD's linked BU when present; otherwise infer.

Rules:

1. ONLY extract metrics that are explicitly stated as TARGETS in the PRD. If the PRD has no quantitative targets, return an empty list.

2. Use canonical metric names that would naturally collide with research-observed metrics on the BU dashboard. Same canonical name = same row.

3. For each metric:
   - name: canonical name (lowercase first word, no trailing period).
   - kind: engagement / adoption / retention / satisfaction / performance / revenue / support / other.
   - unit: "%", "users", "days", "$".
   - value: the target value. Required when stated.
   - changeDirection: usually "up" toward growth, "down" for reductions (errors, churn, latency).
   - changeMagnitude: omit unless the PRD states a delta target ("improve by 10 points").
   - changeUnit: pct / absolute / ratio.
   - sentiment: "positive" — achieving the target is by definition positive.
   - periodLabel: "within 90 days" / "by ship + 30d" / "Q3 2026". Required.
   - businessUnitId: pick from the BU list. Use the PRD's linked BU when present.
   - evidenceQuote: verbatim sentence stating this target. Required where possible.

4. Be conservative. Six precise targets beats fifteen shaky ones.

Output via the extract_metrics tool. No prose outside the tool call.`;

function buildPRDBlock(d: PRDDocument): string {
  const meta: string[] = [];
  if (d.source) meta.push(`Owner: ${d.source}`);
  meta.push(`Status: ${d.properties.status}`);
  if (d.properties.targetShipDate)
    meta.push(`Target ship: ${d.properties.targetShipDate}`);
  if (d.linkedBusinessUnitId)
    meta.push(`Linked BU id: ${d.linkedBusinessUnitId}`);
  return `# PRD: ${d.title}
${meta.join("\n")}

Executive summary: ${d.summary}

Problem: ${d.properties.problem}

Proposed solution: ${d.properties.solution}

Target users: ${d.properties.targetUsers.join(", ") || "(unstated)"}

Stated success metrics:
${d.properties.successMetrics.map((s) => `- ${s}`).join("\n") || "(none stated)"}

Full body:
${truncate(d.content)}`;
}

export interface ExtractPRDMetricsInput {
  prd: PRDDocument;
  businessUnits: BusinessUnit[];
}

export async function extractMetricsFromPRD(
  input: ExtractPRDMetricsInput,
): Promise<DerivedMetric[]> {
  if (!process.env.ANTHROPIC_API_KEY) return mockPRDExtract(input);
  const raw = await runExtract(
    PRD_SYSTEM_PROMPT,
    [
      {
        type: "text",
        text: `# Business unit roster\n\n${serializeBUList(input.businessUnits)}`,
      },
      { type: "text", text: buildPRDBlock(input.prd) },
      {
        type: "text",
        text: "Now call extract_metrics with the TARGET metrics stated in this PRD.",
      },
    ],
    4000,
  );
  return finalizePRD(raw, input, "anthropic");
}

function finalizePRD(
  raw: ExtractedMetricRaw[],
  input: ExtractPRDMetricsInput,
  generatedBy: "anthropic" | "mock",
): DerivedMetric[] {
  const buIds = new Set(input.businessUnits.map((b) => b.id));
  const now = new Date().toISOString();
  return raw.map((m, i) => ({
    id: newMetricId(i),
    name: m.name.trim(),
    kind: m.kind,
    unit: m.unit?.trim() || undefined,
    value: typeof m.value === "number" ? m.value : undefined,
    changeDirection: m.changeDirection,
    changeMagnitude:
      typeof m.changeMagnitude === "number" ? m.changeMagnitude : undefined,
    changeUnit: m.changeUnit,
    sentiment: m.sentiment,
    observationType: "target",
    periodLabel: m.periodLabel || "target",
    asOfDate: input.prd.properties.targetShipDate,
    sourceKind: "prd",
    sourceDocumentId: input.prd.id,
    businessUnitId:
      (m.businessUnitId && buIds.has(m.businessUnitId)
        ? m.businessUnitId
        : undefined) ?? input.prd.linkedBusinessUnitId,
    linkedObjectiveIds: input.prd.linkedObjectiveIds,
    evidenceQuote: m.evidenceQuote?.trim() || undefined,
    generatedBy,
    createdAt: now,
  }));
}

function mockPRDExtract(input: ExtractPRDMetricsInput): DerivedMetric[] {
  const out: ExtractedMetricRaw[] = [];
  for (const s of input.prd.properties.successMetrics.slice(0, 6)) {
    const numMatch = s.match(/(\d{1,4})\s*(%|x|days|users|seconds|ms|\$)?/i);
    const value = numMatch ? Number(numMatch[1]) : undefined;
    const unit = numMatch?.[2];
    const isReduction = /reduce|lower|cut|down|decrease/i.test(s);
    out.push({
      name: s.slice(0, 80).toLowerCase(),
      kind: "adoption",
      unit,
      value,
      changeDirection: isReduction ? "down" : "up",
      changeUnit: unit === "%" ? "pct" : "absolute",
      sentiment: "positive",
      periodLabel: input.prd.properties.targetShipDate ?? "target",
      businessUnitId: input.prd.linkedBusinessUnitId,
      evidenceQuote: s,
    });
  }
  return finalizePRD(out, input, "mock");
}

// ─── Memo ────────────────────────────────────────────────────────────────
// Memos surface observed metrics in the same shape as research; framing
// differs but the system prompt is reusable.

function buildMemoBlock(d: MemoDocument): string {
  const meta: string[] = [];
  if (d.source) meta.push(`Author: ${d.source}`);
  meta.push(`Kind: ${d.properties.memoKind}`);
  if (d.linkedBusinessUnitId)
    meta.push(`Linked BU id: ${d.linkedBusinessUnitId}`);
  return `# Memo: ${d.title}
${meta.join("\n")}

Summary: ${d.summary}

Key claims:
${d.properties.keyClaims.map((c) => `- ${c}`).join("\n") || "(none stated)"}

Decisions:
${d.properties.decisions.map((dec) => `- ${dec}`).join("\n") || "(none stated)"}

Full body:
${truncate(d.content)}`;
}

export interface ExtractMemoMetricsInput {
  memo: MemoDocument;
  businessUnits: BusinessUnit[];
}

export async function extractMetricsFromMemo(
  input: ExtractMemoMetricsInput,
): Promise<DerivedMetric[]> {
  if (!process.env.ANTHROPIC_API_KEY) return mockMemoExtract(input);
  const raw = await runExtract(
    RESEARCH_SYSTEM_PROMPT,
    [
      {
        type: "text",
        text: `# Business unit roster\n\n${serializeBUList(input.businessUnits)}`,
      },
      { type: "text", text: buildMemoBlock(input.memo) },
      {
        type: "text",
        text: "Now call extract_metrics with any quantitative observations the memo asserts. Empty list is fine if the memo has no numeric claims.",
      },
    ],
    4000,
  );
  return finalizeMemo(raw, input, "anthropic");
}

function finalizeMemo(
  raw: ExtractedMetricRaw[],
  input: ExtractMemoMetricsInput,
  generatedBy: "anthropic" | "mock",
): DerivedMetric[] {
  const buIds = new Set(input.businessUnits.map((b) => b.id));
  const now = new Date().toISOString();
  return raw.map((m, i) => ({
    id: newMetricId(i),
    name: m.name.trim(),
    kind: m.kind,
    unit: m.unit?.trim() || undefined,
    value: typeof m.value === "number" ? m.value : undefined,
    changeDirection: m.changeDirection,
    changeMagnitude:
      typeof m.changeMagnitude === "number" ? m.changeMagnitude : undefined,
    changeUnit: m.changeUnit,
    sentiment: m.sentiment,
    observationType: "observed",
    periodLabel: m.periodLabel || "as asserted",
    asOfDate: undefined,
    sourceKind: "memo",
    sourceDocumentId: input.memo.id,
    businessUnitId:
      (m.businessUnitId && buIds.has(m.businessUnitId)
        ? m.businessUnitId
        : undefined) ?? input.memo.linkedBusinessUnitId,
    linkedObjectiveIds: input.memo.linkedObjectiveIds,
    evidenceQuote: m.evidenceQuote?.trim() || undefined,
    generatedBy,
    createdAt: now,
  }));
}

function mockMemoExtract(input: ExtractMemoMetricsInput): DerivedMetric[] {
  const raw: ExtractedMetricRaw[] = regexFallback(input.memo.content).map(
    (h) => ({
      name: h.subject.toLowerCase(),
      kind: "engagement",
      unit: "%",
      changeDirection: h.direction,
      changeMagnitude: h.magnitude,
      changeUnit: "pct",
      sentiment: h.direction === "down" ? "negative" : "positive",
      periodLabel: "as asserted",
      businessUnitId:
        input.memo.linkedBusinessUnitId ?? input.businessUnits[0]?.id,
      evidenceQuote: h.sentence,
    }),
  );
  return finalizeMemo(raw, input, "mock");
}
