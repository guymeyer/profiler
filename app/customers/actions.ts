"use server";
import Anthropic from "@anthropic-ai/sdk";
import type { Customer, Person, InfluenceLevel, CommStyle } from "@/lib/types";
import { slugifyId } from "@/lib/customer-md";
import { slugifyId as slugifyPersonId } from "@/lib/profile-md";
import { withRetry } from "@/lib/llm/retry";

const CUSTOMER_RESEARCH_TOOL = {
  name: "submit_customer_profile",
  description:
    "Submit a structured customer profile drafted from public sources.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      industry: { type: "string" },
      size: {
        type: "string",
        description: "Rough size: e.g. 'startup', '500 employees', 'Fortune 500'.",
      },
      region: { type: "string", description: "HQ region or primary market." },
      summary: {
        type: "string",
        description:
          "2-4 sentences. Who they are, what they do, what's currently happening that matters for a pitch.",
      },
      knownStakeholders: {
        type: "array",
        items: { type: "string" },
        description:
          "Named decision-makers or roles likely involved in a buying decision. Cite role + name when known.",
      },
      buyingTriggers: {
        type: "array",
        items: { type: "string" },
        description:
          "Recent events, market moves, or pain points that would cause them to evaluate something like our pitch now.",
      },
      evaluationCriteria: {
        type: "array",
        items: { type: "string" },
        description:
          "What this company tends to weigh when evaluating vendors / partners. Inferred from public signals.",
      },
      redFlags: {
        type: "array",
        items: { type: "string" },
        description:
          "Risks specific to selling to this company — legal posture, past failed initiatives, executive turnover, etc.",
      },
      competitiveContext: {
        type: "array",
        items: { type: "string" },
        description:
          "Known incumbents, competitors they care about, or comparable case studies in the space.",
      },
      notes: {
        type: "array",
        items: { type: "string" },
        description:
          "Anything else load-bearing for a tailored pitch — recent press, leadership statements, strategic shifts.",
      },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["name", "summary"],
  },
} as const;

type CustomerResearchOutput = {
  name: string;
  industry?: string;
  size?: string;
  region?: string;
  summary: string;
  knownStakeholders?: string[];
  buyingTriggers?: string[];
  evaluationCriteria?: string[];
  redFlags?: string[];
  competitiveContext?: string[];
  notes?: string[];
  tags?: string[];
};

