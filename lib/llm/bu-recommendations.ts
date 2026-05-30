"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BURecommendationItem,
  BURecommendationSet,
  BURecommendationStance,
  BusinessUnit,
  DerivedMetric,
  Objective,
  OKR,
  PRD,
  ResearchArtifact,
} from "@/lib/types";

// Generates a BU-level recommendation rollup by comparing every metric tied
// to the BU against (a) the research artifacts that surfaced each metric and
// (b) the BU's OKRs and the abstract objectives those metrics serve.

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_RESEARCH_CHARS = 8_000;

export interface BURecommendationsInput {
  businessUnit: BusinessUnit;
  metrics: DerivedMetric[];
  research: ResearchArtifact[]; // the research that produced observed metrics
  prds?: PRD[]; // PRDs scoped to this BU (planned intent)
  okrs: OKR[]; // BU-scoped OKRs
  objectives: Objective[]; // abstract objectives library (full set)
}

const SYSTEM_PROMPT = `You are a senior product strategist producing a recommendation rollup for one business unit. Inputs you receive:
- The BU's name, description, and OKRs.
- A list of DerivedMetric records — each is either an observed value (sourceKind="research") or a target value (sourceKind="prd"). Same metric name can have both an observed and a target — that's the most valuable comparison.
- The research artifacts those observed metrics came from.
- The PRDs scoped to this BU (planned intent). When a metric trend conflicts with a related PRD's planned direction, name the disconnect explicitly.
- The library of abstract business objectives the team uses.

Your job: produce 2–5 ranked recommendations that compare metric trajectories to research evidence and stated objectives. Each recommendation takes one of these stances:

- amplify   — positive trend, research validates the cause, scale the winning tactic.
- guard     — positive trend, but research warns of fragility — preserve the gain, prevent regression.
- pivot     — negative trend, research explains the why, change course. Name the new direction.
- investigate — signal is unclear (single data point, conflicting research, or the trend isn't connected to anything we want to influence) — name the next study.
- escalate  — negative trend AND a directly affected OKR is at risk — leadership decision needed.

Rules — non-negotiable:

1. Every recommendation MUST cite at least one metric (by id) AND at least one of: research (by id), an OKR (by id), or an objective (by id). No groundless recommendations.

2. Citation relevance is required, not decorative. For each citation, write one sentence on why it supports this recommendation. "Confirms the trend" / "Shows the cause" / "OKR this metric directly serves" — be specific.

3. Be specific. No "consider X" or "maybe Y". Banned phrases: "stakeholders should", "may want to", "potentially", "various". If you would have to hedge, drop the recommendation.

4. Rank by consequence. The most important recommendation is first.

5. Honest stances. If the signal is genuinely thin, the right call is "investigate" — don't promote it to "pivot" to sound decisive. If the trend is good but the cause unclear, "guard" beats "amplify".

6. Risks: 1-3 short risks per recommendation — ways this recommendation could be wrong. Steelman the counter so the user knows what to watch for.

7. nextActions: 2-4 short, owner-shaped sentences. "Run a 5-customer call with [segment] within two weeks." Not "consider running calls."

Also produce a 2-3 sentence \`summary\` describing the overall shape of this BU's quarter: where they're winning, where they're at risk, and the dominant tension.

Output via the submit_bu_recommendations tool. No prose outside the tool call.`;

const BU_REC_TOOL = {
  name: "submit_bu_recommendations",
  description:
    "Submit the BU-level recommendation rollup as structured JSON.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stance: {
              type: "string",
              enum: [
                "amplify",
                "guard",
                "pivot",
                "investigate",
                "escalate",
              ],
            },
            headline: { type: "string" },
            rationale: { type: "string" },
            metricIds: { type: "array", items: { type: "string" } },
            researchCitations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  researchId: { type: "string" },
                  relevance: { type: "string" },
                },
                required: ["researchId", "relevance"],
              },
            },
            objectiveCitations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objectiveId: { type: "string" },
                  relevance: { type: "string" },
                },
                required: ["objectiveId", "relevance"],
              },
            },
            okrCitations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  okrId: { type: "string" },
                  relevance: { type: "string" },
                },
                required: ["okrId", "relevance"],
              },
            },
            nextActions: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
          },
          required: [
            "stance",
            "headline",
            "rationale",
            "metricIds",
            "researchCitations",
            "objectiveCitations",
            "okrCitations",
            "nextActions",
            "risks",
          ],
        },
      },
    },
    required: ["summary", "recommendations"],
  },
} as const;

