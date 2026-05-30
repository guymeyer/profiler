"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BusinessUnit,
  DerivedMetric,
  Memo,
  MetricChangeDirection,
  MetricChangeUnit,
  MetricKind,
  MetricSentiment,
  PRD,
  ResearchArtifact,
} from "@/lib/types";

// Extracts quantitative observations from a research artifact and structures
// them as DerivedMetric records. Runs at research ingestion time and again
// when the user clicks "Re-extract metrics" on the research detail page.

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_RESEARCH_CHARS = 24_000;

export interface ExtractMetricsInput {
  research: ResearchArtifact;
  businessUnits: BusinessUnit[];
}

const SYSTEM_PROMPT = `You are a research analyst extracting quantitative observations from internal research artifacts. Your job is to find every numeric claim or trend statement in the artifact and structure it so it can be tracked across the team's BU dashboards.

Rules:

1. ONLY extract claims that are actually in the artifact. Do not invent numbers, percentages, or trends. If the artifact has no quantitative claims, return an empty list. Fabricated metrics destroy the user's credibility with their stakeholders.

2. Extract metrics, not anecdotes. A metric has a name (what is being measured), a value or direction, and a period. "Some users complained" is not a metric. "Adoption fell 32% over Q1" is.

3. Each metric gets:
   - name: canonical name that another researcher would naturally pick if they were describing the same metric (e.g. "AI Agent builder weekly active users", not "the agent thing"). Lowercase the first word unless it's a proper noun. No trailing period.
   - kind: which category — engagement / adoption / retention / satisfaction / performance / revenue / support / other.
   - unit: "%", "users", "days", "$", "score", etc. Empty if not stated.
   - value: the headline number if stated (e.g. 4200 active users). null if only a direction is given.
   - changeDirection: up / down / flat / unknown.
   - changeMagnitude: size of the change. For "down 32%", magnitude is 32. Omit if only direction is stated.
   - changeUnit: pct / absolute / ratio.
   - sentiment: is this direction good or bad for the business? Use judgment — a 32% drop in usage is negative, a 32% drop in support volume is positive.
   - periodLabel: how the artifact describes the time frame ("April 2026", "last quarter", "Q1 2026"). If unstated, use "as observed".
   - businessUnitId: pick from the provided BU list. Use the BU whose scope this metric clearly belongs to (e.g. "AI Agent Studio usage" → the AI Platform BU). If no BU fits well, omit.
   - evidenceQuote: the verbatim sentence or short passage from the artifact that contains the metric. Required when possible — this is how the team verifies the claim.

4. Be conservative with quantity. Six precise, defensible metrics is better than fifteen shaky ones. If you would have to stretch a claim into a metric shape, skip it.

5. Use canonical metric names so cross-research dedup works. If two research artifacts both say "AI Agent builder weekly active users", they should produce metrics with the same \`name\` so the dashboard can collapse them into a trend.

Output via the extract_metrics tool. No prose outside the tool call.`;

const EXTRACT_TOOL = {
  name: "extract_metrics",
  description:
    "Submit the list of quantitative metrics extracted from the research artifact.",
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
          required: [
            "name",
            "kind",
            "changeDirection",
            "sentiment",
            "periodLabel",
          ],
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

function buildResearchBlock(r: ResearchArtifact): string {
  const trimmed =
    r.content.length > MAX_RESEARCH_CHARS
      ? r.content.slice(0, MAX_RESEARCH_CHARS) +
        `\n\n[…truncated from ${r.content.length} chars]`
      : r.content;
  const meta: string[] = [];
  if (r.source) meta.push(`Source: ${r.source}`);
  if (r.conductedAt) meta.push(`Conducted: ${r.conductedAt}`);
  if (r.methodology) meta.push(`Methodology: ${r.methodology}`);
  return `# Research artifact: ${r.title}
${meta.join("\n")}

Executive summary: ${r.summary}

Full body:
${trimmed}`;
}

export async function extractMetricsFromResearch(
  input: ExtractMetricsInput,
): Promise<DerivedMetric[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockExtract(input);
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `# Business unit roster\n\n${serializeBUList(input.businessUnits)}`,
    },
    { type: "text", text: buildResearchBlock(input.research) },
    {
      type: "text",
      text: "Now call extract_metrics with the list of metrics you found. Empty list is fine if the artifact has no numeric claims.",
    },
  ];

  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
    messages: [{ role: "user", content: userContent }],
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
  if (!Array.isArray(raw)) return [];

  return finalize(raw, input, "anthropic");
}

