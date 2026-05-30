"use server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BusinessUnit,
  Customer,
  Objective,
  Person,
} from "@/lib/types";
import { withRetry } from "@/lib/llm/retry";

// The central document classifier. Reads a chunk of extracted text and
// decides which kind it is (research / prd / memo) so the unified
// /knowledge/new intake can auto-route to the right categorize step.
//
// Also surfaces "suggested links" — but ONLY where the document literally
// names an entity the team already has on file. No fuzzy matches, no
// thematic guesses. This is the discipline that keeps auto-curation from
// inventing relationships.

export type ClassifiedKind = "research" | "prd" | "memo";

export interface ClassifiedAlternate {
  kind: ClassifiedKind;
  confidence: number; // 0..1
  rationale: string;
}

export interface ClassifierSuggestedLinks {
  personIds: string[];
  customerIds: string[];
  objectiveIds: string[];
  businessUnitId?: string;
  tags: string[];
}

export interface ClassificationResult {
  kind: ClassifiedKind;
  confidence: number; // 0..1 — auto-route threshold is 0.8 in the UI
  rationale: string;
  alternates: ClassifiedAlternate[];
  suggestedLinks: ClassifierSuggestedLinks;
  generatedBy: "anthropic" | "mock";
}

export interface ClassifyInput {
  text: string;
  filename?: string;
  knownEntities: {
    people: Pick<Person, "id" | "name" | "title">[];
    customers: Pick<Customer, "id" | "name">[];
    objectives: Pick<Objective, "id" | "title">[];
    businessUnits: Pick<BusinessUnit, "id" | "name">[];
  };
}

const MAX_CHARS = 6_000;

const SYSTEM_PROMPT = `You are a document classifier and entity-linker for an enterprise knowledge repository. Your output decides where a freshly-uploaded document gets filed and how it links to entities the team already has on record.

You receive:
- The extracted text from a document (up to ~6k chars).
- The team's known entities: people, customers, objectives, business units.

Your job is to call submit_classification with:

1. kind — one of:
   - research: a primary observation — interview transcript, customer feedback report, user study, survey, recorded call notes. Things that document what users said or did. Signals: named participants, direct quotes, methodology, "research" / "interview" / "study" in title or body.
   - prd: a planning document — has a problem statement, a proposed solution, target users, success metrics, target ship date or status. Signals: "PRD" or "product requirements" in title, distinct problem/solution sections, target metrics like "30% adoption", a status like "draft/review/approved".
   - memo: a narrative document — strategy memos, executive briefs, post-mortems, market reads, competitive intel. Anything narrative that's neither structured research nor a planning doc. Signals: argumentative prose, assertions and recommendations, no participants, no problem/solution structure.

2. confidence — 0.0 to 1.0. Be honest. The host application auto-routes at 0.8; below that the user is asked to confirm.

3. rationale — one sentence on what cued the primary classification.

4. alternates — the two other kinds, each with their own confidence + one-sentence rationale on what would push it that way.

5. suggestedLinks — STRICT rules:
   - Only include a personId / customerId / objectiveId / businessUnitId if the document LITERALLY names that entity by its canonical name (or a close variant like first name + last name vs. last name only). No fuzzy matches, no thematic guesses.
   - Example: if the document says "Bill McDermott", you may suggest his personId. If it says "the CEO", you may NOT — that's an inference.
   - tags: 3-6 lowercase kebab-case tags inferred from topic, segment, timeframe. These can be inferred more loosely than entity links.

Bias toward "memo" for ambiguous narrative documents. Bias toward "research" only when there are clear participants or quoted research. Bias toward "prd" only when there's a clear problem/solution + success-metrics shape.

Output the submit_classification tool call. No prose outside the tool call.`;