function serializeMetrics(metrics: DerivedMetric[]): string {
  if (metrics.length === 0) return "(no metrics tied to this BU)";
  return metrics
    .map(
      (m) =>
        `- id: ${m.id} | "${m.name}" — ${m.changeDirection}${
          typeof m.changeMagnitude === "number"
            ? ` ${m.changeMagnitude}${m.changeUnit === "pct" ? "%" : ""}`
            : ""
        }${typeof m.value === "number" ? ` (value=${m.value}${m.unit ? " " + m.unit : ""})` : ""} | period=${m.periodLabel} | sentiment=${m.sentiment} | sourceDocumentId=${m.sourceDocumentId}${m.evidenceQuote ? `\n  quote: "${m.evidenceQuote.slice(0, 220)}"` : ""}`,
    )
    .join("\n");
}

function serializeResearch(rs: ResearchArtifact[]): string {
  if (rs.length === 0) return "(no research available)";
  return rs
    .map((r) => {
      const body =
        r.content.length > MAX_RESEARCH_CHARS
          ? r.content.slice(0, MAX_RESEARCH_CHARS) +
            `\n[…truncated from ${r.content.length} chars]`
          : r.content;
      return `## id: ${r.id} | ${r.title}
Source: ${r.source}${r.conductedAt ? ` | Conducted: ${r.conductedAt}` : ""}

Summary: ${r.summary}

Body:
${body}`;
    })
    .join("\n\n---\n\n");
}

function serializePRDs(prds: PRD[]): string {
  if (prds.length === 0) return "(no PRDs scoped to this BU)";
  return prds
    .map(
      (p) =>
        `- id: ${p.id} | ${p.title} (status: ${p.status}${p.targetShipDate ? `, target ship ${p.targetShipDate}` : ""})\n  Problem: ${p.problem || "(unstated)"}\n  Solution: ${p.solution || "(unstated)"}\n  Success metrics:\n${p.successMetrics.map((s) => `    - ${s}`).join("\n") || "    (none stated)"}`,
    )
    .join("\n\n");
}

function serializeOkrs(okrs: OKR[]): string {
  if (okrs.length === 0) return "(no BU OKRs)";
  return okrs
    .map(
      (o) =>
        `- id: ${o.id} | ${o.objective} (${o.timeframe}${o.status ? `, ${o.status}` : ""})\n  KRs:\n${o.keyResults.map((k) => `    - ${k}`).join("\n")}`,
    )
    .join("\n");
}

function serializeObjectives(objs: Objective[]): string {
  return objs
    .map(
      (o) =>
        `- id: ${o.id} | ${o.title} — ${o.description}`,
    )
    .join("\n");
}