function finalize(
  raw: ExtractedMetricRaw[],
  input: ExtractMetricsInput,
  generatedBy: "anthropic" | "mock",
): DerivedMetric[] {
  const buIds = new Set(input.businessUnits.map((b) => b.id));
  const now = new Date().toISOString();
  const asOfDate = input.research.conductedAt;
  return raw.map((m, i) => ({
    id: `met_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
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

// ─── PRD extraction ─────────────────────────────────────────────────────────
// PRDs state TARGET metrics, not observed trends. We reuse the same extractor
// shape but flip the framing in the prompt and tag results as observationType
// "target" so the BU dashboard can display them alongside observed values.

export interface ExtractPRDMetricsInput {
  prd: PRD;
  businessUnits: BusinessUnit[];
}

const PRD_SYSTEM_PROMPT = `You are a product operations specialist extracting TARGET metrics from a PRD (product requirements document). Inputs:
- A PRD with a problem, solution, target users, success metrics, and body.
- The list of business units. Use the PRD's linked BU when present; otherwise infer.

Rules:

1. ONLY extract metrics that are explicitly stated as TARGETS in the PRD. Do not invent. If the PRD has no quantitative targets, return an empty list.

2. Use canonical metric names that would naturally collide with research-observed metrics on the BU dashboard. If the PRD targets "30% adoption within 90 days" and research observes "AI Agent Studio adoption", the metric name in BOTH should be "AI Agent Studio adoption" (or your canonical equivalent). This is critical — same canonical name = same row on the dashboard.

3. For each metric:
   - name: canonical name (lowercase first word unless proper noun, no trailing period).
   - kind: engagement / adoption / retention / satisfaction / performance / revenue / support / other.
   - unit: "%", "users", "days", "$", etc.
   - value: the target value (e.g. 30 for "30% adoption"). Required when stated.
   - changeDirection: usually "up" for a target you want to grow toward, "down" if the target is reducing something (errors, churn, latency).
   - changeMagnitude: omit unless the PRD states a delta target (e.g. "improve adoption by 10 points").
   - changeUnit: pct / absolute / ratio.
   - sentiment: "positive" — achieving the target is by definition positive.
   - periodLabel: how the PRD describes the target window ("within 90 days", "by ship + 30d", "Q3 2026"). Required.
   - businessUnitId: pick from the BU list. Use the PRD's linked BU when present.
   - evidenceQuote: the verbatim sentence stating this target. Required where possible.

4. Be conservative. Six precise targets beats fifteen shaky ones.

Output via the extract_metrics tool. No prose outside the tool call.`;

function buildPRDBlock(p: PRD): string {
  const trimmed =
    p.content.length > MAX_RESEARCH_CHARS
      ? p.content.slice(0, MAX_RESEARCH_CHARS) +
        `\n\n[…truncated from ${p.content.length} chars]`
      : p.content;
  const meta: string[] = [];
  if (p.source) meta.push(`Owner: ${p.source}`);
  if (p.status) meta.push(`Status: ${p.status}`);
  if (p.targetShipDate) meta.push(`Target ship: ${p.targetShipDate}`);
  if (p.linkedBusinessUnitId)
    meta.push(`Linked BU id: ${p.linkedBusinessUnitId}`);
  return `# PRD: ${p.title}
${meta.join("\n")}

Executive summary: ${p.summary}

Problem: ${p.problem}

Proposed solution: ${p.solution}

Target users: ${p.targetUsers.join(", ") || "(unstated)"}

Stated success metrics:
${p.successMetrics.map((s) => `- ${s}`).join("\n") || "(none stated)"}

Full body:
${trimmed}`;
}

export async function extractMetricsFromPRD(
  input: ExtractPRDMetricsInput,
): Promise<DerivedMetric[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockExtractFromPRD(input);
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `# Business unit roster\n\n${serializeBUList(input.businessUnits)}`,
    },
    { type: "text", text: buildPRDBlock(input.prd) },
    {
      type: "text",
      text: "Now call extract_metrics with the TARGET metrics stated in this PRD.",
    },
  ];

  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 4000,
    system: PRD_SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
    messages: [{ role: "user", content: userContent }],
  });
  const final = await stream.finalMessage();
  const toolBlock = final.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error(
      `PRD extractor did not return a tool_use block (stop_reason=${final.stop_reason}).`,
    );
  }
  const raw = (toolBlock.input as { metrics?: ExtractedMetricRaw[] }).metrics;
  if (!Array.isArray(raw)) return [];

  return finalizeForPRD(raw, input, "anthropic");
}