export async function researchCustomer(args: {
  companyName: string;
  context?: string;
}): Promise<Customer> {
  const name = args.companyName.trim();
  if (!name) throw new Error("Company name is required.");

  // Lockdown mode: skip the web_search-backed Claude call (the most expensive
  // path in the app — multiple searches + a long synthesis call) and return
  // the deterministic mock draft. Set PUBLIC_LOCKDOWN=1 in Vercel for public
  // deployments to bound spend.
  if (process.env.PUBLIC_LOCKDOWN === "1") {
    return buildMockResearch(name, args.context);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return buildMockResearch(name, args.context);

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const userPrompt = `Research the company "${name}" and produce a structured customer profile useful for tailoring an enterprise pitch.

${args.context ? `Context from the user (what they're pitching / why they care):\n${args.context}\n\n` : ""}Use web search to ground claims in current sources. Prefer signals from the last 12 months. Be specific — name people, products, deals. If you can't find a signal, leave that field empty rather than guessing.

Then call submit_customer_profile with the structured result. Do not output prose outside the tool call.`;

  // The web_search tool is a server-side Anthropic tool. The model issues
  // search queries during generation, then calls our submit tool with the
  // synthesized profile.
  const response = await withRetry(() =>
    client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        } as unknown as Anthropic.Messages.Tool,
        CUSTOMER_RESEARCH_TOOL as unknown as Anthropic.Messages.Tool,
      ],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userPrompt }],
    }),
  );

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === CUSTOMER_RESEARCH_TOOL.name,
  );
  if (!toolBlock) {
    throw new Error(
      "Model did not return a customer profile. Try again or fall back to manual entry.",
    );
  }
  const data = toolBlock.input as CustomerResearchOutput;
  return toCustomer(data, "research");
}

function toCustomer(
  data: CustomerResearchOutput,
  source: "manual" | "research",
): Customer {
  const now = new Date().toISOString();
  return {
    id: slugifyId(data.name),
    name: data.name,
    industry: data.industry,
    size: data.size,
    region: data.region,
    summary: data.summary,
    knownStakeholders: data.knownStakeholders ?? [],
    buyingTriggers: data.buyingTriggers ?? [],
    evaluationCriteria: data.evaluationCriteria ?? [],
    redFlags: data.redFlags ?? [],
    competitiveContext: data.competitiveContext ?? [],
    notes: data.notes ?? [],
    tags: (data.tags ?? []).map((t) => t.toLowerCase()),
    source,
    researchedAt: source === "research" ? now : undefined,
    createdAt: now,
  };
}

// Deterministic mock so the flow works end-to-end without an API key.
function buildMockResearch(name: string, context?: string): Customer {
  const ctx = context?.trim();
  return toCustomer(
    {
      name,
      industry: "Unknown — fill in",
      size: "Unknown",
      region: "Unknown",
      summary: `Mock-mode draft for ${name}. No web search ran because no Anthropic API key is configured. ${
        ctx
          ? `Captured your context: "${ctx.slice(0, 200)}".`
          : "Add real findings before using this in a pitch."
      } Edit this profile to replace the placeholders.`,
      knownStakeholders: [
        "Likely CFO involvement on procurement",
        "Engineering/Platform leadership for technical fit",
      ],
      buyingTriggers: [
        "Reorg or new exec hire in the last 6 months",
        "Public statement about cost discipline or growth pressure",
      ],
      evaluationCriteria: [
        "ROI within 12 months (replace with real evidence)",
        "Reference from a comparable peer in their industry",
      ],
      redFlags: [
        "No recent press signal of openness to vendor change",
        "Verify procurement cadence before committing to a timeline",
      ],
      competitiveContext: [
        "Identify the incumbent vendor before the first meeting",
        "Find one comparable case study in their industry",
      ],
      notes: [
        "This is a deterministic placeholder — re-run with an API key for real research.",
      ],
      tags: ["draft", "mock"],
    },
    "research",
  );
}

// ─── Stakeholder discovery ─────────────────────────────────────────────────

const INFLUENCE_VALUES: InfluenceLevel[] = ["executive", "senior", "lead", "ic"];
const COMM_VALUES: CommStyle[] = [
  "data-driven",
  "narrative",
  "visual",
  "operational",
  "customer-centric",
  "consensus",
  "technical",
];

const STAKEHOLDER_TOOL = {
  name: "submit_stakeholders",
  description:
    "Submit a ranked roster of key stakeholders at the target company, drafted from public sources.",
  input_schema: {
    type: "object",
    properties: {
      stakeholders: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Named person if you found one (e.g. 'Jane Smith'). Otherwise the role (e.g. 'VP of Engineering').",
            },
            title: { type: "string" },
            team: { type: "string", description: "Team / function. Optional." },
            influence: {
              type: "string",
              enum: INFLUENCE_VALUES,
              description:
                "executive (C-suite/EVP), senior (VP/Senior Director), lead (Director/Manager), ic (individual contributor).",
            },
            commStyle: {
              type: "array",
              items: { type: "string", enum: COMM_VALUES },
              description: "Up to 3 communication styles. Infer from background.",
            },
            summary: {
              type: "string",
              description:
                "2-3 sentences. Who they are at this company, what they care about, what's currently on their plate.",
            },
            decisionTriggers: {
              type: "array",
              items: { type: "string" },
              description: "What makes them say yes. Be specific to this role at this company.",
            },
            objections: {
              type: "array",
              items: { type: "string" },
              description: "Predictable pushbacks given their role and the company's posture.",
            },
            dos: { type: "array", items: { type: "string" } },
            donts: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["name", "title", "influence", "summary"],
        },
      },
    },
    required: ["stakeholders"],
  },
} as const;

interface StakeholderDraft {
  name: string;
  title: string;
  team?: string;
  influence: InfluenceLevel;
  commStyle?: CommStyle[];
  summary: string;
  decisionTriggers?: string[];
  objections?: string[];
  dos?: string[];
  donts?: string[];
  tags?: string[];
}

export async function researchCustomerStakeholders(args: {
  customer: Customer;
  context?: string;
}): Promise<Person[]> {
  // Lockdown: same rationale as researchCustomer — this call is the most
  // expensive in the app (up to 8 web searches + a long synthesis).
  if (process.env.PUBLIC_LOCKDOWN === "1") {
    return buildMockStakeholders(args.customer, args.context);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return buildMockStakeholders(args.customer, args.context);

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const customerBrief = [
    `Company: ${args.customer.name}`,
    args.customer.industry ? `Industry: ${args.customer.industry}` : null,
    args.customer.size ? `Size: ${args.customer.size}` : null,
    args.customer.region ? `Region: ${args.customer.region}` : null,
    args.customer.summary ? `\nWhat we know:\n${args.customer.summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `Identify 3–6 key stakeholders at the target company below who would be involved in a buying decision for an enterprise pitch. Use web search to find named decision-makers when possible (current titles in the last 12 months). When a name can't be confidently identified, return the role instead of guessing.

${customerBrief}

${args.context ? `\nPitch context from the user:\n${args.context}\n` : ""}

For each stakeholder, draft a profile with the same shape as our internal people profiles. Rank by influence level (executive → ic). Ground every claim in public signals — if you can't, leave that field empty rather than inventing. Then call submit_stakeholders with the structured roster.`;

  const response = await withRetry(() =>
    client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 8,
        } as unknown as Anthropic.Messages.Tool,
        STAKEHOLDER_TOOL as unknown as Anthropic.Messages.Tool,
      ],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: userPrompt }],
    }),
  );

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === STAKEHOLDER_TOOL.name,
  );
  if (!toolBlock) {
    throw new Error(
      "Model did not return a stakeholder roster. Try again with more company context.",
    );
  }
  const data = toolBlock.input as { stakeholders: StakeholderDraft[] };
  const drafts = data.stakeholders.map((s) => toPerson(s, args.customer));
  return assignRanksWithinLevel(drafts);
}