const CLASSIFY_TOOL = {
  name: "submit_classification",
  description:
    "Submit the document classification + suggested links for the knowledge repository.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["research", "prd", "memo"] },
      confidence: { type: "number" },
      rationale: { type: "string" },
      alternates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["research", "prd", "memo"] },
            confidence: { type: "number" },
            rationale: { type: "string" },
          },
          required: ["kind", "confidence", "rationale"],
        },
      },
      suggestedLinks: {
        type: "object",
        properties: {
          personIds: { type: "array", items: { type: "string" } },
          customerIds: { type: "array", items: { type: "string" } },
          objectiveIds: { type: "array", items: { type: "string" } },
          businessUnitId: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["personIds", "customerIds", "objectiveIds", "tags"],
      },
    },
    required: [
      "kind",
      "confidence",
      "rationale",
      "alternates",
      "suggestedLinks",
    ],
  },
} as const;

function serializeEntities(entities: ClassifyInput["knownEntities"]): string {
  const lines: string[] = [];
  if (entities.people.length > 0) {
    lines.push("# People");
    for (const p of entities.people) {
      lines.push(`- id: ${p.id} | ${p.name} (${p.title})`);
    }
  }
  if (entities.customers.length > 0) {
    lines.push("\n# Customers");
    for (const c of entities.customers) lines.push(`- id: ${c.id} | ${c.name}`);
  }
  if (entities.objectives.length > 0) {
    lines.push("\n# Objectives");
    for (const o of entities.objectives)
      lines.push(`- id: ${o.id} | ${o.title}`);
  }
  if (entities.businessUnits.length > 0) {
    lines.push("\n# Business units");
    for (const b of entities.businessUnits)
      lines.push(`- id: ${b.id} | ${b.name}`);
  }
  return lines.join("\n") || "(no known entities)";
}

export async function classifyDocument(
  input: ClassifyInput,
): Promise<ClassificationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockClassify(input);
  }

  const trimmed =
    input.text.length > MAX_CHARS
      ? input.text.slice(0, MAX_CHARS) +
        `\n\n[...truncated from ${input.text.length} chars]`
      : input.text;

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 2,
  });

  try {
    const response = await withRetry(() =>
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [CLASSIFY_TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
        messages: [
          {
            role: "user",
            content: `Filename: ${input.filename ?? "(none)"}\n\n# Known entities\n\n${serializeEntities(input.knownEntities)}\n\n# Document text\n\n${trimmed}`,
          },
        ],
      }),
    );
    const tool = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!tool) return mockClassify(input);
    const data = tool.input as {
      kind: ClassifiedKind;
      confidence: number;
      rationale: string;
      alternates: ClassifiedAlternate[];
      suggestedLinks: ClassifierSuggestedLinks;
    };
    // Defense: ensure suggested ids actually map to known entities. The LLM
    // might hallucinate an id; we drop anything that doesn't exist.
    const peopleIds = new Set(input.knownEntities.people.map((p) => p.id));
    const customerIds = new Set(input.knownEntities.customers.map((c) => c.id));
    const objectiveIds = new Set(
      input.knownEntities.objectives.map((o) => o.id),
    );
    const buIds = new Set(input.knownEntities.businessUnits.map((b) => b.id));
    return {
      kind: data.kind,
      confidence: Math.max(0, Math.min(1, data.confidence)),
      rationale: data.rationale,
      alternates: (data.alternates ?? []).slice(0, 2),
      suggestedLinks: {
        personIds: (data.suggestedLinks?.personIds ?? []).filter((id) =>
          peopleIds.has(id),
        ),
        customerIds: (data.suggestedLinks?.customerIds ?? []).filter((id) =>
          customerIds.has(id),
        ),
        objectiveIds: (data.suggestedLinks?.objectiveIds ?? []).filter((id) =>
          objectiveIds.has(id),
        ),
        businessUnitId:
          data.suggestedLinks?.businessUnitId &&
          buIds.has(data.suggestedLinks.businessUnitId)
            ? data.suggestedLinks.businessUnitId
            : undefined,
        tags: (data.suggestedLinks?.tags ?? [])
          .map((t) => t.toLowerCase())
          .filter(Boolean),
      },
      generatedBy: "anthropic",
    };
  } catch (err) {
    console.error("[classifyDocument] failed:", err);
    return mockClassify(input);
  }
}