function finalizeForPRD(
  raw: ExtractedMetricRaw[],
  input: ExtractPRDMetricsInput,
  generatedBy: "anthropic" | "mock",
): DerivedMetric[] {
  const buIds = new Set(input.businessUnits.map((b) => b.id));
  const now = new Date().toISOString();
  return raw.map((m, i) => ({
    id: `met_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
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
    asOfDate: input.prd.targetShipDate,
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

function mockExtractFromPRD(input: ExtractPRDMetricsInput): DerivedMetric[] {
  // Use the explicit successMetrics strings as the source. Parse one number
  // out of each string if possible.
  const out: ExtractedMetricRaw[] = [];
  for (const s of input.prd.successMetrics.slice(0, 6)) {
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
      periodLabel: input.prd.targetShipDate ?? "target",
      businessUnitId: input.prd.linkedBusinessUnitId,
      evidenceQuote: s,
    });
  }
  return finalizeForPRD(out, input, "mock");
}

// ─── Memo extraction ────────────────────────────────────────────────────────
// Memos can contain metric-shaped claims too — strategy memos cite numbers,
// post-mortems quantify regressions, market notes report competitor figures.
// Treat extracted metrics from memos as observed (the memo asserts them as
// fact); the BU dashboard groups by canonical name regardless of source.

export interface ExtractMemoMetricsInput {
  memo: Memo;
  businessUnits: BusinessUnit[];
}

function buildMemoBlock(m: Memo): string {
  const trimmed =
    m.content.length > MAX_RESEARCH_CHARS
      ? m.content.slice(0, MAX_RESEARCH_CHARS) +
        `\n\n[…truncated from ${m.content.length} chars]`
      : m.content;
  const meta: string[] = [];
  if (m.source) meta.push(`Author: ${m.source}`);
  if (m.memoKind) meta.push(`Kind: ${m.memoKind}`);
  if (m.linkedBusinessUnitId)
    meta.push(`Linked BU id: ${m.linkedBusinessUnitId}`);
  return `# Memo: ${m.title}
${meta.join("\n")}

Summary: ${m.summary}

Key claims:
${m.keyClaims.map((c) => `- ${c}`).join("\n") || "(none stated)"}

Decisions:
${m.decisions.map((d) => `- ${d}`).join("\n") || "(none stated)"}

Full body:
${trimmed}`;
}

export async function extractMetricsFromMemo(
  input: ExtractMemoMetricsInput,
): Promise<DerivedMetric[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockExtractFromMemo(input);
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `# Business unit roster\n\n${serializeBUList(input.businessUnits)}`,
    },
    { type: "text", text: buildMemoBlock(input.memo) },
    {
      type: "text",
      text: "Now call extract_metrics with any quantitative observations the memo asserts. Empty list is fine if the memo has no numeric claims.",
    },
  ];

  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 4000,
    // Reuse the research extractor's system prompt — memos surface observed
    // metrics in the same shape as research; only the framing differs and
    // the LLM handles that from context.
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
    messages: [{ role: "user", content: userContent }],
  });
  const final = await stream.finalMessage();
  const toolBlock = final.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error(
      `Memo extractor did not return a tool_use block (stop_reason=${final.stop_reason}).`,
    );
  }
  const raw = (toolBlock.input as { metrics?: ExtractedMetricRaw[] }).metrics;
  if (!Array.isArray(raw)) return [];

  return finalizeForMemo(raw, input, "anthropic");
}

function finalizeForMemo(
  raw: ExtractedMetricRaw[],
  input: ExtractMemoMetricsInput,
  generatedBy: "anthropic" | "mock",
): DerivedMetric[] {
  const buIds = new Set(input.businessUnits.map((b) => b.id));
  const now = new Date().toISOString();
  return raw.map((m, i) => ({
    id: `met_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
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

function mockExtractFromMemo(input: ExtractMemoMetricsInput): DerivedMetric[] {
  const text = input.memo.content;
  const out: ExtractedMetricRaw[] = [];
  const pctRe = /([A-Z][^.]{6,80}?)(\b(?:up|down|fell|rose|grew|dropped|declined|increased|decreased)\b)[^.]{0,40}?(\d{1,3})\s*%/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(text)) !== null && out.length < 6) {
    const sentence = m[0];
    const subject = m[1].trim();
    const dir = /down|fell|dropped|declined|decreased/i.test(m[2])
      ? "down"
      : "up";
    const mag = Number(m[3]);
    out.push({
      name: subject.toLowerCase(),
      kind: "engagement",
      unit: "%",
      changeDirection: dir as MetricChangeDirection,
      changeMagnitude: mag,
      changeUnit: "pct",
      sentiment: dir === "down" ? "negative" : "positive",
      periodLabel: "as asserted",
      businessUnitId: input.memo.linkedBusinessUnitId ?? input.businessUnits[0]?.id,
      evidenceQuote: sentence,
    });
  }
  return finalizeForMemo(out, input, "mock");
}

// Lightweight mock for when ANTHROPIC_API_KEY isn't set. Heuristically pulls
// out any "<number>%" / "<number>x" pattern with a surrounding sentence so
// the demo arc still produces something on the BU dashboard.
function mockExtract(input: ExtractMetricsInput): DerivedMetric[] {
  const text = input.research.content;
  const out: ExtractedMetricRaw[] = [];
  const pctRe = /([A-Z][^.]{6,80}?)(\b(?:up|down|fell|rose|grew|dropped|declined|increased|decreased)\b)[^.]{0,40}?(\d{1,3})\s*%/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(text)) !== null && out.length < 6) {
    const sentence = m[0];
    const subject = m[1].trim();
    const dir = /down|fell|dropped|declined|decreased/i.test(m[2])
      ? "down"
      : "up";
    const mag = Number(m[3]);
    out.push({
      name: subject.toLowerCase(),
      kind: "engagement",
      unit: "%",
      changeDirection: dir as MetricChangeDirection,
      changeMagnitude: mag,
      changeUnit: "pct",
      sentiment: dir === "down" ? "negative" : "positive",
      periodLabel: input.research.conductedAt ?? "as observed",
      businessUnitId: input.businessUnits[0]?.id,
      evidenceQuote: sentence,
    });
  }
  return finalize(out, input, "mock");
}