// Stamp sequential rankWithinLevel within each influence band based on the
// order the model returned. Keeps the LLM-implied seniority sticky until a
// human drags to reorder.
function assignRanksWithinLevel(people: Person[]): Person[] {
  const counters: Record<string, number> = {};
  return people.map((p) => {
    const idx = (counters[p.influence] ??= 0);
    counters[p.influence] = idx + 1;
    return { ...p, rankWithinLevel: idx };
  });
}

function toPerson(draft: StakeholderDraft, customer: Customer): Person {
  return {
    id: `${slugifyId(customer.name)}-${slugifyPersonId(draft.name)}`,
    name: draft.name,
    title: draft.title,
    team: draft.team || customer.industry || "Unknown",
    influence: INFLUENCE_VALUES.includes(draft.influence)
      ? draft.influence
      : "senior",
    commStyle: (draft.commStyle ?? []).filter((c) =>
      COMM_VALUES.includes(c as CommStyle),
    ) as CommStyle[],
    summary: draft.summary,
    reviewPreferences: [],
    visualPreferences: [],
    decisionTriggers: draft.decisionTriggers ?? [],
    objections: draft.objections ?? [],
    dos: draft.dos ?? [],
    donts: draft.donts ?? [],
    exampleGuidance: [],
    tags: [
      ...(draft.tags ?? []).map((t) => t.toLowerCase()),
      `customer:${slugifyId(customer.name)}`,
    ],
    customerId: customer.id,
    source: "research",
    researchedAt: new Date().toISOString(),
  };
}

function buildMockStakeholders(
  customer: Customer,
  context?: string,
): Person[] {
  const ctx = context?.trim();
  const ctxNote = ctx ? ` Captured context: "${ctx.slice(0, 80)}…"` : "";
  const seeds: StakeholderDraft[] = [
    {
      name: `${customer.name} CFO`,
      title: "Chief Financial Officer",
      team: "Finance",
      influence: "executive",
      commStyle: ["data-driven"],
      summary: `Mock placeholder.${ctxNote} Replace with the real CFO's profile once research is run with an API key.`,
      decisionTriggers: ["ROI within 12 months", "Verifiable risk reduction"],
      objections: ["Procurement timing", "Hidden integration cost"],
      dos: ["Lead with finance-grade numbers", "Show a peer reference"],
      donts: ["Don't open with features", "Don't bury the total cost"],
      tags: ["finance", "exec", "mock"],
    },
    {
      name: `${customer.name} CTO`,
      title: "Chief Technology Officer",
      team: "Engineering",
      influence: "executive",
      commStyle: ["technical", "operational"],
      summary: `Mock placeholder.${ctxNote} Replace once research runs with an API key.`,
      decisionTriggers: ["Concrete failure-mode handling", "Migration path"],
      objections: ["Vendor lock-in", "Operational complexity"],
      dos: ["Show the failure modes up front", "Bring a real reference architecture"],
      donts: ["Don't market the platform", "Don't skip the rollback plan"],
      tags: ["engineering", "exec", "mock"],
    },
    {
      name: `${customer.name} VP Procurement`,
      title: "VP Procurement",
      team: "Operations",
      influence: "senior",
      commStyle: ["consensus", "operational"],
      summary: `Mock placeholder.${ctxNote}`,
      decisionTriggers: ["Standard contract terms", "Reference from a comparable peer"],
      objections: ["Non-standard SLAs", "Indemnification gaps"],
      dos: ["Pre-clear contract terms", "Surface SLA expectations early"],
      donts: ["Don't push timeline before procurement cadence is confirmed"],
      tags: ["procurement", "mock"],
    },
  ];
  return assignRanksWithinLevel(seeds.map((s) => toPerson(s, customer)));
}