export async function generateBURecommendations(
  input: BURecommendationsInput,
): Promise<BURecommendationSet> {
  if (input.metrics.length === 0) {
    throw new Error(
      "Need at least one metric tied to this BU before recommendations can be generated.",
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockRecommendations(input);
  }

  const client = new Anthropic({ apiKey, maxRetries: 2 });

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `# Business unit\n\nname: ${input.businessUnit.name}\nid: ${input.businessUnit.id}${input.businessUnit.description ? `\ndescription: ${input.businessUnit.description}` : ""}`,
    },
    {
      type: "text",
      text: `# Metrics for this BU\n\n${serializeMetrics(input.metrics)}`,
    },
    {
      type: "text",
      text: `# Research artifacts (sources of the observed metrics)\n\n${serializeResearch(input.research)}`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `# PRDs scoped to this BU (planned intent)\n\n${serializePRDs(input.prds ?? [])}`,
    },
    { type: "text", text: `# BU-scoped OKRs\n\n${serializeOkrs(input.okrs)}` },
    {
      type: "text",
      text: `# Objectives library (abstract; reference by id when relevant)\n\n${serializeObjectives(input.objectives)}`,
    },
    {
      type: "text",
      text: "Now call submit_bu_recommendations. Rank 2-5 recommendations by consequence. Cite metrics + (research / OKR / objective) for each.",
    },
  ];

  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [BU_REC_TOOL as unknown as Anthropic.Messages.Tool],
    tool_choice: { type: "tool", name: BU_REC_TOOL.name },
    messages: [{ role: "user", content: userContent }],
  });
  const final = await stream.finalMessage();
  const toolBlock = final.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    throw new Error(
      `Model did not return a tool_use block (stop_reason=${final.stop_reason}).`,
    );
  }
  const data = toolBlock.input as {
    summary?: string;
    recommendations?: BURecommendationItem[];
  };
  if (!Array.isArray(data.recommendations) || data.recommendations.length === 0) {
    throw new Error(
      `Model returned no recommendations (stop_reason=${final.stop_reason}).`,
    );
  }

  return {
    id: `bur_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessUnitId: input.businessUnit.id,
    summary: data.summary ?? "",
    recommendations: data.recommendations,
    generatedAt: new Date().toISOString(),
    generatedBy: "anthropic",
    model: DEFAULT_MODEL,
  };
}

// Deterministic mock — produces a coherent rollup so the demo path stays
// useful without an API key.
function mockRecommendations(
  input: BURecommendationsInput,
): BURecommendationSet {
  const { businessUnit, metrics, research, okrs } = input;
  const positives = metrics.filter((m) => m.sentiment === "positive");
  const negatives = metrics.filter((m) => m.sentiment === "negative");

  const recs: BURecommendationItem[] = [];

  if (negatives.length > 0) {
    const m = negatives[0];
    const stance: BURecommendationStance =
      okrs.length > 0 ? "escalate" : "pivot";
    recs.push({
      stance,
      headline: `${m.name} is moving the wrong direction; act before next quarter.`,
      rationale: `Research from ${research[0]?.source ?? "the team"} surfaces a clear cause: the trend is not random. Status quo is the most expensive option.`,
      metricIds: [m.id],
      researchCitations: research.slice(0, 1).map((r) => ({
        researchId: r.id,
        relevance: `Names the cause of the ${m.name} regression.`,
      })),
      objectiveCitations: [],
      okrCitations: okrs.slice(0, 1).map((o) => ({
        okrId: o.id,
        relevance: `This metric directly serves the OKR; an off-track metric puts the OKR at risk.`,
      })),
      nextActions: [
        `Brief leadership on the regression and the proposed pivot direction within one week.`,
        `Run a 5-customer call with the affected segment to confirm the cause.`,
        `Identify the smallest reversible change that would test the pivot.`,
      ],
      risks: [
        `The research sample may not generalize; validate before committing.`,
        `Pivoting too fast can churn the team if the data is noisy.`,
      ],
    });
  }

  if (positives.length > 0) {
    const m = positives[0];
    recs.push({
      stance: "amplify",
      headline: `${m.name} is the strongest signal — scale what's driving it.`,
      rationale: `The trend is consistent with what the research describes. Scaling the tactic that produced it is the highest-leverage move available.`,
      metricIds: [m.id],
      researchCitations: research.slice(0, 1).map((r) => ({
        researchId: r.id,
        relevance: `Describes the tactic correlated with the gain.`,
      })),
      objectiveCitations: [],
      okrCitations: [],
      nextActions: [
        `Map the customers driving the gain; isolate what's different about them.`,
        `Productize the tactic so it doesn't rely on hand-holding.`,
      ],
      risks: [
        `Correlation, not causation — the gain may not be from the tactic you think.`,
      ],
    });
  }

  if (recs.length === 0) {
    recs.push({
      stance: "investigate",
      headline: `Signal is thin for ${businessUnit.name}; establish a baseline before acting.`,
      rationale: `Not enough metric observations yet to recommend a direction with confidence. Add research that surfaces quantitative observations to make this dashboard load-bearing.`,
      metricIds: [],
      researchCitations: [],
      objectiveCitations: [],
      okrCitations: [],
      nextActions: [
        `Add 2-3 research artifacts that include numeric observations for this BU.`,
      ],
      risks: [],
    });
  }

  return {
    id: `bur_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessUnitId: businessUnit.id,
    summary: `${businessUnit.name}: ${negatives.length} negative trend${negatives.length === 1 ? "" : "s"}, ${positives.length} positive. Recommendations below rank decisions by consequence.`,
    recommendations: recs,
    generatedAt: new Date().toISOString(),
    generatedBy: "mock",
  };
}