// Heuristic mock so the demo path classifies sensibly without an API key.
// Confidence is intentionally modest so the user still sees the chooser
// occasionally — gives them a feel for the production behavior.
function mockClassify(input: ClassifyInput): ClassificationResult {
  const t = input.text.slice(0, 10_000).toLowerCase();
  const filename = (input.filename ?? "").toLowerCase();

  let prdScore = 0;
  let researchScore = 0;
  let memoScore = 0;

  // PRD signals
  if (/\bprd\b|product requirements/i.test(t + " " + filename)) prdScore += 3;
  if (/problem statement|problem:/i.test(t)) prdScore += 2;
  if (/proposed solution|solution:/i.test(t)) prdScore += 2;
  if (/success metrics?|target metrics?/i.test(t)) prdScore += 2;
  if (/target users?|target audience/i.test(t)) prdScore += 1;
  if (/target ship|ship date|launch date/i.test(t)) prdScore += 1;
  if (/\b(draft|in review|approved|shipped)\b/.test(t)) prdScore += 1;

  // Research signals
  if (/interview|participant|methodology|transcript/i.test(t)) researchScore += 3;
  if (/customer (research|interview|feedback)/i.test(t)) researchScore += 2;
  if (/quoted|direct quote/i.test(t)) researchScore += 1;
  if (/study|survey|usability/i.test(t)) researchScore += 1;
  if (/(\d{4})-(\d{2})-(\d{2}).*(conducted|interviewed)/i.test(t))
    researchScore += 2;

  // Memo signals (or anti-signals against the others)
  if (/post-mortem|postmortem|retrospective/i.test(t)) memoScore += 3;
  if (/strategy memo|strategic|positioning/i.test(t)) memoScore += 2;
  if (/competitive|market read|market intelligence/i.test(t)) memoScore += 2;
  if (/recommendation:|i recommend|we should/i.test(t)) memoScore += 1;

  // Pick winner with a floor for memo (the catch-all)
  const scores: Array<[ClassifiedKind, number]> = [
    ["prd", prdScore],
    ["research", researchScore],
    ["memo", memoScore + 0.5], // memo wins ties
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [topKind, topScore] = scores[0];
  const total = scores.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
  const confidence = topScore <= 0 ? 0.55 : Math.min(0.92, topScore / total + 0.4);

  // Suggested links: look for entity names in the text
  const personIds = input.knownEntities.people
    .filter((p) => t.includes(p.name.toLowerCase()))
    .map((p) => p.id);
  const customerIds = input.knownEntities.customers
    .filter((c) => t.includes(c.name.toLowerCase()))
    .map((c) => c.id);
  const objectiveIds = input.knownEntities.objectives
    .filter((o) => t.includes(o.title.toLowerCase()))
    .map((o) => o.id);
  const businessUnitId = input.knownEntities.businessUnits.find((b) =>
    t.includes(b.name.toLowerCase()),
  )?.id;

  return {
    kind: topKind,
    confidence,
    rationale:
      topKind === "prd"
        ? "Has the problem/solution/success-metrics shape of a PRD."
        : topKind === "research"
          ? "Mentions participants, methodology, or transcript-style content."
          : "Reads as narrative — no participants or planning structure detected.",
    alternates: scores.slice(1).map(([kind, score]) => ({
      kind,
      confidence: score <= 0 ? 0.2 : Math.min(0.75, score / total + 0.2),
      rationale:
        kind === "prd"
          ? "Some planning-shape signals present."
          : kind === "research"
            ? "Some research-shape signals present."
            : "Could file as a generic memo if the other signals are weak.",
    })),
    suggestedLinks: {
      personIds,
      customerIds,
      objectiveIds,
      businessUnitId,
      tags: [],
    },
    generatedBy: "mock",
  };
}
